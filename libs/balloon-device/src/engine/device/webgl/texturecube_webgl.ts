import { FileLoader, ImageLoader } from '../../../shared';
import { getDDSMipLevelsInfo } from '../../support/dds';
import { TypedArray } from '../../defs';
import { TextureFormat, TextureTarget, linearTextureFormatToSRGB } from '../base_types';
import { WebGLBaseTexture } from './basetexture_webgl';
import { textureTargetMap, cubeMapFaceMap } from './constants_webgl';
import { GPUResourceUsageFlags, TextureMipmapData, TextureCube, TextureImageElement, GPUDataBuffer } from '../gpuobject';
import { CubeFace } from '../../math';
import type { WebGLDevice } from './device_webgl';
import type { WebGLTextureCap } from './capabilities_webgl';

export class WebGLTextureCube extends WebGLBaseTexture implements TextureCube<WebGLTexture> {
  constructor(device: WebGLDevice) {
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
    const params = (this.getTextureCaps() as WebGLTextureCap).getTextureFormatInfo(this._format);
    this._device.context.bindTexture(textureTargetMap[this._target], this._object);
    this._device.context.pixelStorei(this._device.context.UNPACK_ALIGNMENT, 1);
    this._device.context.texSubImage2D(
      cubeMapFaceMap[face],
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
  updateFromElement(data: TextureImageElement, xOffset: number, yOffset: number, face: number, x: number, y: number, width: number, height: number): void {
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
      this._device.context.texSubImage2D(cubeMapFaceMap[face], 0, xOffset, yOffset, params.glFormat, params.glType[0], data);
    } else {
      const cvs = document.createElement('canvas');
      cvs.width = width;
      cvs.height = height;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(data, x, y, width, height, 0, 0, width, height);
      this._device.context.texSubImage2D(textureTargetMap[this._target], 0, xOffset, yOffset, params.glFormat, params.glType[0], cvs);
      cvs.width = 0;
      cvs.height = 0;
    }
    if (this._mipLevelCount > 1) {
      this.generateMipmaps();
    }
  }
  createEmpty(format: TextureFormat, size: number, creationFlags?: number): void {
    this._flags = Number(creationFlags) || 0;
    if (this._flags & GPUResourceUsageFlags.TF_WRITABLE) {
      console.error(new Error('webgl device does not support storage texture'));
    } else {
      format = (this._flags & GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE) ? format : linearTextureFormatToSRGB(format);
      this.loadEmpty(format, size, 0);
    }
  }
  readPixels(face: number, x: number, y: number, w: number, h: number, buffer: TypedArray): Promise<void> {
    return new Promise<void>(resolve => {
      const fb = this._device.createFrameBuffer({
        colorAttachments: [{ texture: this, face }]
      });
      const savedViewport = this._device.getViewport() as [number, number, number, number];
      const savedScissor = this._device.getScissor() as [number, number, number, number];
      const savedFB = this._device.getFramebuffer();
      this._device.setFramebuffer(fb);
      this._device.readPixels(x, y, w, h, buffer).then(() => {
        fb.dispose();
        resolve();
      });
      this._device.setFramebuffer(savedFB);
      this._device.setViewport(...savedViewport);
      this._device.setScissor(...savedScissor);
    });
  }
  readPixelsToBuffer(face: number, x: number, y: number, w: number, h: number, buffer: GPUDataBuffer): void {
    const fb = this._device.createFrameBuffer({
      colorAttachments: [{ texture: this, face: face }]
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
  /** @internal */
  loadFaceImages(images: HTMLImageElement[], creationFlags?: number): void {
    if (images.length !== 6) {
      console.error(new Error('cube map must be loaded from 6 image elements'));
    } else if (this._flags & GPUResourceUsageFlags.TF_WRITABLE) {
      console.error(new Error('webgl device does not support storage texture'));
    } else {
      const format = (this._flags & GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE) ? TextureFormat.RGBA8UNORM : TextureFormat.RGBA8UNORM_SRGB;
      this.loadImages(images, format);
    }
  }
  isTextureCube(): this is TextureCube {
    return true;
  }
  generateMipmaps() {
    if (this._object && this._mipLevelCount > 1) {
      const target = textureTargetMap[this._target];
      this._device.context.bindTexture(target, this._object);
      this._device.context.generateMipmap(target);
    }
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
      console.error(new Error('webgl device does not support storage texture'));
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
      (this.device as WebGLDevice).clearErrors();
      this._device.context.bindTexture(textureTargetMap[this._target], this._object);
      const params = (this.getTextureCaps() as WebGLTextureCap).getTextureFormatInfo(this._format);
      for (let face = 0; face < 6; face++) {
        this._device.context.texSubImage2D(
          cubeMapFaceMap[face],
          0,
          0,
          0,
          params.glFormat,
          params.glType[0],
          images[face]
        );
        const err = (this.device as WebGLDevice).getError();
        if (err) {
          console.error(err);
          return;
        }
      }
      if (this._mipLevelCount > 1) {
        this.generateMipmaps();
      }
    }
  }
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
      const params = (this.getTextureCaps() as WebGLTextureCap).getTextureFormatInfo(this._format);
      this._device.context.bindTexture(textureTargetMap[this._target], this._object);
      (this.device as WebGLDevice).clearErrors();
      for (let face = 0; face < 6; face++) {
        const faceTarget = cubeMapFaceMap[face];
        if (this._mipLevelCount > 1 && levels.mipDatas[face].length !== this._mipLevelCount) {
          console.log(`invalid texture data`);
          return;
        }
        for (let i = 0; i < this._mipLevelCount; i++) {
          if (levels.isCompressed) {
            this._device.context.compressedTexSubImage2D(
              faceTarget,
              i,
              0,
              0,
              levels.mipDatas[face][i].width,
              levels.mipDatas[face][i].height,
              params.glInternalFormat,
              levels.mipDatas[face][i].data,
            );
          } else {
            this._device.context.texSubImage2D(
              faceTarget,
              i,
              0,
              0,
              levels.mipDatas[face][i].width,
              levels.mipDatas[face][i].height,
              params.glFormat,
              params.glType[0],
              levels.mipDatas[face][i].data,
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
  }
}
