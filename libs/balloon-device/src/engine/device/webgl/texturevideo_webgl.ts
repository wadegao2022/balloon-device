import { TextureTarget, TextureFormat } from '../base_types';
import { textureTargetMap } from './constants_webgl';
import { WebGLBaseTexture } from './basetexture_webgl';
import { GPUResourceUsageFlags, TextureVideo } from '../gpuobject';
import type { WebGLDevice } from './device_webgl';
import type { WebGLTextureCap } from './capabilities_webgl';

export class WebGLTextureVideo extends WebGLBaseTexture implements TextureVideo<WebGLTexture> {
  private _source: HTMLVideoElement;
  private _callbackId: number;
  constructor(device: WebGLDevice, source: HTMLVideoElement) {
    super(device, TextureTarget.Texture2D);
    this._source = null;
    this._callbackId = null;
    this._format = TextureFormat.Unknown;
    this.loadFromElement(source);
  }
  isTextureVideo(): this is TextureVideo {
    return true;
  }
  get source(): HTMLVideoElement {
    return this._source;
  }
  destroy(): void {
    if (this._source && this._callbackId !== null) {
      this._source.cancelVideoFrameCallback(this._callbackId);
    }
    super.destroy();
  }
  init() {
    this.loadElement(this._source);
  }
  /** @internal */
  loadFromElement(el: HTMLVideoElement): void {
    this._flags = GPUResourceUsageFlags.TF_NO_MIPMAP | GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE;
    this.loadElement(el);
  }
  generateMipmaps() {
    // Does nothing
  }
  /** @internal */
  updateVideoFrame(): boolean {
    if (this.object && this._source.currentTime > 0 && !this._source.requestVideoFrameCallback) {
      this.update();
      return true;
    }
    return false;
  }
  /** @internal */
  private update(): void {
    this.allocInternal(TextureFormat.RGBA8UNORM, this._source.videoWidth, this._source.videoHeight, 1, 1);
    if (!this._device.isContextLost()) {
      const target = textureTargetMap[this._target];
      const params = (this.getTextureCaps() as WebGLTextureCap).getTextureFormatInfo(this._format);
      this._device.context.bindTexture(target, this._object);
      this._device.context.pixelStorei(this._device.context.UNPACK_ALIGNMENT, 1);
      this._device.context.texImage2D(target, 0, params.glInternalFormat, params.glFormat, params.glType[0], this._source);
    }
  }
  /** @internal */
  private loadElement(element: HTMLVideoElement): void {
    if (this._source && this._callbackId !== null) {
      this._source.cancelVideoFrameCallback(this._callbackId);
      this._callbackId = null;
    }
    this._source = element;
    if (this._source?.requestVideoFrameCallback) {
      const that = this;
      that._callbackId = this._source.requestVideoFrameCallback(function cb() {
        if (that._object) {
          that.update();
          that._callbackId = that._source.requestVideoFrameCallback(cb);
        }
      });
    }
    this.allocInternal(TextureFormat.RGBA8UNORM, Math.max(this._source.videoWidth, 1), Math.max(this._source.videoHeight, 1), 1, 1);
  }
}
