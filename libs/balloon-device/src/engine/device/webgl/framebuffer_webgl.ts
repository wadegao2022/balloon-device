import { CubeFace } from '../../math';
import { WebGLGPUObject } from './gpuobject_webgl';
import { WebGLEnum } from './webgl_enum';
import { BaseTexture, IFrameBufferTextureAttachment, FrameBuffer, IFrameBufferOptions, GPUResourceUsageFlags } from '../gpuobject';
import { cubeMapFaceMap } from './constants_webgl';
import type { WebGLDevice } from './device_webgl';
import { hasStencilChannel } from '../base_types';

const STATUS_UNCHECKED = 0;
const STATUS_OK = 1;
const STATUS_FAILED = 2;
export class WebGLFrameBuffer extends WebGLGPUObject<WebGLFramebuffer> implements FrameBuffer<WebGLFramebuffer> {
  private _options: IFrameBufferOptions;
  private _viewport: number[];
  private _scissor: [number, number, number, number];
  private _needBindBuffers: boolean;
  private _status: number;
  private _width: number;
  private _height: number;
  private _isMRT: boolean;
  private _drawBuffers: number[];
  constructor(device: WebGLDevice, opt?: IFrameBufferOptions) {
    super(device);
    this._object = null;
    this._viewport = [0, 0, 0, 0];
    this._scissor = null;
    this._needBindBuffers = false;
    this._status = STATUS_UNCHECKED;
    this._options = {
      colorAttachments: opt?.colorAttachments
        ? opt.colorAttachments.map((value) => Object.assign({
          texture: null,
          face: 0,
          layer: 0,
          level: 0
        }, value))
        : null,
      depthAttachment: opt?.depthAttachment ? Object.assign({}, opt.depthAttachment) : null
    };
    this._width = 0;
    this._height = 0;
    this._drawBuffers = this._options.colorAttachments.map((val, index) => val.texture ? WebGLEnum.COLOR_ATTACHMENT0 + index : WebGLEnum.NONE);
    this._isMRT = this._drawBuffers.length > 1;
    this._init();
  }
  getViewport(): number[] {
    return this._viewport;
  }
  setViewport(vp: number[]): void {
    this._viewport = [...vp];
  }
  getScissorRect(): number[] {
    return this._scissor;
  }
  setScissorRect(scissor: [number, number, number, number]): void {
    this._scissor = scissor ? [...scissor] : null;
  }
  isMRT(): boolean {
    return this._isMRT;
  }
  getWidth(): number {
    return this._width;
  }
  getHeight(): number {
    return this._height;
  }
  async restore() {
    if (!this._object && !this._device.isContextLost()) {
      if (this._options?.depthAttachment?.texture?.disposed) {
        await this._options.depthAttachment.texture.reload();
      }
      if (this._options?.colorAttachments) {
        for (const k of this._options.colorAttachments) {
          if (k?.texture?.disposed) {
            await k.texture.reload();
          }
        }
      }
    }
    this._init();
  }
  destroy() {
    if (this._object) {
      this._device.context.deleteFramebuffer(this._object);
      this._object = null;
    }
  }
  setCubeTextureFace(index: number, face: CubeFace) {
    const k = this._options.colorAttachments[index];
    if (k && k.face !== face) {
      k.face = face;
      this._needBindBuffers = true;
      if (this._device.context._currentFramebuffer === this) {
        this.bind();
      }
    }
  }
  setTextureLevel(index: number, level: number) {
    const k = this._options.colorAttachments[index];
    if (k && k.level !== level) {
      k.level = level;
      this._needBindBuffers = true;
      if (this._device.context._currentFramebuffer === this) {
        this.bind();
      }
    }
  }
  setTextureLayer(index: number, layer: number) {
    const k = this._options.colorAttachments[index];
    if (k && k.layer !== layer) {
      k.layer = layer;
      this._needBindBuffers = true;
      if (this._device.context._currentFramebuffer === this) {
        this.bind();
      }
    }
  }
  setDepthTextureLayer(layer: number) {
    const k = this._options.depthAttachment;
    if (k && k.layer !== layer) {
      k.layer = layer;
      this._needBindBuffers = true;
      if (this._device.context._currentFramebuffer === this) {
        this.bind();
      }
    }
  }
  getDepthAttachment(): BaseTexture {
    return this._options?.depthAttachment?.texture || null;
  }
  getColorAttachments(): BaseTexture[] {
    return this._options.colorAttachments?.map(val => val.texture || null) || [];
  }
  bind(): boolean {
    if (this._object) {
      this._device.context.bindFramebuffer(WebGLEnum.FRAMEBUFFER, this._object);
      this._device.context._currentFramebuffer = this;
      if (this._needBindBuffers) {
        this._needBindBuffers = false;
        if (!this._bindBuffers()) {
          this._device.context.bindFramebuffer(WebGLEnum.FRAMEBUFFER, null);
          this._device.context._currentFramebuffer = null;
          return false;
        }
      }
      const drawBuffersExt = this._device.drawBuffersExt;
      if (drawBuffersExt) {
        drawBuffersExt.drawBuffers(this._drawBuffers);
      } else if (this._isMRT) {
        console.error('device does not support multiple framebuffer color attachments');
      }
      this._device.setViewport();
      this._device.setScissor();
      return true;
    }
    return false;
  }
  unbind(): void {
    if (this._device.context._currentFramebuffer === this) {
      this._device.context.bindFramebuffer(WebGLEnum.FRAMEBUFFER, null);
      this._device.context._currentFramebuffer = null;
      this._device.setViewport();
      this._device.setScissor();
      const drawBuffersExt = this._device.drawBuffersExt;
      if (drawBuffersExt) {
        drawBuffersExt.drawBuffers([WebGLEnum.BACK]);
      }
    }
  }
  private _load(): void {
    if (this._device.isContextLost()) {
      return;
    }
    this._object = this._device.context.createFramebuffer();
    this._device.context.bindFramebuffer(WebGLEnum.FRAMEBUFFER, this._object);
    if (!this._bindBuffers()) {
      this.dispose();
    }
    this._device.context.bindFramebuffer(WebGLEnum.FRAMEBUFFER, null);
    this._device.context._currentFramebuffer = null;
  }
  private _bindAttachment(attachment: number, info: IFrameBufferTextureAttachment): boolean {
    if (info.texture) {
      if (info.texture.isTexture2D()) {
        this._device.context.framebufferTexture2D(
          WebGLEnum.FRAMEBUFFER,
          attachment,
          WebGLEnum.TEXTURE_2D,
          info.texture.object,
          info.level ?? 0
        );
      } else if (info.texture.isTextureCube()) {
        this._device.context.framebufferTexture2D(
          WebGLEnum.FRAMEBUFFER,
          attachment,
          cubeMapFaceMap[info.face ?? CubeFace.PX],
          info.texture.object,
          info.level ?? 0,
        );
      } else if (info.texture.isTexture2DArray() || info.texture.isTexture3D()) {
        (this._device.context as WebGL2RenderingContext).framebufferTextureLayer(
          WebGLEnum.FRAMEBUFFER,
          attachment,
          info.texture.object,
          info.level ?? 0,
          info.layer ?? 0
        );
      } else {
        return false;
      }
      return true;
    }
    return false;
  }
  private _bindBuffers(): boolean {
    if (this._options.depthAttachment?.texture) {
      let target: number;
      if (hasStencilChannel(this._options.depthAttachment.texture.format)) {
        target = WebGLEnum.DEPTH_STENCIL_ATTACHMENT;
      } else {
        target = WebGLEnum.DEPTH_ATTACHMENT;
      }
      if (!this._bindAttachment(target, this._options.depthAttachment)) {
        return false;
      }
    }
    for (let i = 0; i < this._options.colorAttachments.length; i++) {
      const opt = this._options.colorAttachments[i];
      if (opt.texture) {
        if (!this._bindAttachment(WebGLEnum.COLOR_ATTACHMENT0 + i, opt)) {
          return false;
        }
      }
    }
    if (this._status === STATUS_UNCHECKED) {
      const status = this._device.context.checkFramebufferStatus(WebGLEnum.FRAMEBUFFER);
      if (status !== WebGLEnum.FRAMEBUFFER_COMPLETE) {
        console.error(`Framebuffer not complete: ${status}`);
        this._status = STATUS_FAILED;
      } else {
        this._status = STATUS_OK;
      }
    }
    return this._status === STATUS_OK;
  }
  private _init(): void {
    this._width = 0;
    this._height = 0;
    for (const colorAttachment of this._options.colorAttachments) {
      if (colorAttachment.texture) {
        if (this._width === 0) {
          this._width = colorAttachment.texture.width;
        }
        if (this._height === 0) {
          this._height = colorAttachment.texture.height;
        }
        if (this._width !== colorAttachment.texture.width || this._height !== colorAttachment.texture.height) {
          console.error('init frame buffer failed: color attachment textures must have same size');
          return;
        }
      }
    }
    if (this._width === 0 || this._height === 0) {
      console.error('init frame buffer failed: can not create frame buffer with zero size');
    }
    this._load();
    this._viewport = [0, 0, this._width, this._height];
  }
  isFramebuffer(): boolean {
    return true;
  }
  getSampleCount(): number {
    return 1;
  }
}
