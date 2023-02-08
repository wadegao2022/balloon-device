import { FileLoader, ImageLoader } from '../../../shared';
import { getDDSMipLevelsInfo } from '../../support/dds';
import { TextureFormat, TextureTarget, linearTextureFormatToSRGB, getTextureFormatBlockWidth, getTextureFormatBlockHeight, getTextureFormatBlockSize } from '../base_types';
import { WebGPUBaseTexture } from './basetexture_webgpu';
import { GPUResourceUsageFlags, TextureMipmapData, TextureCube, TextureImageElement, GPUDataBuffer } from '../gpuobject';
import { TypedArray } from '../../defs';
import { CubeFace } from '../../math';
import type { WebGPUDevice } from './device';

export class WebGPUTextureCube extends WebGPUBaseTexture implements TextureCube<GPUTexture> {
  constructor(device: WebGPUDevice) {
    super(device, TextureTarget.TextureCubemap);
  }
  init(): void {
    this.loadEmpty(this._format, this._width, this._mipLevelCount);
  }
  update(
    data: TypedArray,
    xOffset: number,
    yOffset: number,
    width: number,
    height: number,
    face: CubeFace,
  ): void {
    if (this._device.isContextLost()) {
      return;
    }
    if (!this._object) {
      this.allocInternal(this._format, this._width, this._height, 1, this._mipLevelCount);
    }
    this.uploadRaw(data, width, height, 1, xOffset, yOffset, face, 0);
    if (this._mipLevelCount > 1) {
      this.generateMipmaps();
    }
  }
  updateFromElement(data: TextureImageElement, xOffset: number, yOffset: number, face: number, x: number, y: number, width: number, height: number): void {
    if (this._device.isContextLost()) {
      return;
    }
    if (!this._object) {
      this.allocInternal(this._format, this._width, this._height, 1, this._mipLevelCount);
    }
    if (data instanceof HTMLCanvasElement && x === 0 && y === 0) {
      this.uploadImageData(data, width, height, xOffset, yOffset, 0, face || 0);
    } else {
      const cvs = document.createElement('canvas');
      cvs.width = width;
      cvs.height = height;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(data, x, y, width, height, 0, 0, width, height);
      this.uploadImageData(cvs, width, height, xOffset, yOffset, 0, face || 0);
      cvs.width = 0;
      cvs.height = 0;
    }
  }
  createEmpty(format: TextureFormat, size: number, creationFlags?: number): void {
    this._flags = Number(creationFlags) || 0;
    if (this._flags & GPUResourceUsageFlags.TF_WRITABLE) {
      console.error(new Error('storage texture can not be cube texture'));
    } else {
      format = (this._flags & GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE) ? format : linearTextureFormatToSRGB(format);
      this.loadEmpty(format, size, 0);
    }
  }
  /** @internal */
  loadFaceImages(images: HTMLImageElement[], creationFlags?: number): void {
    this._flags = Number(creationFlags) || 0;
    if (this._flags & GPUResourceUsageFlags.TF_WRITABLE) {
      console.error(new Error('storage texture can not be cube texture'));
    } else {
      const format = (this._flags & GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE) ? TextureFormat.RGBA8UNORM : TextureFormat.RGBA8UNORM_SRGB;
      this.loadImages(images, format);
    }
  }
  isTextureCube(): this is TextureCube {
    return true;
  }
  createView(level?: number, face?: number, mipCount?: number): GPUTextureView {
    return this._object ? this._device.gpuCreateTextureView(this._object, {
      format: this._gpuFormat,
      dimension: '2d',
      baseMipLevel: level ?? 0,
      mipLevelCount: mipCount || this._mipLevelCount - (level ?? 0),
      baseArrayLayer: face ?? 0,
      arrayLayerCount: 1,
      aspect: 'all',
    }) : null;
  }
  async readPixels(face: number, x: number, y: number, w: number, h: number, buffer: TypedArray): Promise<void> {
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
    await this.copyPixelDataToBuffer(x, y, w, h, face, 0, tmpBuffer);
    await tmpBuffer.getBufferSubData(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength), 0, imageSize);
    tmpBuffer.dispose();
  }
  readPixelsToBuffer(face: number, x: number, y: number, w: number, h: number, buffer: GPUDataBuffer): void {
    this.copyPixelDataToBuffer(x, y, w, h, face, 0, buffer);
  }
  createWithMipmapData(data: TextureMipmapData, creationFlags?: number): void {
    if (!data.isCubemap) {
      console.error('loading cubmap with mipmap data failed: data is not cubemap');
    } else {
      this._flags = Number(creationFlags) || 0;
      if (this._flags & GPUResourceUsageFlags.TF_WRITABLE) {
        console.error('webgl device does not support storage texture');
      } else {
        this.loadLevels(data);
      }
    }
  }
  /** @internal */
  async loadFromURL(url: string | string[], mimeType?: string, creationFlags?: number) {
    this._flags = Number(creationFlags) || 0;
    if (this._flags & GPUResourceUsageFlags.TF_WRITABLE) {
      console.error(new Error('storage texture can not be cube texture'));
    } else {
      await this.loadURL(url, mimeType);
    }
  }
  /** @internal */
  private loadEmpty(format: TextureFormat, size: number, mipLevelCount: number): void {
    this.allocInternal(format, size, size, 1, mipLevelCount);
    if (this._mipLevelCount > 1 && !this._device.isContextLost()) {
      this.generateMipmaps();
    }
  }
  /** @internal */
  private loadImages(images: HTMLImageElement[], format: TextureFormat): void {
    const width = images[0].width;
    const height = images[0].height;
    if (images.length !== 6) {
      console.error(new Error('cubemap face list must have 6 images'));
      return;
    }
    for (let i = 1; i < 6; i++) {
      if (images[i].width !== width || images[i].height !== height) {
        console.error(new Error('cubemap face images must have identical sizes'));
        return;
      }
    }
    if (width === 0 || height === 0) {
      return;
    }
    this.allocInternal(format, width, height, 1, 0);
    if (!this._device.isContextLost()) {
      const w = this._width;
      const h = this._height;
      for (let face = 0; face < 6; face++) {
        createImageBitmap(images[face], {
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'none',
        }).then((bmData) => {
          this.uploadImageData(bmData, w, h, 0, 0, 0, 0);
        });
      }
      if (this._mipLevelCount > 1) {
        this.generateMipmaps();
      }
    }
  }
  /** @internal */
  private async loadURL(url: string | string[], mimeType: string): Promise<void> {
    if (typeof url === 'string') {
      if (url.split('.').slice(-1)[0] === 'dds' || mimeType === 'image/dds') {
        const fileData = (await new FileLoader(null, 'arraybuffer').load(url)) as ArrayBuffer;
        const ddsLevelsInfo = getDDSMipLevelsInfo(fileData);
        if (!ddsLevelsInfo) {
          console.error(new Error('Load DDS'));
          return;
        }
        this.loadLevels(ddsLevelsInfo);
      } else {
        console.error(new Error(`unknown mime type of image: ${url}`));
      }
    } else if (url.length === 6) {
      const images: HTMLImageElement[] = Array.from({ length: 6 });
      images[0] = await new ImageLoader().load(url[0]);
      images[1] = await new ImageLoader().load(url[1]);
      images[2] = await new ImageLoader().load(url[2]);
      images[3] = await new ImageLoader().load(url[3]);
      images[4] = await new ImageLoader().load(url[4]);
      images[5] = await new ImageLoader().load(url[5]);
      const format = (this._flags & GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE) ? TextureFormat.RGBA8UNORM : TextureFormat.RGBA8UNORM_SRGB;
      this.loadImages(images, format);
    }
  }
  /** @internal */
  private loadLevels(levels: TextureMipmapData): void {
    const sRGB = !(this._flags & GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE);
    const format = sRGB ? linearTextureFormatToSRGB(levels.format) : levels.format;
    const width = levels.width;
    const height = levels.height;
    const mipLevelCount = levels.mipLevels;
    if (levels.isCompressed) {
      if (sRGB ? !this._device.getTextureCaps().supportS3TCSRGB : !this._device.getTextureCaps().supportS3TC) {
        console.warn('No s3tc compression format support');
        return;
      }
    }
    this.allocInternal(format, width, height, 1, mipLevelCount);
    if (!this._device.isContextLost()) {
      for (let face = 0; face < 6; face++) {
        for (let i = 0; i < levels.mipDatas[face].length; i++) {
          this.uploadRaw(levels.mipDatas[face][i].data, levels.mipDatas[face][i].width, levels.mipDatas[face][i].height, 1, 0, 0, face, i);
        }
      }
    }
  }
}
