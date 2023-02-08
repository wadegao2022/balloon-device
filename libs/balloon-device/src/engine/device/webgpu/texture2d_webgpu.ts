import { ImageLoader, FileLoader } from '../../../shared';
import { TextureTarget, TextureFormat, linearTextureFormatToSRGB, getTextureFormatBlockWidth, getTextureFormatBlockHeight, getTextureFormatBlockSize } from '../base_types';
import { WebGPUBaseTexture } from './basetexture_webgpu';
import { getDDSMipLevelsInfo } from '../../support/dds';
import { GPUResourceUsageFlags, TextureImageElement, TextureMipmapData, Texture2D, GPUDataBuffer } from '../gpuobject';
import type { TypedArray } from '../../defs';
import type { WebGPUDevice } from './device';

export class WebGPUTexture2D extends WebGPUBaseTexture implements Texture2D<GPUTexture> {
  constructor(device: WebGPUDevice) {
    super(device, TextureTarget.Texture2D);
  }
  isTexture2D(): this is Texture2D {
    return true;
  }
  init(): void {
    this.loadEmpty(this._format, this._width, this._height, this._mipLevelCount);
  }
  update(
    data: TypedArray,
    xOffset: number,
    yOffset: number,
    width: number,
    height: number,
  ): void {
    if (this._device.isContextLost()) {
      return;
    }
    if (!this._object) {
      this.allocInternal(this._format, this._width, this._height, 1, this._mipLevelCount);
    }
    this.uploadRaw(data, width, height, 1, xOffset, yOffset, 0, 0);
    if (this._mipLevelCount > 1) {
      this.generateMipmaps();
    }
  }
  updateFromElement(
    data: TextureImageElement,
    xOffset: number,
    yOffset: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    if (this._device.isContextLost()) {
      return;
    }
    if (!this._object) {
      this.allocInternal(this._format, this._width, this._height, 1, this._mipLevelCount);
    }
    if (data instanceof HTMLCanvasElement && x === 0 && y === 0) {
      this.uploadImageData(data, width, height, xOffset, yOffset, 0, 0);
    } else {
      const cvs = document.createElement('canvas');
      cvs.width = width;
      cvs.height = height;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(data, x, y, width, height, 0, 0, width, height);
      this.uploadImageData(cvs, width, height, xOffset, yOffset, 0, 0);
      cvs.width = 0;
      cvs.height = 0;
    }
  }
  async readPixels(x: number, y: number, w: number, h: number, buffer: TypedArray): Promise<void> {
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
    await this.copyPixelDataToBuffer(x, y, w, h, 0, 0, tmpBuffer);
    await tmpBuffer.getBufferSubData(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength), 0, imageSize);
    tmpBuffer.dispose();
  }
  readPixelsToBuffer(x: number, y: number, w: number, h: number, buffer: GPUDataBuffer) {
    this.copyPixelDataToBuffer(x, y, w, h, 0, 0, buffer);
  }
  loadFromElement(element: TextureImageElement, creationFlags?: number): void {
    this._flags = Number(creationFlags) || 0;
    const format = (this._flags & GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE) ? TextureFormat.RGBA8UNORM : TextureFormat.RGBA8UNORM_SRGB;
    this.loadImage(element, format);
  }
  createEmpty(format: TextureFormat, width: number, height: number, creationFlags?: number): void {
    this._flags = Number(creationFlags) || 0;
    format = (this._flags & GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE) ? format : linearTextureFormatToSRGB(format);
    this.loadEmpty(format, width, height, 0);
  }
  createView(level?: number, face?: number, mipCount?: number): GPUTextureView {
    return this._object ? this._device.gpuCreateTextureView(this._object, {
      dimension: '2d',
      baseMipLevel: level ?? 0,
      mipLevelCount: mipCount || this._mipLevelCount - (level ?? 0),
      baseArrayLayer: 0,
      arrayLayerCount: 1,
    }) : null;
  }
  createWithMipmapData(data: TextureMipmapData, creationFlags?: number): void {
    if (data.isCubemap || data.isVolume) {
      console.error('loading 2d texture with mipmap data failed: data is not 2d texture');
    } else {
      this._flags = Number(creationFlags) || 0;
      if (this._flags & GPUResourceUsageFlags.TF_WRITABLE) {
        console.error(new Error('webgl device does not support storage texture'));
      } else {
        this.loadLevels(data);
      }
    }
  }
  /** @internal */
  async loadFromURL(url: string, mimeType?: string, creationFlags?: number): Promise<void> {
    this._flags = Number(creationFlags) || 0;
    await this.loadURL(url, mimeType);
  }
  /** @internal */
  private guessTextureFormat(url: string, mimeType?: string) {
    if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
      return this.linearColorSpace ? TextureFormat.RGBA8UNORM : TextureFormat.RGBA8UNORM_SRGB;
    }
    const dataURIRegex = /^data:(.*?)(;base64)?,(.*)$/;
    const matchResult = url.match(dataURIRegex);
    if (matchResult) {
      const type = matchResult[1];
      if (type.indexOf('image/jpeg') >= 0 || type.indexOf('image/png') >= 0) {
        return this.linearColorSpace ? TextureFormat.RGBA8UNORM : TextureFormat.RGBA8UNORM_SRGB;
      }
    } else {
      const pindex = url.indexOf('?');
      if (pindex >= 0) {
        url = url.substring(0, pindex);
      }
      const eindex = url.lastIndexOf('.');
      if (eindex >= 0) {
        const ext = url.substring(eindex + 1).toLowerCase();
        if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
          return this.linearColorSpace ? TextureFormat.RGBA8UNORM : TextureFormat.RGBA8UNORM_SRGB;
        }
      }
    }
    return TextureFormat.Unknown;
  }
  /** @internal */
  private loadEmpty(format: TextureFormat, width: number, height: number, numMipLevels: number): void {
    this.allocInternal(format, width, height, 1, numMipLevels);
    if (this._mipLevelCount > 1 && !this._device.isContextLost()) {
      this.generateMipmaps();
    }
  }
  /** @internal */
  private loadLevels(levels: TextureMipmapData): void {
    const sRGB = !(this._flags & GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE);
    let format = sRGB ? linearTextureFormatToSRGB(levels.format) : levels.format;
    let swizzle = false;
    if (format === TextureFormat.BGRA8UNORM) {
      format = TextureFormat.RGBA8UNORM;
      swizzle = true;
    } else if (this._format === TextureFormat.BGRA8UNORM_SRGB) {
      format = TextureFormat.RGBA8UNORM_SRGB;
      swizzle = true;
    }
    const width = levels.width;
    const height = levels.height;
    const mipLevelCount = levels.mipLevels;
    if (levels.isCompressed) {
      if (sRGB ? !this._device.getTextureCaps().supportS3TCSRGB : !this._device.getTextureCaps().supportS3TC) {
        console.error('No s3tc compression format support');
        return;
      }
    }
    this.allocInternal(format, width, height, 1, mipLevelCount);
    if (!this._device.isContextLost()) {
      for (let i = 0; i < levels.mipDatas[0].length; i++) {
        if (swizzle) {
          // convert bgra to rgba
          for (let j = 0; j < levels.mipDatas[0][i].width * levels.mipDatas[0][i].height; j++) {
            const t = levels.mipDatas[0][i].data[j * 4];
            levels.mipDatas[0][i].data[j * 4] = levels.mipDatas[0][i].data[j * 4 + 2];
            levels.mipDatas[0][i].data[j * 4 + 2] = t;
          }
        }
        this.uploadRaw(levels.mipDatas[0][i].data, levels.mipDatas[0][i].width, levels.mipDatas[0][i].height, 1, 0, 0, 0, i);
      }
    }
  }
  /** @internal */
  private async loadURL(url: string, mimeType: string): Promise<void> {
    const format = this.guessTextureFormat(url, mimeType);
    if (format !== TextureFormat.Unknown) {
      const img = await new ImageLoader(null).load(url);
      const imageBitmap = await createImageBitmap(img, {
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none',
      });
      this.loadImage(imageBitmap, format);
    } else {
      const fileData = (await new FileLoader(null, 'arraybuffer').load(url)) as ArrayBuffer;
      const ddsLevelsInfo = getDDSMipLevelsInfo(fileData);
      if (!ddsLevelsInfo) {
        console.error(new Error('Load DDS'));
        return;
      }
      this.loadLevels(ddsLevelsInfo);
    }
  }
  /** @internal */
  private loadImage(element: TextureImageElement, format: TextureFormat): void {
    this.allocInternal(format, Number(element.width), Number(element.height), 1, 0);
    if (!this._device.isContextLost()) {
      this.uploadImageData(element, this._width, this._height, 0, 0, 0, 0);
      if (this._mipLevelCount > 1) {
        this.generateMipmaps();
      }
    }
  }
}
