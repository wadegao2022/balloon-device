import { ImageLoader, FileLoader } from '../../../shared';
import { TextureTarget, TextureFormat, linearTextureFormatToSRGB } from '../base_types';
import { textureTargetMap } from './constants_webgl';
import { WebGLBaseTexture } from './basetexture_webgl';
import { getDDSMipLevelsInfo } from '../../support/dds';
import { GPUResourceUsageFlags, TextureImageElement, TextureMipmapData, Texture2D, GPUDataBuffer } from '../gpuobject';
import type { WebGLDevice } from './device_webgl';
import type { WebGLTextureCap } from './capabilities_webgl';
import type { TypedArray } from '../../../shared';

export class WebGLTexture2D extends WebGLBaseTexture implements Texture2D<WebGLTexture> {
  constructor(device: WebGLDevice) {
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
    const params = (this.getTextureCaps() as WebGLTextureCap).getTextureFormatInfo(this._format);
    this._device.context.bindTexture(textureTargetMap[this._target], this._object);
    this._device.context.pixelStorei(this._device.context.UNPACK_ALIGNMENT, 1);
    this._device.context.texSubImage2D(
      textureTargetMap[this._target],
      0,
      xOffset,
      yOffset,
      width,
      height,
      params.glFormat,
      params.glType[0],
      data,
    );
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
    const params = (this.getTextureCaps() as WebGLTextureCap).getTextureFormatInfo(this._format);
    this._device.context.bindTexture(textureTargetMap[this._target], this._object);
    this._device.context.pixelStorei(this._device.context.UNPACK_ALIGNMENT, 1);
    if (x === 0 && y === 0 && width === data.width && height === data.height) {
      this._device.context.texSubImage2D(
        textureTargetMap[this._target],
        0,
        xOffset,
        yOffset,
        params.glFormat,
        params.glType[0],
        data,
      );
    } else {
      const cvs = document.createElement('canvas');
      cvs.width = width;
      cvs.height = height;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(data, x, y, width, height, 0, 0, width, height);
      this._device.context.texSubImage2D(
        textureTargetMap[this._target],
        0,
        xOffset,
        yOffset,
        params.glFormat,
        params.glType[0],
        cvs,
      );
      cvs.width = 0;
      cvs.height = 0;
    }
    if (this._mipLevelCount > 1) {
      this.generateMipmaps();
    }
  }
  async readPixels(x: number, y: number, w: number, h: number, buffer: TypedArray): Promise<void> {
    if (!this.device.isContextLost() && !this.disposed) {
      const fb = this._device.createFrameBuffer({
        colorAttachments: [{ texture: this }]
      });
      const savedViewport = this._device.getViewport() as [number, number, number, number];
      const savedScissor = this._device.getScissor() as [number, number, number, number];
      const savedFB = this._device.getFramebuffer();
      this._device.setFramebuffer(fb);
      await this._device.readPixels(x, y, w, h, buffer)
      fb.dispose();
      this._device.setFramebuffer(savedFB);
      this._device.setViewport(...savedViewport);
      this._device.setScissor(...savedScissor);
    }
  }
  readPixelsToBuffer(x: number, y: number, w: number, h: number, buffer: GPUDataBuffer): void {
    if (!this.device.isContextLost() && !this.disposed) {
      const fb = this._device.createFrameBuffer({
        colorAttachments: [{ texture: this }]
      });
      const savedViewport = this._device.getViewport() as [number, number, number, number];
      const savedScissor = this._device.getScissor() as [number, number, number, number];
      const savedFB = this._device.getFramebuffer();
      this._device.setFramebuffer(fb);
      this._device.readPixelsToBuffer(x, y, w, h, buffer);
      this._device.setFramebuffer(savedFB);
      this._device.setViewport(...savedViewport);
      this._device.setScissor(...savedScissor);
      fb.dispose();
    }
  }
  loadFromElement(element: TextureImageElement, creationFlags?: number) {
    this._flags = Number(creationFlags) || 0;
    if (this._flags & GPUResourceUsageFlags.TF_WRITABLE) {
      console.error(new Error('webgl device does not support storage texture'));
    } else {
      const format = (this._flags & GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE) ? TextureFormat.RGBA8UNORM : TextureFormat.RGBA8UNORM_SRGB;
      this.loadImage(element, format);
    }
  }
  createEmpty(format: TextureFormat, width: number, height: number, creationFlags?: number): void {
    this._flags = Number(creationFlags) || 0;
    if (this._flags & GPUResourceUsageFlags.TF_WRITABLE) {
      console.error(new Error('webgl device does not support storage texture'));
    } else {
      format = (this._flags & GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE) ? format : linearTextureFormatToSRGB(format);
      this.loadEmpty(format, width, height, 0);
    }
  }
  generateMipmaps() {
    if (this._object && this._mipLevelCount > 1) {
      const target = textureTargetMap[this._target];
      this._device.context.bindTexture(target, this._object);
      this._device.context.generateMipmap(target);
    }
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
    if (this._flags & GPUResourceUsageFlags.TF_WRITABLE) {
      console.error(new Error('webgl device does not support storage texture'));
    } else {
      await this.loadURL(url, mimeType);
    }
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
        console.warn('No s3tc compression format support');
        return;
      }
    }
    this.allocInternal(format, width, height, 1, mipLevelCount);
    if (!this._device.isContextLost()) {
      const params = (this.getTextureCaps() as WebGLTextureCap).getTextureFormatInfo(this._format);
      const target = textureTargetMap[this._target];
      this._device.context.bindTexture(target, this._object);
      (this.device as WebGLDevice).clearErrors();
      for (let i = 0; i < this._mipLevelCount; i++) {
        if (levels.isCompressed) {
          this._device.context.compressedTexSubImage2D(
            target,
            i,
            0,
            0,
            levels.mipDatas[0][i].width,
            levels.mipDatas[0][i].height,
            params.glInternalFormat,
            levels.mipDatas[0][i].data,
          );
        } else {
          if (swizzle) {
            // convert bgra to rgba
            for (let j = 0; j < levels.mipDatas[0][i].width * levels.mipDatas[0][i].height; j++) {
              const t = levels.mipDatas[0][i].data[j * 4];
              levels.mipDatas[0][i].data[j * 4] = levels.mipDatas[0][i].data[j * 4 + 2];
              levels.mipDatas[0][i].data[j * 4 + 2] = t;
            }
          }
          this._device.context.texSubImage2D(
            target,
            i,
            0,
            0,
            levels.mipDatas[0][i].width,
            levels.mipDatas[0][i].height,
            params.glFormat,
            params.glType[0],
            levels.mipDatas[0][i].data,
          );
        }
        const err = (this.device as WebGLDevice).getError();
        if (err) {
          console.error(err);
          return;
        }
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
      const params = (this.getTextureCaps() as WebGLTextureCap).getTextureFormatInfo(this._format);
      (this.device as WebGLDevice).clearErrors();
      const target = textureTargetMap[this._target];
      this._device.context.bindTexture(target, this._object);
      this._device.context.pixelStorei(this._device.context.UNPACK_ALIGNMENT, 4);
      this._device.context.texSubImage2D(
        target,
        0,
        0,
        0,
        params.glFormat,
        params.glType[0],
        element,
      );
      const err = (this.device as WebGLDevice).getError();
      if (err) {
        console.error(err);
        false;
      }
      if (this._mipLevelCount > 1) {
        this.generateMipmaps();
      }
    }
  }
}
