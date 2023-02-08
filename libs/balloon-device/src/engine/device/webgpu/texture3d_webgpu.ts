import { TextureTarget, TextureFormat, getTextureFormatBlockWidth, getTextureFormatBlockHeight, getTextureFormatBlockSize, linearTextureFormatToSRGB } from '../base_types';
import { WebGPUBaseTexture } from './basetexture_webgpu';
import { GPUResourceUsageFlags, TextureImageElement, Texture3D, GPUDataBuffer } from '../gpuobject';
import { textureFormatMap } from './constants_webgpu';
import type { TypedArray } from '../../defs';
import type { WebGPUDevice } from './device';
import type { WebGPUTextureCap } from './capabilities_webgpu';

export class WebGPUTexture3D extends WebGPUBaseTexture implements Texture3D<GPUTexture> {
  constructor(device: WebGPUDevice) {
    super(device, TextureTarget.Texture2D);
  }
  isTexture3D(): this is Texture3D {
    return true;
  }
  init(): void {
    this.loadEmpty(this._format, this._width, this._height, this._depth, this._mipLevelCount);
  }
  update(
    data: TypedArray,
    xOffset: number,
    yOffset: number,
    zOffset: number,
    width: number,
    height: number,
    depth: number
  ): void {
    if (this._device.isContextLost()) {
      return;
    }
    if (!this._object) {
      this.allocInternal(this._format, this._width, this._height, this._depth, this._mipLevelCount);
    }
    this.uploadRaw(data, width, height, depth, xOffset, yOffset, zOffset, 0);
  }
  updateFromElement(
    data: TextureImageElement,
    xOffset: number,
    yOffset: number,
    zOffset: number,
    width: number,
    height: number,
  ): void {
    if (this._device.isContextLost()) {
      return;
    }
    if (!this._object) {
      this.allocInternal(this._format, this._width, this._height, this._depth, this._mipLevelCount);
    }
    const cvs = document.createElement('canvas');
    cvs.width = width;
    cvs.height = height;
    const ctx = cvs.getContext('2d');
    ctx.drawImage(data, 0, 0, width, height, 0, 0, width, height);
    this.uploadImageData(cvs, width, height, xOffset, yOffset, 0, zOffset);
  }
  createEmpty(format: TextureFormat, width: number, height: number, depth: number, creationFlags?: number): void {
    this._flags = Number(creationFlags) || 0;
    format = (this._flags & GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE) ? format : linearTextureFormatToSRGB(format);
    this.loadEmpty(format, width, height, depth, 0);
  }
  createView(level?: number, face?: number, mipCount?: number): GPUTextureView {
    return this._object ? this._device.gpuCreateTextureView(this._object, {
      dimension: '2d',
      baseMipLevel: 0,
      mipLevelCount: 1,
      baseArrayLayer: face,
      arrayLayerCount: 1,
    }) : null;
  }
  async readPixels(layer: number, x: number, y: number, w: number, h: number, buffer: TypedArray): Promise<void> {
    const blockWidth = getTextureFormatBlockWidth(this.format);
    const blockHeight = getTextureFormatBlockHeight(this.format);
    const blockSize = getTextureFormatBlockSize(this.format);
    const blocksPerRow = this.width / blockWidth;
    const blocksPerCol = this.height / blockHeight;
    const imageSize = blocksPerRow * blocksPerCol * blockSize;
    if (buffer.byteLength < imageSize) {
      throw new Error(`Texture2D.readPixels() failed: destination buffer size is ${buffer.byteLength}, should be at least ${imageSize}`);
    }
    const tmpBuffer = this._device.createBuffer(imageSize, GPUResourceUsageFlags.BF_READ);
    await this.copyPixelDataToBuffer(x, y, w, h, layer, 0, tmpBuffer);
    await tmpBuffer.getBufferSubData(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength), 0, imageSize);
    tmpBuffer.dispose();
  }
  readPixelsToBuffer(layer: number, x: number, y: number, w: number, h: number, buffer: GPUDataBuffer): void {
    this.copyPixelDataToBuffer(x, y, w, h, layer, 0, buffer);
  }
  private loadEmpty(format: TextureFormat, width: number, height: number, depth: number, numMipLevels: number): void {
    this.allocInternal(format, width, height, depth, numMipLevels);
    if (this._mipLevelCount > 1 && !this._device.isContextLost()) {
      this.generateMipmaps();
    }
  }
}
