import { Vector4, Matrix4x4, Quaternion, CubeFace } from '../../math';
import { Device, ProgramBuilder, FrameBuffer, BindGroup, PBGlobalScope } from '../../device';
import { CullVisitor } from '../visitors/cull_visitor';
import { RenderQueue } from '../render_queue';
import { Material } from '../material';
import { RENDER_PASS_TYPE_UNKNOWN } from '../values';
import type { Scene } from '../scene';
import type { PunctualLight } from '../light';
import type { RenderScheme } from './renderscheme';
import type { DrawContext } from '../drawable';
import type { Camera } from '../camera';

const cubeFaceList = [
  CubeFace.PX,
  CubeFace.NX,
  CubeFace.PY,
  CubeFace.NY,
  CubeFace.PZ,
  CubeFace.NZ,
];

export type GlobalLightStruct = {
  positionAndRange: Vector4;
  directionAndCutoff: Vector4;
  diffuseAndIntensity: Vector4;
  viewMatrix: Matrix4x4;
  viewProjMatrix: Matrix4x4;
  lightType: number;
  envLightStrength?: number;
};

export abstract class RenderPass {
  /** @internal */
  protected _globalBindGroups: { [hash: string]: BindGroup };
  /** @internal */
  protected _renderScheme: RenderScheme;
  /** @internal */
  protected _name: string;
  /** @internal */
  protected _mainCamera: Camera;
  /** @internal */
  protected _cullCamera: Camera;
  /** @internal */
  protected _renderQueue: RenderQueue;
  /** @internal */
  protected _cullVisitor: CullVisitor;
  /** @internal */
  protected _clearColor: Vector4;
  /** @internal */
  protected _clearDepth: number;
  /** @internal */
  protected _clearStencil: number;
  /** @internal */
  protected _clearColorEnabled: boolean;
  /** @internal */
  protected _clearDepthEnabled: boolean;
  /** @internal */
  protected _clearStencilEnabled: boolean;
  /** @internal */
  protected _viewport: number[];
  /** @internal */
  protected _scissor: number[];
  /** @internal */
  protected _errorFlagNoCamera: boolean;
  /** @internal */
  protected _verticalFlip: boolean;
  /** @internal */
  protected _renderTimeStamp: number;
  constructor(renderScheme: RenderScheme, name: string) {
    this._renderScheme = renderScheme;
    this._name = name;
    this._mainCamera = null;
    this._cullCamera = null;
    this._renderQueue = null;
    this._clearColor = new Vector4(0, 0, 0, 1);
    this._clearDepth = 1;
    this._clearStencil = 0;
    this._clearColorEnabled = true;
    this._clearDepthEnabled = true;
    this._clearStencilEnabled = true;
    this._globalBindGroups = {};
    this._cullVisitor = new CullVisitor(this);
    this._viewport = null;
    this._scissor = null;
    this._errorFlagNoCamera = false;
    this._verticalFlip = false;
    this._renderTimeStamp = 0;
  }
  get name(): string {
    return this._name;
  }
  get renderScheme(): RenderScheme {
    return this._renderScheme;
  }
  get device(): Device {
    return this._renderScheme.device;
  }
  get cullCamera(): Camera {
    return this._cullCamera;
  }
  set cullCamera(camera: Camera) {
    this._cullCamera = camera;
  }
  get mainCamera(): Camera {
    return this._mainCamera;
  }
  get renderQueue(): RenderQueue {
    return this._renderQueue;
  }
  set renderQueue(list: RenderQueue) {
    this._renderQueue = list;
  }
  get clearColor(): Vector4 {
    return this._clearColor;
  }
  set clearColor(color: Vector4) {
    this._clearColor.assign(color.getArray());
  }
  get clearDepth(): number {
    return this._clearDepth;
  }
  set clearDepth(depth: number) {
    this._clearDepth = depth;
  }
  get clearStencil(): number {
    return this._clearStencil;
  }
  set clearStencil(stencil: number) {
    this._clearStencil = stencil;
  }
  get viewport(): number[] {
    return this._viewport ? [...this._viewport] : null;
  }
  set viewport(vp: number[]) {
    this._viewport = vp ? [...vp] : null;
  }
  get scissor(): number[] {
    return this._scissor ? [...this._scissor] : null;
  }
  set scissor(scissor: number[]) {
    this._scissor = scissor ? [...scissor] : null;
  }
  get cullVisitor(): CullVisitor {
    return this._cullVisitor;
  }
  set cullVisitor(visitor: CullVisitor) {
    this._cullVisitor = visitor;
  }
  get verticalFlip(): boolean {
    return this._verticalFlip;
  }
  set verticalFlip(b: boolean) {
    this._verticalFlip = !!b;
  }
  get renderTimeStamp(): number {
    return this._renderTimeStamp;
  }
  getRenderPassType(): number {
    return RENDER_PASS_TYPE_UNKNOWN;
  }
  isAutoFlip(): boolean {
    return !!(this._renderScheme.device.getFramebuffer() && this._renderScheme.device.getDeviceType() === 'webgpu');
  }
  enableClear(color: boolean, depthStencil: boolean) {
    this._clearColorEnabled = !!color;
    this._clearDepthEnabled = !!depthStencil;
    this._clearStencilEnabled = !!depthStencil;
  }
  render(scene: Scene, camera: Camera) {
    this._mainCamera = camera;
    const device = this._renderScheme.device;
    this._renderTimeStamp = device.frameInfo.frameTimestamp;
    const cullCamera = this._cullCamera || camera;
    this.drawScene(scene, camera, cullCamera, false);
    this._mainCamera = null;
  }
  renderToCubeTexture(scene: Scene, camera: Camera, frameBuffer: FrameBuffer) {
    this._mainCamera = camera;
    const device = this._renderScheme.device;
    this._renderTimeStamp = device.frameInfo.frameTimestamp;
    const cullCamera = this._cullCamera || camera;
    const saveRT = device.getFramebuffer();
    const saveViewport = device.getViewport();
    const saveScissor = device.getScissor();

    const r = new Quaternion(camera.rotation);
    const savedProjMatrix = camera.projectionMatrix;
    const znear = camera.getNearPlane();
    const zfar = camera.getFarPlane();
    camera.projectionMatrix = Matrix4x4.perspective(Math.PI / 2, 1, znear, zfar);
    this._renderScheme.device.setFramebuffer(frameBuffer);
    for (const face of cubeFaceList) {
      camera.lookAtCubeFace(face);
      frameBuffer.setCubeTextureFace(0, face);
      this.drawScene(scene, camera, cullCamera, false);
    }
    camera.rotation = r;
    camera.projectionMatrix = savedProjMatrix;

    device.setFramebuffer(saveRT);
    device.setViewport(saveViewport);
    device.setScissor(saveScissor);
    this._mainCamera = null;
  }
  renderToTexture(scene: Scene, camera: Camera, frameBuffer: FrameBuffer) {
    this._mainCamera = camera;
    const device = this._renderScheme.device;
    this._renderTimeStamp = device.frameInfo.frameTimestamp;
    const cullCamera = this._cullCamera || camera;
    const saveRT = device.getFramebuffer();
    const saveViewport = device.getViewport();
    const saveScissor = device.getScissor();
    this._renderScheme.device.setFramebuffer(frameBuffer);
    this.drawScene(scene, camera, cullCamera, false);
    this._renderScheme.device.setFramebuffer(saveRT);
    device.setFramebuffer(saveRT);
    device.setViewport(saveViewport);
    device.setScissor(saveScissor);
    this._mainCamera = null;
  }
  /** @internal */
  protected getGlobalBindGroup(ctx: DrawContext): BindGroup {
    const hash = this.getGlobalBindGroupHash(ctx);
    let bindGroup = this._globalBindGroups[hash];
    if (!bindGroup) {
      const that = this;
      const pb = new ProgramBuilder(this.device);
      const ret = pb.buildRender({
        vertex() {
          that.setGlobalBindings(this, ctx);
          this.$mainFunc(function () {
          });
        },
        fragment() {
          that.setGlobalBindings(this, ctx);
          this.$mainFunc(function () {
          });
        }
      });
      bindGroup = this.device.createBindGroup(ret[2][0]);
      this._globalBindGroups[hash] = bindGroup;
    }
    if (bindGroup.disposed) {
      bindGroup.reload();
    }
    return bindGroup;
  }
  dispose() {
    for (const k in this._globalBindGroups) {
      Material.bindGroupGarbageCollect(this._globalBindGroups[k]);
    }
    this._globalBindGroups = {};
  }
  /** @internal */
  getGlobalBindGroupHash(ctx: DrawContext) {
    return `${this.constructor.name}:${this._getGlobalBindGroupHash(ctx)}`;
  }
  /** @internal */
  abstract setGlobalBindings(scope: PBGlobalScope, ctx: DrawContext);
  /** @internal */
  protected abstract _getGlobalBindGroupHash(ctx: DrawContext);
  /** @internal */
  protected setCameraUniforms(bindGroup: BindGroup, ctx: DrawContext, flip: boolean) {
    const cameraStruct = {
      position: ctx.camera.worldMatrix.getRow(3).xyz(),
      viewProjectionMatrix: ctx.camera.viewProjectionMatrix,
      viewMatrix: ctx.camera.viewMatrix,
      projectionMatrix: ctx.camera.projectionMatrix,
      params: new Vector4(ctx.camera.getNearPlane(), ctx.camera.getFarPlane(), flip ? 1 : 0, ctx.camera.linearOutputEnabled ? 0 : 1)
    };
    bindGroup.setValue('global', {
      camera: cameraStruct
    });
  }
  /** @internal */
  protected drawSceneToTexture(scene: Scene, renderCamera: Camera, cullCamera: Camera, target: FrameBuffer, forceCull: boolean) {
    this._renderScheme.device.setFramebuffer(target);
    this.drawScene(scene, renderCamera, cullCamera, forceCull);
    this._renderScheme.device.setFramebuffer(null);
  }
  /** @internal */
  protected drawSceneToCubeTexture(scene: Scene, renderCamera: Camera, target: FrameBuffer) {
    const r = new Quaternion(renderCamera.rotation);
    const savedProjMatrix = renderCamera.projectionMatrix;
    const znear = renderCamera.getNearPlane();
    const zfar = renderCamera.getFarPlane();
    renderCamera.projectionMatrix = Matrix4x4.perspective(Math.PI / 2, 1, znear, zfar);
    for (const face of cubeFaceList) {
      renderCamera.lookAtCubeFace(face);
      target.setCubeTextureFace(0, face);
      this.drawSceneToTexture(scene, renderCamera, renderCamera, target, true);
    }
    renderCamera.rotation = r;
    renderCamera.projectionMatrix = savedProjMatrix;
  }
  /** @internal */
  protected abstract renderItems(camera: Camera, renderQueue: RenderQueue, lightList: PunctualLight[]);
  /** @internal */
  protected drawScene(scene: Scene, renderCamera: Camera, cullCamera: Camera, forceCull: boolean) {
    const device = this._renderScheme.device;
    device.setViewport(this._viewport);
    device.setScissor(this._scissor);
    this.clearFramebuffer();
    if (scene) {
      const renderQueue = this.cullScene(scene, cullCamera, forceCull);
      if (renderQueue) {
        const windingReversed = device.isWindingOrderReversed();
        device.reverseVertexWindingOrder(this._verticalFlip !== this.isAutoFlip());
        renderCamera.enableLinearOutput(!!device.getFramebuffer()?.getColorAttachments()[0]);
        this.renderItems(renderCamera, renderQueue, scene.lightList);
        device.reverseVertexWindingOrder(windingReversed);
      }
    }
  }
  cullScene(scene: Scene, cullCamera: Camera, force: boolean): RenderQueue {
    if (this._renderQueue && !force) {
      return this._renderQueue;
    } else {
      if (cullCamera) {
        this._cullVisitor.renderQueue.clear();
        this._cullVisitor.camera = cullCamera;
        if (scene.octree) {
          scene.octree.getRootNode().traverse(this._cullVisitor);
        } else {
          scene.rootNode.traverse(this._cullVisitor);
        }
        return this._cullVisitor.renderQueue;
      }
    }
    return null;
  }
  /** @internal */
  private clearFramebuffer() {
    const clearColor = this._clearColorEnabled ? this._clearColor : null;
    const clearDepth = this._clearDepthEnabled ? this._clearDepth : null;
    const clearStencil = this._clearStencilEnabled ? this._clearStencil : null;
    this._renderScheme.device.clearFrameBuffer(clearColor, clearDepth, clearStencil);
  }
}
