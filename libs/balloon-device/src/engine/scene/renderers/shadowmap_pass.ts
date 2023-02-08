import { RenderPass } from './renderpass';
import { RENDER_PASS_TYPE_SHADOWMAP } from '../values';
import { Frustum, Matrix4x4, Vector4 } from '../../math';
import { PunctualLight } from '../light';
import { ShaderLib } from '../materiallib';
import { Camera } from '../camera';
import { ProgramBuilder, PBShaderExp, PBGlobalScope, BindGroup, RenderStateSet, FaceMode, TextureFormat, PBInsideFunctionScope } from '../../device';
import { CopyBlitter, GaussianBlurBlitter, BlitType } from '../blitter';
import * as values from '../values';
import type { Scene } from '../scene';
import type { RenderQueue } from '../render_queue';
import type { DrawContext } from '../drawable';
import type { RenderScheme } from './renderscheme';

class DebugBlitter extends CopyBlitter {
  public packFloat: boolean;
  constructor() {
    super();
    this.packFloat = false;
  }
  filter(scope: PBInsideFunctionScope, type: BlitType, srcTex: PBShaderExp, srcUV: PBShaderExp, srcLayer: PBShaderExp): PBShaderExp {
    const pb = scope.$builder;
    const texel = this.readTexel(scope, type, srcTex, srcUV, srcLayer);
    if (this.packFloat) {
      const lib = new ShaderLib(pb);
      return pb.vec4(lib.decodeNormalizedFloatFromRGBA(texel), 0, 0, 1);
    } else {
      return texel;
    }
  }
  protected calcHash(): string {
    return `${Number(this.packFloat)}`;
  }
}

class BlurBlitter extends GaussianBlurBlitter {
  public packFloat: boolean;
  readTexel(scope: PBInsideFunctionScope, type: BlitType, srcTex: PBShaderExp, srcUV: PBShaderExp, srcLayer: PBShaderExp): PBShaderExp {
    const pb = scope.$builder;
    const texel = super.readTexel(scope, type, srcTex, srcUV, srcLayer);
    if (this.packFloat) {
      const lib = new ShaderLib(pb);
      return pb.vec4(lib.decodeNormalizedFloatFromRGBA(texel), 0, 0, 1);
    } else {
      return texel;
    }
  }
  writeTexel(scope: PBInsideFunctionScope, type: BlitType, srcUV: PBShaderExp, texel: PBShaderExp): PBShaderExp {
    const pb = scope.$builder;
    const outTexel = super.writeTexel(scope, type, srcUV, texel);
    if (this.packFloat) {
      const lib = new ShaderLib(pb);
      return lib.encodeNormalizedFloatToRGBA(outTexel.r);
    } else {
      return outTexel;
    }
  }
  protected calcHash(): string {
    return `${Number(this.packFloat)}`;
  }
}

export class ShadowMapPass extends RenderPass {
  /** @internal */
  protected _currentLight: PunctualLight;
  /** @internal */
  protected _splitLambda: number;
  /** @internal */
  protected _mainPass: RenderPass;
  /** @internal */
  protected _lightCameras: WeakMap<Scene, Camera[]>;
  /** @internal */
  protected _cullFrontFaceRenderStates: RenderStateSet;
  /** @internal */
  protected _blurFilterH: BlurBlitter;
  /** @internal */
  protected _blurFilterV: BlurBlitter;
  /** @internal */
  protected _debugBlitter: DebugBlitter;
  constructor(renderScheme: RenderScheme, name: string) {
    super(renderScheme, name);
    this._currentLight = null;
    this._splitLambda = 0.5;
    this._cullFrontFaceRenderStates = renderScheme.device.createRenderStateSet();
    this._cullFrontFaceRenderStates.useRasterizerState().setCullMode(FaceMode.FRONT);
    this._mainPass = null;
    this._lightCameras = new WeakMap();
    this._blurFilterH = new BlurBlitter('horizonal', 5, 4, 1 / 1024);
    this._blurFilterH.packFloat = renderScheme.getShadowMapFormat() === TextureFormat.RGBA8UNORM;
    // this._blurFilterH.logSpace = true;
    this._blurFilterV = new BlurBlitter('vertical', 5, 4, 1 / 1024);
    this._blurFilterV.packFloat = renderScheme.getShadowMapFormat() === TextureFormat.RGBA8UNORM;
    // this._blurFilterV.logSpace = true;
    this._debugBlitter = new DebugBlitter();
    this._debugBlitter.packFloat = renderScheme.getShadowMapFormat() === TextureFormat.RGBA8UNORM;
    this.enableClear(true, true);
  }
  get light(): PunctualLight {
    return this._currentLight;
  }
  get mainPass(): RenderPass {
    return this._mainPass;
  }
  set mainPass(pass: RenderPass) {
    this._mainPass = pass;
  }
  getRenderPassType(): number {
    return RENDER_PASS_TYPE_SHADOWMAP;
  }
  /** @internal */
  protected fetchCameraForScene(scene: Scene) {
    const cameras = this._lightCameras.get(scene);
    if (!cameras || cameras.length === 0) {
      return new Camera(scene);
    } else {
      const camera = cameras.pop();
      camera.position.set(0, 0, 0);
      camera.rotation.identity();
      camera.scaling.set(1, 1, 1);
      return camera;
    }
  }
  /** @internal */
  protected releaseCamera(camera: Camera) {
    let cameras = this._lightCameras.get(camera.scene);
    if (!cameras) {
      cameras = [];
      this._lightCameras.set(camera.scene, cameras);
    }
    camera.remove();
    cameras.push(camera);
  }
  /** @internal */
  calcSplitDistances(camera: Camera, numCascades: number): number[] {
    const farPlane = camera.getFarPlane();
    const nearPlane = camera.getNearPlane();
    const result: number[] = [0, 0, 0, 0, 0];
    for (let i = 0; i <= numCascades; ++i) {
      const fIDM = i / numCascades;
      const fLog = nearPlane * Math.pow((farPlane / nearPlane), fIDM);
      const fUniform = nearPlane + (farPlane - nearPlane) * fIDM;
      result[i] = fLog * this._splitLambda + fUniform * (1 - this._splitLambda);
    }
    return result;
  }
  /** @internal */
  protected _getGlobalBindGroupHash(ctx: DrawContext) {
    return this.light.shadow.shaderHash;
  }
  /** @internal */
  setGlobalBindings(scope: PBGlobalScope, ctx: DrawContext) {
    const pb = scope.$builder;
    const structCamera = pb.defineStruct(
      null,
      'std140',
      pb.vec3('position'),
      pb.mat4('viewProjectionMatrix'),
      pb.mat4('viewMatrix'),
      pb.mat4('projectionMatrix'),
      pb.vec4('params'),
    );
    const structLight = pb.defineStruct(
      null,
      'std140',
      pb.vec4('positionRange'),
      pb.vec4('directionCutoff'),
      pb.mat4('viewMatrix'),
      pb.vec4('depthBias'),
      pb.int('lightType'),
    );
    const structGlobal = pb.defineStruct(
      null,
      'std140',
      structCamera('camera'),
      structLight('light'),
    );
    pb.globalScope.global = structGlobal().uniform(0).tag({
      camera: {
        position: ShaderLib.USAGE_CAMERA_POSITION,
        viewProjectionMatrix: ShaderLib.USAGE_VIEW_PROJ_MATRIX,
        viewMatrix: ShaderLib.USAGE_VIEW_MATRIX,
        projectionMatrix: ShaderLib.USAGE_PROJECTION_MATRIX,
        params: ShaderLib.USAGE_CAMERA_PARAMS,
      }
    });
  }
  /** @internal */
  protected setLightUniforms(bindGroup: BindGroup, ctx: DrawContext, light: PunctualLight) {
    if (light) {
      bindGroup.setValue('global', {
        light: {
          positionRange: light.positionAndRange,
          directionCutoff: light.directionAndCutoff,
          viewMatrix: light.viewMatrix,
          depthBias: light.shadow.depthBiasValues,
          lightType: light.lightType
        }
      });
    }
    ctx.environment?.updateBindGroup(bindGroup);
  }
  /** @internal */
  protected calcDepthBiasParams(shadowMapCamera: Camera, shadowMapSize: number, depthBias: number, normalBias: number, depthScale: number, result: Vector4): void {
    const frustum = shadowMapCamera.frustum;
    const sizeNear = Math.min(
      Math.abs(frustum.getCorner(Frustum.CORNER_RIGHT_TOP_NEAR).x - frustum.getCorner(Frustum.CORNER_LEFT_TOP_NEAR).x),
      Math.abs(frustum.getCorner(Frustum.CORNER_RIGHT_TOP_NEAR).y - frustum.getCorner(Frustum.CORNER_RIGHT_BOTTOM_NEAR).y));
    const sizeFar = Math.min(
      Math.abs(frustum.getCorner(Frustum.CORNER_RIGHT_TOP_FAR).x - frustum.getCorner(Frustum.CORNER_LEFT_TOP_FAR).x),
      Math.abs(frustum.getCorner(Frustum.CORNER_RIGHT_TOP_FAR).y - frustum.getCorner(Frustum.CORNER_RIGHT_BOTTOM_FAR).y));
    const scaleFactor = sizeNear / shadowMapSize / 2;
    result.set(depthBias * scaleFactor, normalBias * scaleFactor, depthScale, sizeFar / sizeNear);
  }
  render(scene: Scene, camera: Camera) {
    const savedCullCamera = this._cullCamera;
    for (const light of scene.lightList) {
      if (light.isPunctualLight() && light.castShadow) {
        this._currentLight = light;
        light.shadow.render(this, scene, camera);
        /*
        if (!light.shadowMapInfo.framebuffer) {
          light.initShadowMap(this.renderScheme.getShadowMapFormat());
        }
        const fb = light.shadowMapInfo.framebuffer;
        this._currentLight = light;
        this._enableDepthClamp = false;
        this.scissor = null;
        this.viewport = null;
        this.clearColor = light.shadowMapInfo.colorAttachment.isFloatFormat() ? new Vector4(1, 1, 1, 1) : new Vector4(0, 0, 0, 1);
        if (light.shadowMapInfo.renderBackfacesOnly) {
          scene.device.setRenderStatesOverridden(this._cullFrontFaceRenderStates);
        }
        if (light.isPointLight()) {
          const shadowMapRenderCamera = this.fetchCameraForScene(scene);
          light.createLightCamera(scene.boundingBox, camera, shadowMapRenderCamera);
          this._cullCamera = shadowMapRenderCamera;
          this.calcDepthBiasParams(shadowMapRenderCamera, light.shadowMapSize, light.shadowDepthBias, light.shadowNormalBias, light.shadowDepthScale, light.shadowMapInfo.depthBias);
          this.renderToCubeTexture(scene, shadowMapRenderCamera, fb);
          light.shadowMapInfo.shadowMatrices.set(Matrix4x4.transpose(shadowMapRenderCamera.viewMatrix).getArray());
          this._cullCamera = null;
          this.releaseCamera(shadowMapRenderCamera);
        } else {
          if (light.shadowMapInfo.numCascades > 1) {
            const distances = this.calcSplitDistances(camera, light.shadowMapInfo.numCascades);
            const cascadeCamera = this.fetchCameraForScene(scene);
            const shadowMapRenderCamera = this.fetchCameraForScene(scene);
            const shadowMapCullCamera = this.fetchCameraForScene(scene);
            cascadeCamera.reparent(camera);
            const numRows = light.shadowMapInfo.numCascades > 2 ? 2 : 1;
            const numCols = light.shadowMapInfo.numCascades > 1 ? 2 : 1;
            this._enableDepthClamp = this._renderScheme.device.getShaderCaps().supportFragmentDepth;
            for (let split = 0; split < light.shadowMapInfo.numCascades; split++) {
              cascadeCamera.projectionMatrix = Matrix4x4.perspective(camera.getFOV(), camera.getAspect(), distances[split], distances[split + 1]);
              const cropMatrix = new Matrix4x4();
              light.createLightCamera(scene.boundingBox, cascadeCamera, shadowMapRenderCamera, cropMatrix, this._enableDepthClamp);
              light.createLightCamera(scene.boundingBox, cascadeCamera, shadowMapCullCamera, null, false);
              if (light.shadowMapInfo.colorAttachment.isTexture2DArray()) {
                shadowMapRenderCamera.projectionMatrix.multiplyLeft(cropMatrix);
                fb.setTextureLayer(0, split);
              } else {
                const adjMatrix = new Matrix4x4();
                const col = split % 2;
                const row = split >> 1;
                adjMatrix.setRow(0, new Vector4(1.5 - 0.5 * numCols, 0, 0, 0));
                adjMatrix.setRow(1, new Vector4(0, 1.5 - 0.5 * numRows, 0, 0));
                adjMatrix.setRow(2, new Vector4(0, 0, 1, 0));
                adjMatrix.setRow(3, new Vector4(col - 0.5 * numCols + 0.5, row - 0.5 * numRows + 0.5, 0, 1));
                shadowMapRenderCamera.projectionMatrix.multiplyLeft(cropMatrix).multiplyLeft(adjMatrix);
                if (scene.device.getDeviceType() === 'webgpu') {
                  this.scissor = [col * light.shadowMapSize, (numRows - 1 - row) * light.shadowMapSize, light.shadowMapSize, light.shadowMapSize];
                } else {
                  this.scissor = [col * light.shadowMapSize, row * light.shadowMapSize, light.shadowMapSize, light.shadowMapSize];
                }
              }
              this.renderQueue = this.cullScene(scene, shadowMapCullCamera, false);
              this.calcDepthBiasParams(shadowMapRenderCamera, light.shadowMapSize, light.shadowDepthBias, light.shadowNormalBias, light.shadowDepthScale, light.shadowMapInfo.depthBias);
              this.renderToTexture(scene, shadowMapRenderCamera, fb);
              this.renderQueue = null;
              light.shadowMapInfo.shadowMatrices.set(Matrix4x4.transpose(shadowMapRenderCamera.viewProjectionMatrix).getArray(), split * 16);
              light.shadowMapInfo.cascadeDistances.getArray()[split] = distances[split + 1];
            }
            this.releaseCamera(cascadeCamera);
            this.releaseCamera(shadowMapRenderCamera);
            this.releaseCamera(shadowMapCullCamera);
          } else {
            const shadowMapRenderCamera = this.fetchCameraForScene(scene);
            light.createLightCamera(scene.boundingBox, camera, shadowMapRenderCamera, null, false);
            this._cullCamera = shadowMapRenderCamera;
            this.calcDepthBiasParams(shadowMapRenderCamera, light.shadowMapSize, light.shadowDepthBias, light.shadowNormalBias, light.shadowDepthScale, light.shadowMapInfo.depthBias);
            this.renderToTexture(scene, shadowMapRenderCamera, fb);
            light.shadowMapInfo.shadowMatrices.set(Matrix4x4.transpose(shadowMapRenderCamera.viewProjectionMatrix).getArray());
            this._cullCamera = null;
            this.releaseCamera(shadowMapRenderCamera);
          }
        }
        this.postRenderShadowMap(light);
        scene.device.setRenderStatesOverridden(null);
        */
      }
    }
    this._cullCamera = savedCullCamera;
  }
  /** @internal */
  protected renderItems(camera: Camera, renderQueue: RenderQueue, lightList: PunctualLight[]) {
    const ctx: DrawContext = {
      camera,
      target: null,
      renderPass: this,
      renderPassHash: null,
      materialFunc: values.MATERIAL_FUNC_DEPTH_SHADOW,
    };
    const device = this._renderScheme.device;
    const bindGroup = this.getGlobalBindGroup(ctx);
    device.setBindGroup(0, bindGroup);
    this.setLightUniforms(bindGroup, ctx, this._currentLight);
    this.setCameraUniforms(bindGroup, ctx, this._verticalFlip !== this.isAutoFlip());
    ctx.renderPassHash = this.getGlobalBindGroupHash(ctx);
    for (const order of Object.keys(renderQueue.items).map(val => Number(val)).sort((a, b) => a - b)) {
      const renderItems = renderQueue.items[order];
      for (const item of renderItems.opaqueList) {
        if (!item.drawable.isUnlit()) {
          ctx.instanceData = item.instanceData;
          ctx.target = item.drawable;
          item.drawable.draw(ctx);
        }
      }
    }
  }
}
