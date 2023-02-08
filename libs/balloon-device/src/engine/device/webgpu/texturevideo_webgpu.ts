import { WebGPUBaseTexture } from './basetexture_webgpu';
import { TextureVideo } from '../gpuobject';
import type { WebGPUDevice } from './device';

export class WebGPUTextureVideo extends WebGPUBaseTexture<GPUExternalTexture> implements TextureVideo<GPUExternalTexture> {
  private _source: HTMLVideoElement;
  constructor(device: WebGPUDevice, element: HTMLVideoElement) {
    super(device);
    this._source = element;
    this._width = 0;
    this._height = 0;
    this.loadFromElement();
  }
  isTextureVideo(): this is TextureVideo {
    return true;
  }
  get width(): number {
    return this._width;
  }
  get height(): number {
    return this._height;
  }
  get source(): HTMLVideoElement {
    return this._source;
  }
  async restore() {
    if (!this._object && !this._device.isContextLost()) {
      this.loadElement(this._source);
    }
  }
  updateVideoFrame(): boolean {
    if ((!this._object || this._object.expired || this._object.expired === undefined) && this._source.readyState > 2) {
      this._object = this._device.gpuImportExternalTexture(this._source);
      return true;
    }
    return false;
  }
  createView(level?: number, face?: number, mipCount?: number): GPUTextureView {
    return null;
  }
  init(): void {
    this.loadFromElement();
  }
  /** @internal */
  loadFromElement(): void {
    this.loadElement(this._source);
  }
  /** @internal */
  private loadElement(element: HTMLVideoElement): boolean {
    this._width = element.videoWidth;
    this._height = element.videoHeight;
    if (!this._device.isContextLost()) {
      if (element.readyState > 2) {
        this._object = this._device.gpuImportExternalTexture(element);
      }
    }
    return !!this._object;
  }
}
