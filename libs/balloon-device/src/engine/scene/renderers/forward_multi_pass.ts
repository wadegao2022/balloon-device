import { BlendFunc, RenderStateSet, PBGlobalScope, BindGroup } from '../../device';
import { RenderQueue } from '../render_queue';
import { Camera } from '../camera';
import { RenderPass } from './renderpass';
import { ShaderLib } from '../materiallib';
import { RENDER_PASS_TYPE_MULTI_FORWARD, MATERIAL_FUNC_NORMAL } from '../values';
import { LightType, PunctualLight } from '../light';
import type { DrawContext } from '../drawable';
import type { RenderScheme } from './renderscheme';

export class ForwardMultiRenderPass extends RenderPass {
  /** @internal */
  protected _overriddenState: RenderStateSet;
  /** @internal */
  protected _overriddenStateTrans: RenderStateSet;
  /** @internal */
  protected _currentLight: PunctualLight;
  constructor(renderScheme: RenderScheme, name: string) {
    super(renderScheme, name);
    this._overriddenState = renderScheme.device.createRenderStateSet();
    this._overriddenState.useBlendingState().enable(true).setBlendFunc(BlendFunc.ONE, BlendFunc.ONE);
    this._overriddenStateTrans = renderScheme.device.createRenderStateSet();
    this._overriddenStateTrans.useBlendingState().enable(true).setBlendFunc(BlendFunc.ONE, BlendFunc.INV_SRC_ALPHA);
    this._overriddenStateTrans.useDepthState().enableTest(true).enableWrite(false);
    this._currentLight = null;
  }
  get light(): PunctualLight {
    return this._currentLight;
  }
  getRenderPassType(): number {
    return RENDER_PASS_TYPE_MULTI_FORWARD;
  }
  /** @internal */
  protected _getGlobalBindGroupHash(ctx: DrawContext) {
    const shadowMapHash = ctx.shadowMapper ? ctx.shadowMapper.shaderHash : '';
    return `${this._currentLight?.lightType || LightType.NONE}:${ctx.environment?.constructor.name || ''}:${shadowMapHash}`;
  }
  /** @internal */
  protected setLightUniforms(bindGroup: BindGroup, ctx: DrawContext, light: PunctualLight) {
    if (light) {
      bindGroup.setValue('global', {
        light: {
          positionAndRange: light.positionAndRange,
          directionAndCutoff: light.directionAndCutoff,
          diffuseAndIntensity: light.diffuseAndIntensity,
          shadowMatrix: light.shadow.shadowMatrices,
          splitDistances: light.shadow.cascadeDistances,
          depthBias: light.shadow.depthBiasValues,
          shadowCascades: light.shadow.numShadowCascades,
          shadowCameraParams: light.shadow.shadowCameraParams,
          depthBiasScales: light.shadow.depthBiasScales,
          lightType: light.lightType,
          envLightStrength: light.scene.envLightStrength,
        }
      });
      if (ctx.shadowMapper) {
        bindGroup.setTexture('shadowMap', ctx.shadowMapper.shadowMap, ctx.shadowMapper.shadowMapSampler);
      }
    }
    ctx.environment?.updateBindGroup(bindGroup);
  }
  /** @internal */
  setGlobalBindings(scope: PBGlobalScope, ctx: DrawContext) {
    const pb = scope.$builder;
    const structCamera = pb.defineStruct(
      null,
      null,
      pb.vec3('position'),
      pb.mat4('viewProjectionMatrix'),
      pb.mat4('viewMatrix'),
      pb.mat4('projectionMatrix'),
      pb.vec4('params'),
    );
    const structLight = pb.defineStruct(
      null,
      null,
      pb.vec4('positionAndRange'),
      pb.vec4('directionAndCutoff'),
      pb.vec4('diffuseAndIntensity'),
      pb.vec4('splitDistances'),
      pb.vec4('depthBias'),
      pb.vec4('shadowCameraParams'),
      pb.vec4('depthBiasScales'),
      pb.vec4[16]('shadowMatrix'),
      pb.int('shadowCascades'),
      pb.int('lightType'),
      pb.float('envLightStrength'),
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
        params: ShaderLib.USAGE_CAMERA_PARAMS,
      },
      light: {
        envLightStrength: ShaderLib.USAGE_ENV_LIGHT_STRENGTH,
      }
    });
    if (ctx.shadowMapper) {
      const shadowTex = ctx.shadowMapper.shadowMap.isTexture2D() ? pb.tex2D() : pb.texCube();
      if (!this.device.getTextureCaps().getTextureFormatInfo(ctx.shadowMapper.shadowMap.format).filterable) {
        shadowTex.sampleType('unfilterable-float');
      }
      pb.globalScope.shadowMap = shadowTex.uniform(0);
    }
    ctx.environment?.initShaderBindings(pb);
  }
  /** @internal */
  protected renderItems(camera: Camera, renderQueue: RenderQueue, lightList: PunctualLight[]) {
    const ctx: DrawContext = {
      camera,
      target: null,
      materialFunc: MATERIAL_FUNC_NORMAL,
      renderPass: this,
      renderPassHash: null,
    };
    const device = this._renderScheme.device;
    const env = camera.scene.environment;
    const flip = this.isAutoFlip();
    renderQueue.sortItems();

    lightList = lightList?.length > 0 ? lightList : [null];
    for (const order of Object.keys(renderQueue.items).map(val => Number(val)).sort((a, b) => a - b)) {
      const items = renderQueue.items[order];
      const lists = [items.opaqueList, items.transList];
      const overriddenBlendingStates = [this._overriddenState, this._overriddenStateTrans];
      const bindGroupNoLight = this.getGlobalBindGroup(ctx);
      for (let i = 0; i < 2; i++) {
        const list = lists[i];
        if (list?.length > 0) {
          const overridden = overriddenBlendingStates[i];
          // draw unlit objects
          this._currentLight = null;
          this.device.setBindGroup(0, bindGroupNoLight);
          this.setCameraUniforms(bindGroupNoLight, ctx, this._verticalFlip !== flip);
          ctx.renderPassHash = this.getGlobalBindGroupHash(ctx);
          // this.setLightUniforms(globalBindGroupNoEnv, ctx, null);
          for (const item of list) {
            if (item.drawable.isUnlit()) {
              ctx.instanceData = item.instanceData;
              ctx.target = item.drawable;
              item.drawable.draw(ctx);
            }
          }
          // draw lightable objects
          for (let index = 0; index < lightList.length; index++) {
            const light = lightList[index];
            this._currentLight = light;
            if (light?.castShadow) {
              ctx.shadowMapper = light.shadow;
            } else {
              ctx.shadowMapper = null;
            }
            let bindGroup: BindGroup;
            if (index > 0) {
              device.setRenderStatesOverridden(overridden);
              ctx.environment = null;
              bindGroup = this.getGlobalBindGroup(ctx);
            } else {
              ctx.environment = env;
              ctx.envStrength = camera.scene.envLightStrength;
              bindGroup = this.getGlobalBindGroup(ctx);
            }
            device.setBindGroup(0, bindGroup);
            if (ctx.shadowMapper) {
              bindGroup.setTexture('shadowMap', ctx.shadowMapper.shadowMap, ctx.shadowMapper.shadowMapSampler);
            }
            this.setCameraUniforms(bindGroup, ctx, this._verticalFlip !== flip);
            this.setLightUniforms(bindGroup, ctx, light);
            ctx.renderPassHash = this.getGlobalBindGroupHash(ctx);
            for (const item of list) {
              if (!item.drawable.isUnlit()) {
                ctx.instanceData = item.instanceData;
                ctx.target = item.drawable;
                item.drawable.draw(ctx);
              }
            }
          }
          this._currentLight = null;
          device.setRenderStatesOverridden(null);
        }
      }
    }
  }
}
