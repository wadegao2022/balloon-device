import { Vector4 } from '../math';
import { PrimitiveType, TextureFormat } from './base_types';
import { REventTarget, REvent, TypedArray } from '../../shared';
import { CPUTimer, ITimer } from './timer';
import type { RenderStateSet } from './render_states';
import type { VertexData } from './vertexdata';
import type {
  IFrameBufferOptions,
  SamplerOptions,
  TextureSampler,
  Texture2D,
  Texture3D,
  TextureCube,
  VertexInputLayout,
  GPUDataBuffer,
  FrameBuffer,
  BaseTexture,
  GPUProgram,
  GPUObject,
  StructuredBuffer,
  BindGroupLayout,
  BindGroup,
  IndexBuffer,
  TextureVideo,
  TextureMipmapData,
  TextureImageElement,
  Texture2DArray
} from './gpuobject';
import { PBStructTypeInfo } from './builder';

interface GPUObjectList {
  textures: BaseTexture[];
  samplers: TextureSampler[];
  buffers: GPUDataBuffer[];
  programs: GPUProgram[];
  framebuffers: FrameBuffer[];
  vertexArrayObjects: VertexInputLayout[];
  bindGroups: BindGroup[];
}

export interface FramebufferCaps {
  maxDrawBuffers: number;
  supportDrawBuffers: boolean;
  supportRenderMipmap: boolean;
}

export interface MiscCaps {
  supportBlendMinMax: boolean;
  support32BitIndex: boolean;
  supportLoseContext: boolean;
  supportDebugRendererInfo: boolean;
  supportSharedUniforms: boolean;
}

export interface ShaderCaps {
  supportFragmentDepth: boolean;
  supportStandardDerivatives: boolean;
  supportShaderTextureLod: boolean;
  supportHighPrecisionFloat: boolean;
  supportHighPrecisionInt: boolean;
  maxUniformBufferSize: number;
  uniformBufferOffsetAlignment: number;
}

export interface ITextureFormatInfo {
  filterable: boolean;
  renderable: boolean;
  compressed: boolean;
}

export interface TextureCaps {
  maxTextureSize: number;
  maxCubeTextureSize: number;
  npo2Mipmapping: boolean;
  npo2Repeating: boolean;
  supportS3TC: boolean;
  supportS3TCSRGB: boolean;
  supportDepthTexture: boolean;
  support3DTexture: boolean;
  supportSRGBTexture: boolean;
  supportFloatTexture: boolean;
  supportLinearFloatTexture: boolean;
  supportHalfFloatTexture: boolean;
  supportLinearHalfFloatTexture: boolean;
  supportAnisotropicFiltering: boolean;
  supportFloatColorBuffer: boolean;
  supportHalfFloatColorBuffer: boolean;
  supportFloatBlending: boolean;
  getTextureFormatInfo(format: TextureFormat): ITextureFormatInfo;
}

export type DeviceTypeWebGL = 'webgl' | 'webgl2';
export type DeviceTypeWebGPU = 'webgpu';
export type DeviceType = DeviceTypeWebGL | DeviceTypeWebGPU;
export const DEVICE_TYPE_WEBGL = 'webgl';
export const DEVICE_TYPE_WEBGL2 = 'webgl2';
export const DEVICE_TYPE_WEBGPU = 'webgpu';

export interface RenderProgramConstructParams {
  vs: string;
  fs: string;
  bindGroupLayouts: BindGroupLayout[],
  vertexAttributes: number[],
}

export interface ComputeProgramConstructParams {
  source: string;
  bindGroupLayouts: BindGroupLayout[],
}

export interface GPUProgramConstructParams {
  type: 'render' | 'compute';
  label?: string;
  params: RenderProgramConstructParams | ComputeProgramConstructParams;
}

export class DeviceResizeEvent extends REvent {
  static readonly NAME = 'resize';
  width: number;
  height: number;
  constructor(width: number, height: number) {
    super(DeviceResizeEvent.NAME, false, false);
    this.width = width;
    this.height = height;
  }
}

export class DeviceFrameBegin extends REvent {
  static readonly NAME = 'framebegin';
  device: Device;
  constructor(device: Device) {
    super(DeviceFrameBegin.NAME, false, false);
    this.device = device;
  }
}

export class DeviceFrameEnd extends REvent {
  static readonly NAME = 'frameend';
  device: Device;
  constructor(device: Device) {
    super(DeviceFrameEnd.NAME, false, false);
    this.device = device;
  }
}

export interface FrameInfo {
  frameCounter: number;
  frameTimestamp: number;
  elapsedTimeCPU: number;
  elapsedTimeGPU: number;
  elapsedFrame: number;
  elapsedOverall: number;
  FPS: number;
  drawCalls: number;
  computeCalls: number;
  nextFrameCall: (() => void)[];
}

export class DeviceGPUObjectAddedEvent extends REvent {
  static readonly NAME = 'gpuobject_added';
  object: GPUObject;
  constructor(obj: GPUObject) {
    super(DeviceGPUObjectAddedEvent.NAME, false, false);
    this.object = obj;
  }
}

export class DeviceGPUObjectRemovedEvent extends REvent {
  static readonly NAME = 'gpuobject_removed';
  object: GPUObject;
  constructor(obj: GPUObject) {
    super(DeviceGPUObjectRemovedEvent.NAME, false, false);
    this.object = obj;
  }
}

export class DeviceGPUObjectRenameEvent extends REvent {
  static readonly NAME = 'gpuobject_rename';
  object: GPUObject;
  lastName: string;
  constructor(obj: GPUObject, lastName: string) {
    super(DeviceGPUObjectRenameEvent.NAME, false, false);
    this.object = obj;
    this.lastName = lastName;
  }
}

export class DeviceLostEvent extends REvent {
  static readonly NAME = 'device_lost';
  constructor() {
    super(DeviceLostEvent.NAME, false, false);
  }
}

export class DeviceRestoreEvent extends REvent {
  static readonly NAME = 'device_restored';
  constructor() {
    super(DeviceRestoreEvent.NAME, false, false);
  }
}

export interface DeviceOptions {
  msaa?: boolean;
  dpr?: number;
}

export abstract class Device extends REventTarget {
  /** @internal */
  protected _gpuObjectList: GPUObjectList;
  protected _gpuMemCost: number;
  protected _disposeObjectList: GPUObject[];
  protected _beginFrameTime: number;
  protected _endFrameTime: number;
  protected _frameInfo: FrameInfo;
  protected _cpuTimer: CPUTimer;
  protected _gpuTimer: ITimer;
  protected _runningLoop: number;
  protected _frameBeginEvent: DeviceFrameBegin;
  protected _frameEndEvent: DeviceFrameEnd;
  protected _fpsCounter: { time: number, frame: number };
  protected _runLoopFunc: (device: Device) => void;
  constructor() {
    super();
    this._gpuObjectList = {
      textures: [],
      samplers: [],
      buffers: [],
      programs: [],
      framebuffers: [],
      vertexArrayObjects: [],
      bindGroups: []
    };
    this._gpuMemCost = 0;
    this._disposeObjectList = [];
    this._beginFrameTime = 0;
    this._endFrameTime = 0;
    this._runLoopFunc = null;
    this._frameInfo = {
      frameCounter: 0,
      frameTimestamp: 0,
      elapsedTimeCPU: 0,
      elapsedTimeGPU: 0,
      elapsedFrame: 0,
      elapsedOverall: 0,
      FPS: 0,
      drawCalls: 0,
      computeCalls: 0,
      nextFrameCall: []
    };
    this._cpuTimer = new CPUTimer();
    this._gpuTimer = null;
    this._runningLoop = null;
    this._fpsCounter = { time: 0, frame: 0 };
    this._frameBeginEvent = new DeviceFrameBegin(this);
    this._frameEndEvent = new DeviceFrameEnd(this);
  }
  abstract getDeviceType(): DeviceType;
  abstract getCanvas(): HTMLCanvasElement;
  abstract isContextLost(): boolean;
  abstract getScale(): number;
  abstract getDrawingBufferWidth(): number;
  abstract getDrawingBufferHeight(): number;
  abstract getBackBufferWidth(): number;
  abstract getBackBufferHeight(): number;
  abstract getTextureCaps(): TextureCaps;
  abstract getFramebufferCaps(): FramebufferCaps;
  abstract getMiscCaps(): MiscCaps;
  abstract getShaderCaps(): ShaderCaps;
  abstract initContext(): Promise<void>;
  abstract clearFrameBuffer(clearColor: Vector4, clearDepth: number, clearStencil: number);
  abstract createGPUTimer(): ITimer;
  abstract createRenderStateSet(): RenderStateSet;
  abstract createSampler(options: SamplerOptions): TextureSampler;
  abstract createTexture2D(format: TextureFormat, width: number, height: number, creationFlags?: number): Texture2D;
  abstract createTexture2DFromMipmapData(data: TextureMipmapData, creationFlags?: number): Texture2D;
  abstract createTexture2DFromImage(element: TextureImageElement, creationFlags?: number): Texture2D;
  abstract loadTexture2DFromURL(url: string, mimeType?: string, creationFlags?: number): Promise<Texture2D>;
  abstract createTexture2DArray(format: TextureFormat, width: number, height: number, depth: number, creationFlags?: number): Texture2DArray;
  abstract createTexture3D(format: TextureFormat, width: number, height: number, depth: number, creationFlags?: number): Texture3D;
  abstract createCubeTexture(format: TextureFormat, size: number, creationFlags?: number): TextureCube;
  abstract createCubeTextureFromMipmapData(data: TextureMipmapData, creationFlags?: number): TextureCube;
  abstract loadCubeTextureFromURL(url: string, mimeType?: string, creationFlags?: number): Promise<TextureCube>;
  abstract createTextureVideo(el: HTMLVideoElement): TextureVideo;
  abstract reverseVertexWindingOrder(reverse: boolean): void;
  abstract isWindingOrderReversed(): boolean;
  abstract setRenderStatesOverridden(renderStates: RenderStateSet);
  // program
  abstract createGPUProgram(params: GPUProgramConstructParams): GPUProgram;
  abstract createBindGroup(layout: BindGroupLayout): BindGroup;
  abstract createBuffer(sizeInBytes: number, usage?: number): GPUDataBuffer;
  abstract createIndexBuffer(data: Uint16Array | Uint32Array, usage?: number): IndexBuffer;
  abstract createStructuredBuffer(structureType: PBStructTypeInfo, usage: number, data?: TypedArray): StructuredBuffer;
  abstract createVAO(vertexData: VertexData): VertexInputLayout;
  abstract createFrameBuffer(options?: IFrameBufferOptions): FrameBuffer;
  // render related
  abstract setViewport(vp?: number[]): number[];
  abstract setViewport(x: number, y: number, w: number, h: number): void;
  abstract getViewport(): number[];
  abstract setScissor(scissor?: number[]): number[];
  abstract setScissor(x: number, y: number, w: number, h: number): void;
  abstract getScissor(): number[]
  abstract setProgram(program: GPUProgram): void;
  abstract getProgram(): GPUProgram;
  abstract setVertexData(vertexData: VertexInputLayout): void;
  abstract getVertexData(): VertexInputLayout;
  abstract setRenderStates(renderStates: RenderStateSet): void;
  abstract getRenderStates(): RenderStateSet;
  abstract setFramebuffer(rt: FrameBuffer): void;
  abstract getFramebuffer(): FrameBuffer;
  abstract setBindGroup(index: number, bindGroup: BindGroup, dynamicOffsets?: Iterable<number>);
  abstract flush(): void;
  // misc
  abstract readPixels(x: number, y: number, w: number, h: number, buffer: TypedArray): Promise<void>;
  abstract readPixelsToBuffer(x: number, y: number, w: number, h: number, buffer: GPUDataBuffer): void;
  abstract looseContext(): void;
  abstract restoreContext(): void;
  // draw
  protected abstract _draw(primitiveType: PrimitiveType, first: number, count: number): void;
  protected abstract _drawInstanced(primitiveType: PrimitiveType, first: number, count: number, numInstances: number): void;
  protected abstract _compute(workgroupCountX, workgroupCountY, workgroupCountZ): void;

  get videoMemoryUsage(): number {
    return this._gpuMemCost;
  }
  get frameInfo(): FrameInfo {
    return this._frameInfo;
  }
  get isRendering(): boolean {
    return this._runningLoop !== null;
  }
  disposeObject(obj: GPUObject, remove = true) {
    if (obj) {
      if (remove) {
        this.removeGPUObject(obj);
      }
      if (!obj.disposed) {
        if (this.isContextLost()) {
          obj.destroy();
        } else {
          this._disposeObjectList.push(obj);
        }
      }
    }
  }
  async restoreObject(obj: GPUObject) {
    if (obj && obj.disposed && !this.isContextLost()) {
      await obj.restore();
      if (obj.restoreHandler) {
        await obj.restoreHandler(obj);
      }
    }
  }
  enableGPUTimeRecording(enable: boolean) {
    if (enable && !this._gpuTimer) {
      this._gpuTimer = this.createGPUTimer();
    } else if (!enable) {
      this._gpuTimer?.end();
      this._gpuTimer = null;
    }
  }
  beginFrame(): boolean {
    for (const obj of this._disposeObjectList) {
      obj.destroy();
    }
    this._disposeObjectList = [];
    this._beginFrameTime = this._cpuTimer.now();
    this.updateFrameInfo();
    this._frameBeginEvent.reset();
    this.dispatchEvent(this._frameBeginEvent);
    return this.onBeginFrame();
  }
  endFrame(): void {
    this._endFrameTime = this._cpuTimer.now();
    this._frameEndEvent.reset();
    this.dispatchEvent(this._frameEndEvent);
    this.onEndFrame();
  }
  draw(primitiveType: PrimitiveType, first: number, count: number): void {
    this._frameInfo.drawCalls++;
    this._draw(primitiveType, first, count);
  }
  drawInstanced(primitiveType: PrimitiveType, first: number, count: number, numInstances: number): void {
    this._frameInfo.drawCalls++;
    this._drawInstanced(primitiveType, first, count, numInstances);
  }
  compute(workgroupCountX, workgroupCountY, workgroupCountZ): void {
    this._frameInfo.computeCalls++;
    this._compute(workgroupCountX, workgroupCountY, workgroupCountZ);
  }
  runNextFrame(f: () => void) {
    if (f) {
      this._frameInfo.nextFrameCall.push(f);
    }
  }
  cancelNextFrameCall(f: () => void) {
    const index = this._frameInfo.nextFrameCall.indexOf(f);
    if (index >= 0) {
      this._frameInfo.nextFrameCall.splice(index, 1);
    }
  }
  exitLoop() {
    if (this._runningLoop) {
      cancelAnimationFrame(this._runningLoop);
      this._runningLoop = null;
    }
  }
  runLoop(func: (device: Device) => void) {
    if (this._runningLoop !== null) {
      console.error('Device.runLoop() can not be nested');
      return;
    }
    if (!func) {
      console.error('Device.runLoop() argment error');
      return;
    }
    const that = this;
    that._runLoopFunc = func;
    (function entry() {
      that._runningLoop = requestAnimationFrame(entry);
      if (that.beginFrame()) {
        that._runLoopFunc(that);
        that.endFrame();
      }
    }());
  }
  getGPUObjects(): GPUObjectList {
    return this._gpuObjectList;
  }
  getGPUObjectById(uid: number): GPUObject {
    for (const list of [
      this._gpuObjectList.textures,
      this._gpuObjectList.samplers,
      this._gpuObjectList.buffers,
      this._gpuObjectList.framebuffers,
      this._gpuObjectList.programs,
      this._gpuObjectList.vertexArrayObjects
    ]) {
      for (const obj of list) {
        if (obj.uid === uid) {
          return obj;
        }
      }
    }
    return null;
  }
  screenToDevice(val: number): number {
    return this.getFramebuffer() ? val : Math.round(val * this.getScale());
  }
  deviceToScreen(val: number): number {
    return this.getFramebuffer() ? val : Math.round(val / this.getScale());
  }
  /** @internal */
  addGPUObject(obj: GPUObject) {
    const list = this.getGPUObjectList(obj);
    if (list && list.indexOf(obj) < 0) {
      list.push(obj);
      this.dispatchEvent(new DeviceGPUObjectAddedEvent(obj));
    }
  }
  /** @internal */
  removeGPUObject(obj: GPUObject) {
    const list = this.getGPUObjectList(obj);
    if (list) {
      const index = list.indexOf(obj);
      if (index >= 0) {
        list.splice(index, 1);
        this.dispatchEvent(new DeviceGPUObjectRemovedEvent(obj));
      }
    }
  }
  /** @internal */
  updateVideoMemoryCost(delta: number) {
    this._gpuMemCost += delta;
  }
  /** @internal */
  protected abstract onBeginFrame(): boolean;
  /** @internal */
  protected abstract onEndFrame(): void;
  /** @internal */
  private updateFrameInfo() {
    this._frameInfo.frameCounter++;
    this._frameInfo.drawCalls = 0;
    this._frameInfo.computeCalls = 0;
    const now = this._beginFrameTime;
    if (this._frameInfo.frameTimestamp === 0) {
      this._frameInfo.frameTimestamp = now;
      this._frameInfo.elapsedTimeCPU = 0;
      this._frameInfo.elapsedTimeGPU = 0;
      this._frameInfo.elapsedFrame = 0;
      this._frameInfo.elapsedOverall = 0;
      this._frameInfo.FPS = 0;
      this._fpsCounter.time = now;
      this._fpsCounter.frame = this._frameInfo.frameCounter;
      if (this._gpuTimer) {
        this._gpuTimer.begin();
      }
    } else {
      this._frameInfo.elapsedFrame = now - this._frameInfo.frameTimestamp;
      this._frameInfo.elapsedOverall += this._frameInfo.elapsedFrame;
      if (this._endFrameTime !== 0) {
        this._frameInfo.elapsedTimeGPU = now - this._endFrameTime;
        this._frameInfo.elapsedTimeCPU = this._endFrameTime - this._frameInfo.frameTimestamp;
      }
      this._frameInfo.frameTimestamp = now;
      if (now >= this._fpsCounter.time + 1000) {
        this._frameInfo.FPS = (this._frameInfo.frameCounter - this._fpsCounter.frame) * 1000 / (now - this._fpsCounter.time);
        this._fpsCounter.time = now;
        this._fpsCounter.frame = this._frameInfo.frameCounter;
      }
    }
    for (const f of this._frameInfo.nextFrameCall) {
      f();
    }
    this._frameInfo.nextFrameCall.length = 0;
  }
  /** @internal */
  private getGPUObjectList(obj: GPUObject): GPUObject[] {
    let list: GPUObject[] = null;
    if (obj.isTexture()) {
      list = this._gpuObjectList.textures;
    } else if (obj.isSampler()) {
      list = this._gpuObjectList.samplers;
    } else if (obj.isBuffer()) {
      list = this._gpuObjectList.buffers;
    } else if (obj.isFramebuffer()) {
      list = this._gpuObjectList.framebuffers;
    } else if (obj.isProgram()) {
      list = this._gpuObjectList.programs;
    } else if (obj.isVAO()) {
      list = this._gpuObjectList.vertexArrayObjects;
    } else if (obj.isBindGroup()) {
      list = this._gpuObjectList.bindGroups;
    }
    return list;
  }
  /** @internal */
  protected invalidateAll() {
    for (const list of [
      this._gpuObjectList.buffers,
      this._gpuObjectList.textures,
      this._gpuObjectList.samplers,
      this._gpuObjectList.programs,
      this._gpuObjectList.framebuffers,
      this._gpuObjectList.vertexArrayObjects,
      this._gpuObjectList.bindGroups
    ]) {
      for (const obj of list) {
        this.disposeObject(obj, false);
      }
    }
    if (this.isContextLost()) {
      for (const obj of this._disposeObjectList) {
        obj.destroy();
      }
      this._disposeObjectList = [];
    }
  }
  /** @internal */
  protected async reloadAll() {
    const promises: Promise<void>[] = [];
    for (const list of [
      this._gpuObjectList.buffers,
      this._gpuObjectList.textures,
      this._gpuObjectList.samplers,
      this._gpuObjectList.programs,
      this._gpuObjectList.framebuffers,
      this._gpuObjectList.vertexArrayObjects,
      this._gpuObjectList.bindGroups
    ]) {
      // obj.reload() may change the list, so make a copy first
      for (const obj of list.slice()) {
        promises.push(obj.reload());
      }
    }
    return Promise.all(promises);
  }
}
