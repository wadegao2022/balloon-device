import { Vector4 } from '../../math';
import { TextureFormat, WebGLContext, PrimitiveType, hasAlphaChannel, hasRedChannel, hasGreenChannel, hasBlueChannel, isIntegerTextureFormat, isSignedTextureFormat, isFloatTextureFormat, getTextureFormatBlockSize, isCompressedTextureFormat, isDepthTextureFormat } from '../base_types';
import { isWebGL2, WebGLError } from './utils';
import { WebGLEnum } from './webgl_enum';
import { WebGLTexture2D } from './texture2d_webgl';
import { WebGLTexture2DArray } from './texture2darray_webgl';
import { WebGLTexture3D } from './texture3d_webgl';
import { WebGLTextureCube } from './texturecube_webgl';
import { WebGLTextureVideo } from './texturevideo_webgl';
import { WebGLVertexInputLayout } from './vertexinputlayout_webgl';
import { WebGLGPUBuffer } from './buffer_webgl';
import { WebGLIndexBuffer } from './indexbuffer_webgl';
import { WebGLFrameBuffer } from './framebuffer_webgl';
import { WebGLDepthState, WebGLRenderStateSet } from './renderstate_webgl';
import { GPUTimer } from './gpu_timer';
import {
  IFrameBufferOptions,
  SamplerOptions,
  TextureSampler,
  Texture2D,
  Texture3D,
  TextureCube,
  TextureVideo,
  VertexInputLayout,
  GPUDataBuffer,
  IndexBuffer,
  FrameBuffer,
  GPUProgram,
  BindGroup,
  BindGroupLayout,
  StructuredBuffer,
  TextureMipmapData,
  TextureImageElement,
  GPUResourceUsageFlags,
  Texture2DArray,
} from '../gpuobject';
import { WebGLTextureCap, WebGLFramebufferCap, WebGLMiscCap, WebGLShaderCap } from './capabilities_webgl';
import { WebGLBindGroup } from './bindgroup_webgl';
import { WebGLGPUProgram } from './gpuprogram_webgl';
import { primitiveTypeMap, typeMap } from './constants_webgl';
import { GPUProgramConstructParams, Device, DeviceType, DeviceTypeWebGL, TextureCaps, MiscCaps, FramebufferCaps, ShaderCaps, RenderProgramConstructParams, DeviceOptions, DeviceLostEvent, DeviceRestoreEvent } from '../device';
import { RenderStateSet } from '../render_states';
import { SamplerCache } from './sampler_cache';
import { WebGLStructuredBuffer } from './structuredbuffer_webgl';
import { PBStructTypeInfo, typeU16 } from '../builder';
import type { ITimer } from '../timer';
import type { VertexData } from '../vertexdata';
import type { TypedArray } from '../../../shared';

declare global {
  interface WebGLRenderingContext {
    _currentFramebuffer: FrameBuffer;
    _currentProgram: GPUProgram;
  }
  interface WebGL2RenderingContext {
    _currentFramebuffer: FrameBuffer;
    _currentProgram: GPUProgram;
  }
}

export type VAOObject = WebGLVertexArrayObject | WebGLVertexArrayObjectOES;
export interface VertexArrayObjectEXT {
  createVertexArray: () => VAOObject;
  bindVertexArray: (arrayObject: VAOObject) => void;
  deleteVertexArray: (arrayObject: VAOObject) => void;
  isVertexArray: (arrayObject: VAOObject) => GLboolean;
}

export interface InstancedArraysEXT {
  drawArraysInstanced: (mode: GLenum, first: GLint, count: GLsizei, primcount: GLsizei) => void;
  drawElementsInstanced: (mode: GLenum, count: GLsizei, type: GLenum, offset: GLintptr, primcount: GLsizei) => void;
  vertexAttribDivisor: (index: GLuint, divisor: GLuint) => void;
}

export interface DrawBuffersEXT {
  drawBuffers(buffers: number[]);
}

export class WebGLDevice extends Device {
  private _context: WebGLContext;
  private _loseContextExtension: WEBGL_lose_context;
  private _contextLost: boolean;
  private _isRendering: boolean;
  private _deviceType: DeviceTypeWebGL;
  private _canvas: HTMLCanvasElement;
  private _dpr: number;
  private _reverseWindingOrder: boolean;
  private _textureCaps: WebGLTextureCap;
  private _framebufferCaps: WebGLFramebufferCap;
  private _miscCaps: WebGLMiscCap;
  private _shaderCaps: WebGLShaderCap;
  private _vaoExt: VertexArrayObjectEXT;
  private _instancedArraysExt: InstancedArraysEXT;
  private _drawBuffersExt: DrawBuffersEXT;
  private _currentProgram: WebGLGPUProgram;
  private _currentVertexData: WebGLVertexInputLayout;
  private _currentStateSet: WebGLRenderStateSet;
  private _currentBindGroups: WebGLBindGroup[];
  private _currentBindGroupOffsets: Iterable<number>[];
  private _currentViewport: number[];
  private _currentScissorRect: number[];
  private _samplerCache: SamplerCache;
  private _renderStatesOverridden: RenderStateSet;
  constructor(cvs: HTMLCanvasElement, type: DeviceTypeWebGL, options?: DeviceOptions) {
    super();
    this._canvas = cvs;
    this._dpr = Math.ceil(options?.dpr ?? window.devicePixelRatio);
    this._canvas.style.outline = 'none';
    this._isRendering = false;
    let context: WebGLContext = null;
    context = this._canvas.getContext(
      type,
      {
        antialias: !!options?.msaa,
        depth: true,
        stencil: true,
        premultipliedAlpha: false
      },
    ) as WebGLContext;
    if (!context) {
      this._deviceType = null;
      throw new Error('Invalid argument or no webgl support');
    }
    this._contextLost = false;
    this._deviceType = type;
    this._reverseWindingOrder = false;
    this._textureCaps = null;
    this._framebufferCaps = null;
    this._miscCaps = null;
    this._shaderCaps = null;
    this._context = context;
    this._currentProgram = null;
    this._currentVertexData = null;
    this._currentStateSet = null;
    this._currentBindGroups = [];
    this._currentBindGroupOffsets = [];
    this._currentViewport = null;
    this._currentScissorRect = null;
    this._samplerCache = new SamplerCache(this);
    this._renderStatesOverridden = null;
    this._loseContextExtension = this._context.getExtension('WEBGL_lose_context');
    this._canvas.addEventListener('webglcontextlost', evt => {
      this._contextLost = true;
      evt.preventDefault();
      this.handleContextLost();
    }, false);
    this._canvas.addEventListener('webglcontextrestored', evt => {
      this._contextLost = false;
      this.handleContextRestored();
    }, false);
  }
  get context() {
    return this._context;
  }
  get isWebGL2(): boolean {
    return this._context && isWebGL2(this._context);
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
  getCanvas(): HTMLCanvasElement {
    return this._canvas;
  }
  getScale(): number {
    return this._dpr;
  }
  isContextLost(): boolean {
    return this._context.isContextLost();
  }
  getDeviceType(): DeviceType {
    return this._deviceType;
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
  get vaoExt(): VertexArrayObjectEXT {
    return this._vaoExt;
  }
  get instancedArraysExt(): InstancedArraysEXT {
    return this._instancedArraysExt;
  }
  get drawBuffersExt() {
    return this._drawBuffersExt;
  }
  getDrawingBufferWidth(): number {
    return this._context._currentFramebuffer?.getWidth() || this._context.drawingBufferWidth;
  }
  getDrawingBufferHeight(): number {
    return this._context._currentFramebuffer?.getHeight() || this._context.drawingBufferHeight;
  }
  getBackBufferWidth(): number {
    return this._canvas.width;
  }
  getBackBufferHeight(): number {
    return this._canvas.height;
  }
  async initContext() {
    this.initContextState();
    this.addDefaultEventListener('resize', evt => {
      const width = Math.max(1, Math.round(this._canvas.clientWidth * this._dpr));
      const height = Math.max(1, Math.round(this._canvas.clientHeight * this._dpr));
      if (width !== this._canvas.width || height !== this._canvas.height) {
        this._canvas.width = width;
        this._canvas.height = height;
        this.setViewport(null);
        this.setScissor(null);
      }
    });
  }
  clearFrameBuffer(clearColor: Vector4, clearDepth: number, clearStencil: number) {
    const gl = this._context;
    const colorFlag = clearColor ? gl.COLOR_BUFFER_BIT : 0;
    const depthFlag = typeof clearDepth === 'number' ? gl.DEPTH_BUFFER_BIT : 0;
    const stencilFlag = typeof clearStencil === 'number' ? gl.STENCIL_BUFFER_BIT : 0;
    if (colorFlag || depthFlag || stencilFlag) {
      WebGLDepthState.applyDefaults(this._context);
      if (isWebGL2(gl) && gl._currentFramebuffer) {
        if (depthFlag || stencilFlag) {
          const depthAttachment = gl._currentFramebuffer.getDepthAttachment();
          if (depthAttachment) {
            gl.clearBufferfi(WebGLEnum.DEPTH_STENCIL, 0, clearDepth || 1, clearStencil || 0);
          }
        }
        if (colorFlag) {
          const attachments = gl._currentFramebuffer.getColorAttachments();
          for (let i = 0; i < attachments.length; i++) {
            gl.clearBufferfv(WebGLEnum.COLOR, i, clearColor.getArray());
          }
        }
      } else {
        gl.clearColor(clearColor.x, clearColor.y, clearColor.z, clearColor.w);
        gl.clearDepth(clearDepth);
        gl.clearStencil(clearStencil);
        gl.clear(colorFlag | depthFlag | stencilFlag);
      }
    }
  }
  // factory
  createGPUTimer(): ITimer {
    return new GPUTimer(this);
  }
  createRenderStateSet(): RenderStateSet {
    return new WebGLRenderStateSet(this._context);
  }
  createSampler(options: SamplerOptions): TextureSampler {
    return this._samplerCache.fetchSampler(options);
  }
  createTexture2D(format: TextureFormat, width: number, height: number, creationFlags?: number): Texture2D {
    const tex = new WebGLTexture2D(this);
    tex.createEmpty(format, width, height, creationFlags);
    return tex;
  }
  createTexture2DFromMipmapData(data: TextureMipmapData, creationFlags?: number): Texture2D {
    const tex = new WebGLTexture2D(this);
    tex.createWithMipmapData(data, creationFlags);
    return tex;
  }
  createTexture2DFromImage(element: TextureImageElement, creationFlags?: number): Texture2D {
    const tex = new WebGLTexture2D(this);
    tex.loadFromElement(element, creationFlags);
    return tex;
  }
  async loadTexture2DFromURL(url: string, mimeType?: string, creationFlags?: number): Promise<Texture2D> {
    const tex = new WebGLTexture2D(this);
    await tex.loadFromURL(url, mimeType, creationFlags);
    return tex;
  }
  createTexture2DArray(format: TextureFormat, width: number, height: number, depth: number, creationFlags?: number): Texture2DArray {
    const tex = new WebGLTexture2DArray(this);
    tex.createEmpty(format, width, height, depth, creationFlags);
    return tex;
  }
  createTexture3D(format: TextureFormat, width: number, height: number, depth: number, creationFlags?: number): Texture3D {
    if (!this.isWebGL2) {
      console.error('device does not support 3d texture');
      return null;
    }
    const tex = new WebGLTexture3D(this);
    tex.createEmpty(format, width, height, depth, creationFlags);
    return tex;
  }
  createCubeTexture(format: TextureFormat, size: number, creationFlags?: number): TextureCube {
    const tex = new WebGLTextureCube(this);
    tex.createEmpty(format, size, creationFlags);
    return tex;
  }
  createCubeTextureFromMipmapData(data: TextureMipmapData, creationFlags?: number): TextureCube {
    const tex = new WebGLTextureCube(this);
    tex.createWithMipmapData(data, creationFlags);
    return tex;
  }
  async loadCubeTextureFromURL(url: string, mimeType?: string, creationFlags?: number): Promise<TextureCube> {
    const tex = new WebGLTextureCube(this);
    await tex.loadFromURL(url, mimeType, creationFlags);
    return tex;
  }
  createTextureVideo(el: HTMLVideoElement): TextureVideo {
    return new WebGLTextureVideo(this, el);
  }
  createGPUProgram(params: GPUProgramConstructParams): GPUProgram {
    if (params.type === 'compute') {
      throw new Error('device does not support compute shader');
    }
    const renderProgramParams = params.params as RenderProgramConstructParams;
    return new WebGLGPUProgram(this, renderProgramParams.vs, renderProgramParams.fs, renderProgramParams.bindGroupLayouts, renderProgramParams.vertexAttributes);
  }
  createBindGroup(layout: BindGroupLayout): BindGroup {
    return new WebGLBindGroup(this, layout);
  }
  createBuffer(sizeInBytes: number, usage: number): GPUDataBuffer {
    return new WebGLGPUBuffer(this, usage, sizeInBytes);
  }
  createIndexBuffer(data: Uint16Array | Uint32Array, usage?: number): IndexBuffer {
    return new WebGLIndexBuffer(this, data, usage);
  }
  createStructuredBuffer(structureType: PBStructTypeInfo, usage: number, data?: TypedArray): StructuredBuffer {
    return new WebGLStructuredBuffer(this, structureType, usage, data);
  }
  createVAO(vertexData: VertexData): VertexInputLayout {
    return new WebGLVertexInputLayout(this, vertexData);
  }
  createFrameBuffer(options?: IFrameBufferOptions): FrameBuffer {
    return new WebGLFrameBuffer(this, options);
  }
  setBindGroup(index: number, bindGroup: BindGroup, bindGroupOffsets?: Iterable<number>) {
    if (bindGroupOffsets && !isWebGL2(this._context)) {
      throw new Error(`setBindGroup(): no dynamic offset buffer support for WebGL1 device`);
    }
    this._currentBindGroups[index] = bindGroup as WebGLBindGroup;
    this._currentBindGroupOffsets[index] = bindGroupOffsets || null;
  }
  // render related
  setViewport(vp?: number[]);
  setViewport(x: number, y: number, w: number, h: number);
  setViewport(x?: number[] | number, y?: number, w?: number, h?: number) {
    if (x === null || x === undefined) {
      this._currentViewport = null;
      this._context.viewport(0, 0, this.drawingBufferWidth, this.drawingBufferHeight);
    } else if (Array.isArray(x)) {
      this._currentViewport = [...x];
      this._context.viewport(this.screenToDevice(x[0]), this.screenToDevice(x[1]), this.screenToDevice(x[2]), this.screenToDevice(x[3]));
    } else {
      this._currentViewport = [x, y, w, h];
      this._context.viewport(this.screenToDevice(x), this.screenToDevice(y), this.screenToDevice(w), this.screenToDevice(h));
    }
  }
  getViewport(): number[] {
    return this._currentViewport ? [...this._currentViewport] : [0, 0, this.deviceToScreen(this.drawingBufferWidth), this.deviceToScreen(this.drawingBufferHeight)];
  }
  setScissor(scissor?: number[]);
  setScissor(x: number, y: number, w: number, h: number): void;
  setScissor(x?: number[] | number, y?: number, w?: number, h?: number) {
    if (x === null || x === undefined) {
      this._currentScissorRect = null;
      this._context.scissor(0, 0, this.drawingBufferWidth, this.drawingBufferHeight);
    } else if (Array.isArray(x)) {
      this._currentScissorRect = [...x];
      this._context.scissor(this.screenToDevice(x[0]), this.screenToDevice(x[1]), this.screenToDevice(x[2]), this.screenToDevice(x[3]));
    } else {
      this._currentScissorRect = [x, y, w, h];
      this._context.scissor(this.screenToDevice(x), this.screenToDevice(y), this.screenToDevice(w), this.screenToDevice(h));
    }
  }
  getScissor(): number[] {
    return this._currentScissorRect ? [...this._currentScissorRect] : [0, 0, this.deviceToScreen(this.drawingBufferWidth), this.deviceToScreen(this.drawingBufferHeight)];
  }
  setProgram(program: GPUProgram) {
    this._currentProgram = program as WebGLGPUProgram;
  }
  getProgram(): GPUProgram {
    return this._currentProgram;
  }
  setVertexData(vertexData: VertexInputLayout) {
    this._currentVertexData = vertexData as WebGLVertexInputLayout;
  }
  getVertexData(): VertexInputLayout {
    return this._currentVertexData;
  }
  setRenderStates(stateSet: RenderStateSet) {
    this._currentStateSet = stateSet as WebGLRenderStateSet;
  }
  getRenderStates(): RenderStateSet {
    return this._currentStateSet;
  }
  setFramebuffer(rt: FrameBuffer): void {
    if (rt) {
      rt.bind();
    } else {
      if (this._context._currentFramebuffer) {
        const renderTextures = this._context._currentFramebuffer.getColorAttachments();
        this._context._currentFramebuffer?.unbind();
        for (const tex of renderTextures) {
          if (tex.mipLevelCount > 1) {
            tex.generateMipmaps();
          }
        }
      }
    }
  }
  getFramebuffer(): FrameBuffer {
    return this._context._currentFramebuffer || null;
  }
  reverseVertexWindingOrder(reverse: boolean): void {
    this._reverseWindingOrder = !!reverse;
    this._context.frontFace(reverse ? this._context.CW : this._context.CCW)
  }
  isWindingOrderReversed(): boolean {
    return !!this._reverseWindingOrder;
  }
  setRenderStatesOverridden(renderStates: RenderStateSet) {
    this._renderStatesOverridden = renderStates;
  }
  flush(): void {
    this.context.flush();
  }
  async readPixels(x: number, y: number, w: number, h: number, buffer: TypedArray): Promise<void> {
    const fb = this.getFramebuffer();
    const colorAttachment = fb ? fb.getColorAttachments()[0] : null;
    const format = colorAttachment ? colorAttachment.format : TextureFormat.RGBA8UNORM;
    let glFormat: number = WebGLEnum.NONE;
    let glType: number = WebGLEnum.NONE;
    const r = hasRedChannel(format);
    const g = hasGreenChannel(format);
    const b = hasBlueChannel(format);
    const a = hasAlphaChannel(format);
    const numChannels = (r ? 1 : 0) + (g ? 1 : 0) + (b ? 1 : 0) + (a ? 1 : 0);
    const pixelSize = getTextureFormatBlockSize(format);
    const size = pixelSize / numChannels;
    const integer = isIntegerTextureFormat(format);
    const float = isFloatTextureFormat(format);
    const signed = isSignedTextureFormat(format);
    if (r && g && b && a) {
      glFormat = integer ? WebGLEnum.RGBA_INTEGER : WebGLEnum.RGBA;
    } else if (r && g) {
      glFormat = integer ? WebGLEnum.RG_INTEGER : WebGLEnum.RG;
    } else if (r) {
      glFormat = integer ? WebGLEnum.RED_INTEGER : WebGLEnum.RED;
    }
    if (size === 1) {
      glType = signed ? WebGLEnum.BYTE : WebGLEnum.UNSIGNED_BYTE;
    } else if (size === 2) {
      glType = float ? WebGLEnum.HALF_FLOAT : signed ? WebGLEnum.SHORT : WebGLEnum.UNSIGNED_SHORT;
    } else if (size === 4) {
      glType = float ? WebGLEnum.FLOAT : signed ? WebGLEnum.INT : WebGLEnum.UNSIGNED_INT;
    }
    if ((glFormat !== WebGLEnum.RGBA || (glType !== WebGLEnum.UNSIGNED_BYTE && glType !== WebGLEnum.FLOAT)) && !isWebGL2(this.context)) {
      throw new Error(`readPixels() failed: invalid format: ${format}`);
    }
    const byteSize = w * h * pixelSize;
    if (buffer.byteLength < byteSize) {
      throw new Error(`readPixels() failed: destination buffer must have at least ${byteSize} bytes`);
    }
    if (isWebGL2(this.context)) {
      const stagingBuffer = this.createBuffer(byteSize, GPUResourceUsageFlags.BF_READ);
      this.context.bindBuffer(WebGLEnum.PIXEL_PACK_BUFFER, stagingBuffer.object);
      this.context.readBuffer(WebGLEnum.COLOR_ATTACHMENT0);
      this.flush();
      this.context.readPixels(x, y, w, h, glFormat, glType, 0);
      this.context.bindBuffer(WebGLEnum.PIXEL_PACK_BUFFER, null);
      const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      await stagingBuffer.getBufferSubData(data);
      stagingBuffer.dispose();
    } else {
      this.context.readPixels(x, y, w, h, glFormat, glType, new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
    }
  }
  readPixelsToBuffer(x: number, y: number, w: number, h: number, buffer: GPUDataBuffer): void {
    const fb = this.getFramebuffer();
    const colorAttachment = fb ? fb.getColorAttachments()[0] : null;
    const format = colorAttachment ? colorAttachment.format : TextureFormat.RGBA8UNORM;
    let glFormat: number = WebGLEnum.NONE;
    let glType: number = WebGLEnum.NONE;
    if (!isWebGL2(this.context)) {
      throw new Error('readPixels() failed: readPixels() requires webgl2 device');
    }
    if (isCompressedTextureFormat(format) || isDepthTextureFormat(format)) {
      throw new Error(`readPixels() failed: invalid format: ${format}`);
    }
    const r = hasRedChannel(format);
    const g = hasGreenChannel(format);
    const b = hasBlueChannel(format);
    const a = hasAlphaChannel(format);
    const numChannels = (r ? 1 : 0) + (g ? 1 : 0) + (b ? 1 : 0) + (a ? 1 : 0);
    const size = getTextureFormatBlockSize(format) / numChannels;
    const integer = isIntegerTextureFormat(format);
    const float = isFloatTextureFormat(format);
    const signed = isSignedTextureFormat(format);
    if (r && g && b && a) {
      glFormat = integer ? WebGLEnum.RGBA_INTEGER : WebGLEnum.RGBA;
    } else if (r && g) {
      glFormat = integer ? WebGLEnum.RG_INTEGER : WebGLEnum.RG;
    } else if (r) {
      glFormat = integer ? WebGLEnum.RED_INTEGER : WebGLEnum.RED;
    }
    if (size === 1) {
      glType = signed ? WebGLEnum.BYTE : WebGLEnum.UNSIGNED_BYTE;
    } else if (size === 2) {
      glType = float ? WebGLEnum.HALF_FLOAT : signed ? WebGLEnum.SHORT : WebGLEnum.UNSIGNED_SHORT;
    } else if (size === 4) {
      glType = float ? WebGLEnum.FLOAT : signed ? WebGLEnum.INT : WebGLEnum.UNSIGNED_INT;
    }
    this.context.bindBuffer(WebGLEnum.PIXEL_PACK_BUFFER, buffer.object);
    this.context.readBuffer(WebGLEnum.COLOR_ATTACHMENT0);
    this.flush();
    this.context.readPixels(x, y, w, h, glFormat, glType, 0);
    this.context.bindBuffer(WebGLEnum.PIXEL_PACK_BUFFER, null);
  }
  looseContext(): void {
    if (!this.context.isContextLost()) {
      this._loseContextExtension?.loseContext();
    }
  }
  restoreContext(): void {
    if (this.context.isContextLost()) {
      this.clearErrors();
      this._loseContextExtension?.restoreContext();
      const err = this.getError();
      if (err) {
        console.log(err);
      }
    }
  }
  /** @internal */
  protected onBeginFrame(): boolean {
    if (this._contextLost) {
      if (!this._context.isContextLost()) {
        this._contextLost = false;
        this.handleContextRestored();
      }
    }
    return !this._contextLost;
  }
  /** @internal */
  protected onEndFrame(): void {
  }
  /** @internal */
  protected _draw(primitiveType: PrimitiveType, first: number, count: number): void {
    if (this._currentVertexData) {
      this._currentVertexData.bind();
      if (this._currentProgram) {
        if (!this._currentProgram.use()) {
          return;
        }
        for (let i = 0; i < this._currentBindGroups.length; i++) {
          const bindGroup = this._currentBindGroups[i];
          if (bindGroup) {
            const offsets = this._currentBindGroupOffsets[i];
            bindGroup.apply(this._currentProgram, offsets);
          }
        }
      }
      if (this._currentStateSet) {
        this._currentStateSet.apply(this._renderStatesOverridden as WebGLRenderStateSet);
      } else {
        WebGLRenderStateSet.applyDefaults(this._context);
      }
      const indexBuffer = this._currentVertexData.indexBuffer;
      if (indexBuffer) {
        this.context.drawElements(
          primitiveTypeMap[primitiveType],
          count,
          typeMap[indexBuffer.indexType.primitiveType],
          first * (indexBuffer.indexType === typeU16 ? 2 : 4)
        );
      } else {
        this.context.drawArrays(primitiveTypeMap[primitiveType], first, count);
      }
    }
  }
  /** @internal */
  protected _drawInstanced(primitiveType: PrimitiveType, first: number, count: number, numInstances: number): void {
    if (this.instancedArraysExt && this._currentVertexData) {
      this._currentVertexData.bind();
      if (this._currentProgram) {
        if (!this._currentProgram.use()) {
          return;
        }
        for (let i = 0; i < this._currentBindGroups.length; i++) {
          const bindGroup = this._currentBindGroups[i];
          if (bindGroup) {
            const offsets = this._currentBindGroupOffsets[i];
            bindGroup.apply(this._currentProgram, offsets);
          }
        }
      }
      this._currentStateSet?.apply(this._renderStatesOverridden as WebGLRenderStateSet);
      const indexBuffer = this._currentVertexData.indexBuffer;
      if (indexBuffer) {
        this.instancedArraysExt.drawElementsInstanced(
          primitiveTypeMap[primitiveType],
          count,
          typeMap[indexBuffer.indexType.primitiveType],
          first * (indexBuffer.indexType === typeU16 ? 2 : 4),
          numInstances,
        );
      } else {
        this.instancedArraysExt.drawArraysInstanced(
          primitiveTypeMap[primitiveType],
          first,
          count,
          numInstances,
        );
      }
    }
  }
  /** @internal */
  protected _compute(): void {
    throw new Error('WebGL device does not support compute shader');
  }
  /** @internal */
  private createInstancedArraysEXT(): InstancedArraysEXT {
    const gl = this._context;
    if (isWebGL2(gl)) {
      return {
        vertexAttribDivisor: gl.vertexAttribDivisor.bind(gl),
        drawArraysInstanced: gl.drawArraysInstanced.bind(gl),
        drawElementsInstanced: gl.drawElementsInstanced.bind(gl),
      };
    } else {
      const extInstancedArray: ANGLE_instanced_arrays = gl.getExtension('ANGLE_instanced_arrays');
      return extInstancedArray
        ? {
          vertexAttribDivisor: extInstancedArray.vertexAttribDivisorANGLE.bind(extInstancedArray),
          drawArraysInstanced: extInstancedArray.drawArraysInstancedANGLE.bind(extInstancedArray),
          drawElementsInstanced: extInstancedArray.drawElementsInstancedANGLE.bind(extInstancedArray),
        }
        : null;
    }
  }
  /** @internal */
  private createDrawBuffersEXT(): DrawBuffersEXT {
    const gl = this._context;
    if (isWebGL2(gl)) {
      return {
        drawBuffers: gl.drawBuffers.bind(gl),
      }
    } else {
      const extDrawBuffers: WEBGL_draw_buffers = gl.getExtension('WEBGL_draw_buffers');
      return extDrawBuffers
        ? {
          drawBuffers: extDrawBuffers.drawBuffersWEBGL.bind(extDrawBuffers),
        }
        : null;
    }
  }
  /** @internal */
  private createVertexArrayObjectEXT(): VertexArrayObjectEXT {
    const gl = this._context;
    if (isWebGL2(gl)) {
      return {
        createVertexArray: gl.createVertexArray.bind(gl),
        bindVertexArray: gl.bindVertexArray.bind(gl),
        deleteVertexArray: gl.deleteVertexArray.bind(gl),
        isVertexArray: gl.isVertexArray.bind(gl),
      };
    } else {
      const extVAO: OES_vertex_array_object = gl.getExtension('OES_vertex_array_object');
      return extVAO
        ? {
          createVertexArray: extVAO.createVertexArrayOES.bind(extVAO),
          bindVertexArray: extVAO.bindVertexArrayOES.bind(extVAO),
          deleteVertexArray: extVAO.deleteVertexArrayOES.bind(extVAO),
          isVertexArray: extVAO.isVertexArrayOES.bind(extVAO),
        }
        : null;
    }
  }
  /** @internal */
  private handleContextLost() {
    this._isRendering = this.isRendering;
    this.exitLoop();
    console.log('handle context lost');
    this.invalidateAll();
    this.dispatchEvent(new DeviceLostEvent());
  }
  /** @internal */
  private handleContextRestored() {
    console.log('handle context restored');
    this.initContextState();
    this._currentProgram = null;
    this._currentVertexData = null;
    this._currentStateSet = null;
    this._currentBindGroups = [];
    this._currentBindGroupOffsets = [];
    this._currentViewport = null;
    this._currentScissorRect = null;
    this._samplerCache = new SamplerCache(this);
    if (this._isRendering) {
      this._isRendering = false;
      this.reloadAll().then(() => {
        this.dispatchEvent(new DeviceRestoreEvent());
        this.runLoop(this._runLoopFunc)
      });
    }
  }
  /** @internal */
  private initContextState() {
    this._textureCaps = new WebGLTextureCap(this._context);
    this._framebufferCaps = new WebGLFramebufferCap(this._context);
    this._miscCaps = new WebGLMiscCap(this._context);
    this._shaderCaps = new WebGLShaderCap(this._context);
    this._vaoExt = this.createVertexArrayObjectEXT();
    this._instancedArraysExt = this.createInstancedArraysEXT();
    this._drawBuffersExt = this.createDrawBuffersEXT();
    this._context.pixelStorei(WebGLEnum.UNPACK_COLORSPACE_CONVERSION_WEBGL, WebGLEnum.NONE);
    this._context.pixelStorei(WebGLEnum.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.setViewport(null);
    this.setScissor(null);
    this._context.enable(WebGLEnum.SCISSOR_TEST);
    this.enableGPUTimeRecording(true);
    this._context._currentFramebuffer = undefined;
    this._context._currentProgram = undefined;
  }
  /** @internal */
  clearErrors() {
    while (this._context.getError());
  }
  getError(throwError?: boolean): Error {
    const errcode = this._context.getError();
    const err = errcode === WebGLEnum.NO_ERROR ? null : new WebGLError(errcode);
    if (err && throwError) {
      throw err;
    }
    return err;
  }
}
