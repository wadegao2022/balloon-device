import { Vector4 } from '../../math';
import { getTextureFormatBlockSize, PrimitiveType, TextureFormat } from '../base_types';
import {
  IFrameBufferOptions,
  SamplerOptions,
  TextureSampler,
  Texture2D,
  Texture3D,
  Texture2DArray,
  TextureCube,
  TextureVideo,
  VertexInputLayout,
  GPUDataBuffer,
  FrameBuffer,
  GPUProgram,
  BindGroupLayout,
  BindGroup,
  IndexBuffer,
  StructuredBuffer,
  TextureMipmapData,
  TextureImageElement,
  GPUResourceUsageFlags
} from '../gpuobject';
import type { ITimer } from '../timer';
import { GPUProgramConstructParams, Device, DeviceType, TextureCaps, MiscCaps, FramebufferCaps, ShaderCaps, DeviceOptions } from '../device';
import { RenderStateSet } from '../render_states';
import { WebGPUTextureSampler } from './sampler_webgpu';
import { WebGPUProgram } from './gpuprogram_webgpu';
import { WebGPUBindGroup } from './bindgroup_webgpu';
import { WebGPUTexture2D } from './texture2d_webgpu';
import { WebGPUTexture2DArray } from './texture2darray_webgpu';
import { WebGPUTexture3D } from './texture3d_webgpu';
import { WebGPUTextureCube } from './texturecube_webgpu';
import { WebGPUTextureVideo } from './texturevideo_webgpu';
import { WebGPUTextureCap, WebGPUFramebufferCap, WebGPUMiscCap, WebGPUShaderCap } from './capabilities_webgpu';
import { WebGPUVertexInputLayout } from './vertexinputlayout_webgpu';
import { PipelineCache } from './pipeline_cache';
import { WebGPURenderStateSet } from './renderstates_webgpu';
import { WebGPUBuffer } from './buffer_webgpu';
import { WebGPUFrameBuffer } from './framebuffer_webgpu';
import { WebGPUIndexBuffer } from './indexbuffer_webgpu';
import { BindGroupCache } from './bindgroup_cache';
import { VertexLayoutCache } from './vertexinputlayout_cache';
import { SamplerCache } from './sampler_cache';
import { CommandQueueImmediate } from './commandqueue';
import { WebGPUStructuredBuffer } from './structuredbuffer_webgpu';
import { textureFormatInvMap } from './constants_webgpu';
import { WebGPUBaseTexture } from './basetexture_webgpu';
import type { VertexData } from '../vertexdata';
import type { PBStructTypeInfo } from '../builder';
import type { TypedArray } from '../../../shared';
import type { WebGPURenderPass } from './renderpass_webgpu';
import type { WebGPUComputePass } from './computepass_webgpu';

export class WebGPUDevice extends Device {
  private _context: GPUCanvasContext;
  private _canvas: HTMLCanvasElement;
  private _dpr: number;
  private _device: GPUDevice;
  private _adapter: GPUAdapter;
  private _textureCaps: WebGPUTextureCap;
  private _framebufferCaps: WebGPUFramebufferCap;
  private _miscCaps: WebGPUMiscCap;
  private _shaderCaps: WebGPUShaderCap;
  private _reverseWindingOrder: boolean;
  private _canRender: boolean;
  private _backBufferFormat: GPUTextureFormat;
  private _depthFormat: GPUTextureFormat;
  private _defaultMSAAColorTexture: GPUTexture;
  private _defaultMSAAColorTextureView: GPUTextureView;
  private _defaultDepthTexture: GPUTexture;
  private _defaultDepthTextureView: GPUTextureView;
  private _pipelineCache: PipelineCache;
  private _bindGroupCache: BindGroupCache;
  private _vertexLayoutCache: VertexLayoutCache;
  private _samplerCache: SamplerCache;
  private _renderStatesOverridden: WebGPURenderStateSet;
  private _currentProgram: WebGPUProgram;
  private _currentVertexData: WebGPUVertexInputLayout;
  private _currentStateSet: WebGPURenderStateSet;
  private _currentBindGroups: WebGPUBindGroup[];
  private _currentBindGroupOffsets: Iterable<number>[];
  private _commandQueue: CommandQueueImmediate;
  private _gpuObjectHashCounter: number;
  private _gpuObjectHasher: WeakMap<GPUObjectBase, number>;
  private _defaultRenderPassDesc: GPURenderPassDescriptor;
  private _sampleCount: number;
  constructor(cvs: HTMLCanvasElement, options?: DeviceOptions) {
    super();
    this._canvas = cvs;
    this._dpr = Math.ceil(options?.dpr ?? window.devicePixelRatio);
    this._device = null;
    this._adapter = null;
    this._context = null;
    this._reverseWindingOrder = false;
    this._defaultMSAAColorTexture = null;
    this._defaultMSAAColorTextureView = null;
    this._defaultDepthTexture = null;
    this._defaultDepthTextureView = null;
    this._pipelineCache = null;
    this._bindGroupCache = null;
    this._vertexLayoutCache = null;
    this._currentProgram = null;
    this._currentVertexData = null;
    this._currentStateSet = null;
    this._currentBindGroups = [];
    this._currentBindGroupOffsets = [];
    this._defaultRenderPassDesc = null;
    this._sampleCount = options?.msaa ? 4 : 1;

    this._textureCaps = null;
    this._framebufferCaps = null;
    this._miscCaps = null;
    this._shaderCaps = null;

    this._gpuObjectHasher = new WeakMap();
    this._gpuObjectHashCounter = 1;
    this._samplerCache = new SamplerCache(this);
    this._renderStatesOverridden = null;
  }
  get context() {
    return this._context;
  }
  get device(): GPUDevice {
    return this._device;
  }
  get adapter(): GPUAdapter {
    return this._adapter;
  }
  get drawingBufferWidth() {
    return this.getDrawingBufferWidth();
  }
  get drawingBufferHeight() {
    return this.getDrawingBufferHeight();
  }
  get clientWidth() {
    return this._canvas.clientWidth;
  }
  get clientHeight() {
    return this._canvas.clientHeight;
  }
  get pipelineCache(): PipelineCache {
    return this._pipelineCache;
  }
  get backbufferFormat(): GPUTextureFormat {
    return this._backBufferFormat;
  }
  get backbufferDepthFormat(): GPUTextureFormat {
    return this._depthFormat;
  }
  get defaultDepthTexture(): GPUTexture {
    return this._defaultDepthTexture;
  }
  get defaultDepthTextureView(): GPUTextureView {
    return this._defaultDepthTextureView;
  }
  get defaultMSAAColorTextureView(): GPUTextureView {
    return this._defaultMSAAColorTextureView;
  }
  get defaultRenderPassDesc(): GPURenderPassDescriptor {
    return this._defaultRenderPassDesc;
  }
  get sampleCount(): number {
    return this._sampleCount;
  }
  get currentPass(): WebGPURenderPass | WebGPUComputePass {
    return this._commandQueue.currentPass;
  }
  getCanvas(): HTMLCanvasElement {
    return this._canvas;
  }
  getScale(): number {
    return this._dpr;
  }
  isContextLost(): boolean {
    return false;
  }
  getDeviceType(): DeviceType {
    return 'webgpu';
  }
  getTextureCaps(): TextureCaps {
    return this._textureCaps;
  }
  getFramebufferCaps(): FramebufferCaps {
    return this._framebufferCaps;
  }
  getMiscCaps(): MiscCaps {
    return this._miscCaps;
  }
  getShaderCaps(): ShaderCaps {
    return this._shaderCaps;
  }
  getDrawingBufferWidth(): number {
    return this.getFramebuffer()?.getWidth() || this._canvas.width;
  }
  getDrawingBufferHeight(): number {
    return this.getFramebuffer()?.getHeight() || this._canvas.height;
  }
  getBackBufferWidth(): number {
    return this._canvas.width;
  }
  getBackBufferHeight(): number {
    return this._canvas.height;
  }
  async initContext() {
    if (!navigator.gpu) {
      throw new Error('No browser support for WebGPU');
    }
    this._adapter = await navigator.gpu.requestAdapter();
    if (!this._adapter) {
      throw new Error('WebGPU: requestAdapter() failed');
    }
    if (this._adapter.isFallbackAdapter) {
      console.warn('using a fallback adapter');
    }
    const featureNames = [
      'depth-clip-control',
      'depth24unorm-stencil8',
      'depth32float-stencil8',
      'texture-compression-bc',
      'texture-compression-etc2',
      'texture-compression-astc',
      'timestamp-query',
      'indirect-first-instance',
      'shader-f16'
    ].filter(val => this._adapter.features.has(val)) as GPUFeatureName[];
    this._device = await this._adapter.requestDevice({
      requiredFeatures: featureNames
    });
    if (!this._device) {
      throw new Error('WebGPU: requestDevice() failed');
    }
    console.log('WebGPU device features:');
    for (const feature of this._device.features) {
      console.log(` - ${feature}`);
    }
    this._context = this._canvas.getContext('webgpu') || null;
    if (!this._context) {
      this._canRender = false;
      throw new Error('WebGPU: getContext() failed');
    }
    this._canvas.width = this._canvas.clientWidth;
    this._canvas.height = this._canvas.clientHeight;
    this.configure();
    this._textureCaps = new WebGPUTextureCap(this);
    this._framebufferCaps = new WebGPUFramebufferCap(this);
    this._miscCaps = new WebGPUMiscCap(this);
    this._shaderCaps = new WebGPUShaderCap(this);

    this._pipelineCache = new PipelineCache(this);
    this._bindGroupCache = new BindGroupCache(this);
    this._vertexLayoutCache = new VertexLayoutCache();
    this._commandQueue = new CommandQueueImmediate(this);
    this._canRender = true;

    this.addDefaultEventListener('resize', evt => {
      const width = Math.max(1, Math.round(this._canvas.clientWidth * this._dpr));
      const height = Math.max(1, Math.round(this._canvas.clientHeight * this._dpr));
      if (width !== this._canvas.width || height !== this._canvas.height) {
        this._canvas.width = width;
        this._canvas.height = height;
        this.createDefaultRenderAttachments();
      }
    });
  }
  clearFrameBuffer(clearColor: Vector4, clearDepth: number, clearStencil: number) {
    this._commandQueue.clear(clearColor, clearDepth, clearStencil);
  }
  // factory
  createGPUTimer(): ITimer {
    // throw new Error('not implemented');
    return null;
  }
  createRenderStateSet(): RenderStateSet {
    return new WebGPURenderStateSet(this);
  }
  createSampler(options: SamplerOptions): TextureSampler {
    return this.fetchSampler(options);
  }
  createTexture2D(format: TextureFormat, width: number, height: number, creationFlags?: number): Texture2D {
    const tex = new WebGPUTexture2D(this);
    tex.createEmpty(format, width, height, creationFlags);
    return tex;
  }
  createTexture2DFromMipmapData(data: TextureMipmapData, creationFlags?: number): Texture2D {
    const tex = new WebGPUTexture2D(this);
    tex.createWithMipmapData(data, creationFlags);
    return tex;
  }
  createTexture2DFromImage(element: TextureImageElement, creationFlags?: number): Texture2D {
    const tex = new WebGPUTexture2D(this);
    tex.loadFromElement(element, creationFlags);
    return tex;
  }
  async loadTexture2DFromURL(url: string, mimeType?: string, creationFlags?: number): Promise<Texture2D> {
    const tex = new WebGPUTexture2D(this);
    await tex.loadFromURL(url, mimeType, creationFlags);
    return tex;
  }
  createTexture2DArray(format: TextureFormat, width: number, height: number, depth: number, creationFlags?: number): Texture2DArray {
    const tex = new WebGPUTexture2DArray(this);
    tex.createEmpty(format, width, height, depth, creationFlags);
    return tex;
  }
  createTexture3D(format: TextureFormat, width: number, height: number, depth: number, creationFlags?: number): Texture3D {
    const tex = new WebGPUTexture3D(this);
    tex.createEmpty(format, width, height, depth, creationFlags);
    return tex;
  }
  createCubeTexture(format: TextureFormat, size: number, creationFlags?: number): TextureCube {
    const tex = new WebGPUTextureCube(this);
    tex.createEmpty(format, size, creationFlags);
    return tex;
  }
  createCubeTextureFromMipmapData(data: TextureMipmapData, creationFlags?: number): TextureCube {
    const tex = new WebGPUTextureCube(this);
    tex.createWithMipmapData(data, creationFlags);
    return tex;
  }
  async loadCubeTextureFromURL(url: string, mimeType?: string, creationFlags?: number): Promise<TextureCube> {
    const tex = new WebGPUTextureCube(this);
    await tex.loadFromURL(url, mimeType, creationFlags);
    return tex;
  }
  createTextureVideo(el: HTMLVideoElement): TextureVideo {
    return new WebGPUTextureVideo(this, el);
  }
  createGPUProgram(params: GPUProgramConstructParams): GPUProgram {
    return new WebGPUProgram(this, params);
  }
  createBindGroup(layout: BindGroupLayout): BindGroup {
    return new WebGPUBindGroup(this, layout);
  }
  createBuffer(
    sizeInBytes: number,
    usage: number,
  ): GPUDataBuffer {
    return new WebGPUBuffer(this, usage, sizeInBytes);
  }
  createIndexBuffer(data: Uint16Array | Uint32Array, usage?: number): IndexBuffer<unknown> {
    return new WebGPUIndexBuffer(this, data, usage);
  }
  createStructuredBuffer(structureType: PBStructTypeInfo, usage: number, data?: TypedArray): StructuredBuffer {
    return new WebGPUStructuredBuffer(this, structureType, usage, data);
  }
  createVAO(data: VertexData): VertexInputLayout {
    return new WebGPUVertexInputLayout(this, data);
  }
  createFrameBuffer(options?: IFrameBufferOptions): FrameBuffer {
    return new WebGPUFrameBuffer(this, options);
  }
  setBindGroup(index: number, bindGroup: BindGroup, dynamicOffsets?: Iterable<number>) {
    this._currentBindGroups[index] = bindGroup as WebGPUBindGroup;
    this._currentBindGroupOffsets[index] = dynamicOffsets || null;
  }
  // render related
  setViewport(vp?: number[]);
  setViewport(x: number, y: number, w: number, h: number);
  setViewport(x?: number[] | number, y?: number, w?: number, h?: number) {
    if (x === null || x === undefined) {
      this._commandQueue.setViewport();
    } else if (Array.isArray(x)) {
      this._commandQueue.setViewport(x[0], x[1], x[2], x[3]);
    } else {
      this._commandQueue.setViewport(x, y, w, h);
    }
  }
  getViewport(): number[] {
    return this._commandQueue.getViewport();
  }
  setScissor(scissor?: number[]);
  setScissor(x: number, y: number, w: number, h: number): void;
  setScissor(x?: number[] | number, y?: number, w?: number, h?: number) {
    if (x === null || x === undefined) {
      this._commandQueue.setScissor();
    } else if (Array.isArray(x)) {
      this._commandQueue.setScissor(x[0], x[1], x[2], x[3]);
    } else {
      this._commandQueue.setScissor(x, y, w, h);
    }
  }
  getScissor(): number[] {
    return this._commandQueue.getScissor();
  }
  setProgram(program: GPUProgram) {
    this._currentProgram = program as WebGPUProgram;
  }
  getProgram(): GPUProgram {
    return this._currentProgram;
  }
  setVertexData(vertexData: VertexInputLayout) {
    this._currentVertexData = vertexData as WebGPUVertexInputLayout;
  }
  getVertexData(): VertexInputLayout {
    return this._currentVertexData;
  }
  setRenderStates(stateSet: RenderStateSet) {
    this._currentStateSet = stateSet as WebGPURenderStateSet;
  }
  getRenderStates(): RenderStateSet {
    return this._currentStateSet;
  }
  setFramebuffer(rt: FrameBuffer): void {
    this._commandQueue.setFramebuffer(rt as WebGPUFrameBuffer);
  }
  getFramebuffer(): FrameBuffer {
    return this._commandQueue.getFramebuffer();
  }
  reverseVertexWindingOrder(reverse: boolean): void {
    this._reverseWindingOrder = !!reverse;
  }
  isWindingOrderReversed(): boolean {
    return this._reverseWindingOrder;
  }
  setRenderStatesOverridden(renderStates: RenderStateSet) {
    this._renderStatesOverridden = renderStates as WebGPURenderStateSet;
  }
  /** @internal */
  isBufferUploading(buffer: WebGPUBuffer): boolean {
    return this._commandQueue.isBufferUploading(buffer);
  }
  /** @internal */
  isTextureUploading(tex: WebGPUBaseTexture): boolean {
    return this._commandQueue.isTextureUploading(tex);
  }
  /** @internal */
  getRenderStatesOverridden() {
    return this._renderStatesOverridden;
  }
  /** @internal */
  getFramebufferInfo(): { colorFormats: GPUTextureFormat[], depthFormat: GPUTextureFormat, sampleCount: number, hash: string } {
    return this._commandQueue.getFramebufferInfo();
  }
  /** @internal */
  gpuGetObjectHash(obj: GPUObjectBase): number {
    return this._gpuObjectHasher.get(obj);
  }
  /** @internal */
  gpuCreateTexture(desc: GPUTextureDescriptor): GPUTexture {
    const tex = this._device.createTexture(desc);
    if (tex) {
      this._gpuObjectHasher.set(tex, ++this._gpuObjectHashCounter);
    }
    return tex;
  }
  /** @internal */
  gpuImportExternalTexture(el: HTMLVideoElement): GPUExternalTexture {
    const tex = this._device.importExternalTexture({ source: el });
    if (tex) {
      this._gpuObjectHasher.set(tex, ++this._gpuObjectHashCounter);
    }
    return tex;
  }
  /** @internal */
  gpuCreateSampler(desc: GPUSamplerDescriptor): GPUSampler {
    const sampler = this._device.createSampler(desc);
    if (sampler) {
      this._gpuObjectHasher.set(sampler, ++this._gpuObjectHashCounter);
    }
    return sampler;
  }
  /** @internal */
  gpuCreateBindGroup(desc: GPUBindGroupDescriptor): GPUBindGroup {
    const bindGroup = this._device.createBindGroup(desc);
    if (bindGroup) {
      this._gpuObjectHasher.set(bindGroup, ++this._gpuObjectHashCounter);
    }
    return bindGroup;
  }
  /** @internal */
  gpuCreateBuffer(desc: GPUBufferDescriptor): GPUBuffer {
    const buffer = this._device.createBuffer(desc);
    if (buffer) {
      this._gpuObjectHasher.set(buffer, ++this._gpuObjectHashCounter);
    }
    return buffer;
  }
  /** @internal */
  gpuCreateTextureView(texture: GPUTexture, desc?: GPUTextureViewDescriptor): GPUTextureView {
    const view = texture?.createView(desc);
    if (view) {
      this._gpuObjectHasher.set(view, ++this._gpuObjectHashCounter);
    }
    return view;
  }
  /** @internal */
  gpuCreateRenderPipeline(desc: GPURenderPipelineDescriptor): GPURenderPipeline {
    const pipeline = this._device.createRenderPipeline(desc);
    if (pipeline) {
      this._gpuObjectHasher.set(pipeline, ++this._gpuObjectHashCounter);
    }
    return pipeline;
  }
  /** @internal */
  gpuCreateComputePipeline(desc: GPUComputePipelineDescriptor): GPUComputePipeline {
    const pipeline = this._device.createComputePipeline(desc);
    if (pipeline) {
      this._gpuObjectHasher.set(pipeline, ++this._gpuObjectHashCounter);
    }
    return pipeline;
  }
  /** @internal */
  fetchVertexLayout(hash: string): GPUVertexBufferLayout[] {
    return this._vertexLayoutCache.fetchVertexLayout(hash);
  }
  /** @internal */
  fetchSampler(options: SamplerOptions): WebGPUTextureSampler {
    return this._samplerCache.fetchSampler(options);
  }
  /** @internal */
  fetchBindGroupLayout(desc: BindGroupLayout): GPUBindGroupLayout {
    return this._bindGroupCache.fetchBindGroupLayout(desc);
  }
  flush(): void {
    this._commandQueue.flush();
  }
  async readPixels(x: number, y: number, w: number, h: number, buffer: TypedArray): Promise<void> {
    const fb = this.getFramebuffer();
    const colorAttachment = fb ? fb.getColorAttachments()[0]?.object as GPUTexture : this.context.getCurrentTexture();
    const texFormat = fb ? fb.getColorAttachments()[0]?.format : textureFormatInvMap[this._backBufferFormat];
    if (colorAttachment && texFormat) {
      const pixelSize = getTextureFormatBlockSize(texFormat);
      const bufferSize = w * h * pixelSize;
      const stagingBuffer = this.createBuffer(bufferSize, GPUResourceUsageFlags.BF_READ);
      this.readPixelsToBuffer(x, y, w, h, stagingBuffer);
      const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      await stagingBuffer.getBufferSubData(data);
      stagingBuffer.dispose();
    } else {
      console.error('readPixels() failed: no color attachment0 or unrecoganized color attachment format');
    }
  }
  readPixelsToBuffer(x: number, y: number, w: number, h: number, buffer: GPUDataBuffer): void {
    const fb = this.getFramebuffer();
    const colorAttachment = fb ? fb.getColorAttachments()[0]?.object as GPUTexture : this.context.getCurrentTexture();
    const texFormat = fb ? fb.getColorAttachments()[0]?.format : textureFormatInvMap[this._backBufferFormat];
    const texWidth = fb ? fb.getColorAttachments()[0]?.width : this.getDrawingBufferWidth();
    const texHeight = fb ? fb.getColorAttachments()[0]?.height : this.getDrawingBufferHeight();
    if (colorAttachment && texFormat) {
      this.flush();
      WebGPUBaseTexture.copyTexturePixelsToBuffer(this._device, colorAttachment, texWidth, texHeight, texFormat, x, y, w, h, 0, 0, buffer);
    } else {
      console.error('readPixelsToBuffer() failed: no color attachment0 or unrecoganized color attachment format');
    }
  }
  looseContext(): void {
    // not implemented
  }
  restoreContext(): void {
    // not implemented
  }
  /** @internal */
  protected onBeginFrame(): boolean {
    if (this._canRender) {
      this._commandQueue.beginFrame();
      return true;
    } else {
      return false;
    }
  }
  /** @internal */
  protected onEndFrame(): void {
    this._commandQueue.endFrame();
  }
  /** @internal */
  protected _draw(primitiveType: PrimitiveType, first: number, count: number): void {
    this._commandQueue.draw(this._currentProgram, this._currentVertexData, this._currentStateSet, this._currentBindGroups, this._currentBindGroupOffsets, primitiveType, first, count, 1);
  }
  /** @internal */
  protected _drawInstanced(primitiveType: PrimitiveType, first: number, count: number, numInstances: number): void {
    this._commandQueue.draw(this._currentProgram, this._currentVertexData, this._currentStateSet, this._currentBindGroups, this._currentBindGroupOffsets, primitiveType, first, count, numInstances);
  }
  /** @internal */
  protected _compute(workgroupCountX, workgroupCountY, workgroupCountZ): void {
    this._commandQueue.compute(this._currentProgram, this._currentBindGroups, this._currentBindGroupOffsets, workgroupCountX, workgroupCountY, workgroupCountZ);
  }
  private configure() {
    this._backBufferFormat = (navigator.gpu as any).getPreferredCanvasFormat ? (navigator.gpu as any).getPreferredCanvasFormat() : this._context.getPreferredFormat(this._adapter);
    this._depthFormat = 'depth24plus-stencil8';
    this._context.configure({
      device: this._device,
      format: this._backBufferFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      alphaMode: 'opaque',
      colorSpace: 'srgb',
    });
    this.createDefaultRenderAttachments();
  }
  private createDefaultRenderAttachments() {
    const width = Math.max(1, this._canvas.width);
    const height = Math.max(1, this._canvas.height);
    this._defaultMSAAColorTexture?.destroy();
    this._defaultMSAAColorTexture = null;
    this._defaultMSAAColorTextureView = null;
    this._defaultDepthTexture?.destroy();
    this._defaultDepthTexture = null;
    this._defaultDepthTextureView = null;
    if (this._sampleCount > 1) {
      this._defaultMSAAColorTexture = this.gpuCreateTexture({
        size: {
          width,
          height,
          depthOrArrayLayers: 1,
        },
        format: this._backBufferFormat,
        dimension: '2d',
        mipLevelCount: 1,
        sampleCount: this._sampleCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });
      this._defaultMSAAColorTextureView = this._defaultMSAAColorTexture.createView();
    }
    this._defaultDepthTexture = this.gpuCreateTexture({
      size: {
        width,
        height,
        depthOrArrayLayers: 1,
      },
      format: this._depthFormat,
      dimension: '2d',
      mipLevelCount: 1,
      sampleCount: this._sampleCount,
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    this._defaultDepthTextureView = this._defaultDepthTexture.createView();
    this._defaultRenderPassDesc = {
      label: `mainRenderPass:${this._sampleCount}`,
      colorAttachments: [{
        view: this._sampleCount > 1 ? this._defaultMSAAColorTextureView : null,
        resolveTarget: undefined,
        loadOp: 'clear',
        clearValue: [0, 0, 0, 0],
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this._defaultDepthTextureView,
        depthLoadOp: 'clear',
        depthClearValue: 1,
        depthStoreOp: 'store',
        stencilLoadOp: 'clear',
        stencilClearValue: 0,
        stencilStoreOp: 'store',
      }
    }
  }
  private async tryCompile(code: string) {
    const sm = this._device.createShaderModule({
      code
    });
    if (sm && sm.compilationInfo) {
      const compilationInfo = await sm.compilationInfo();
      let err = false;
      if (compilationInfo?.messages?.length > 0) {
        let msg = '';
        for (const message of compilationInfo.messages) {
          if (message.type === 'error') {
            err = true;
          }
          msg += `${message.type}: ${message.message} (${message.lineNum}/${message.linePos})\n`;
        }
        if (msg) {
          console.log(msg);
        }
      }
      return !err;
    } else {
      return true;
    }
  }
}
