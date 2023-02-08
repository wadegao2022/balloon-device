import { WebGLGPUObject } from './gpuobject_webgl';
import { TextureCaps } from '../device';
import { TextureTarget, TextureFilter, TextureWrapping, TextureFormat, CompareFunc, isCompressedTextureFormat, isDepthTextureFormat, isFloatTextureFormat, isIntegerTextureFormat, isSignedTextureFormat } from '../base_types';
import { GPUResourceUsageFlags, SamplerOptions, BaseTexture } from '../gpuobject';
import { isPowerOf2 } from '../../defs';
import { cubeMapFaceMap, textureTargetMap } from './constants_webgl';
import { isWebGL2 } from './utils';
import { WebGLEnum } from './webgl_enum';
import type { WebGLTextureCap, ITextureFormatInfoWebGL } from './capabilities_webgl';
import type { TextureSampler } from '../gpuobject';
import type { WebGLTextureSampler } from './sampler_webgl';
import type { WebGLDevice } from './device_webgl';

export abstract class WebGLBaseTexture extends WebGLGPUObject<WebGLTexture> {
  protected _target: TextureTarget;
  protected _memCost: number;
  protected _flags: number;
  protected _width: number;
  protected _height: number;
  protected _depth: number;
  protected _format: TextureFormat;
  protected _mipLevelCount: number;
  protected _sampler: WebGLTextureSampler;
  constructor(device: WebGLDevice, target?: TextureTarget) {
    super(device);
    this._target = target || TextureTarget.Texture2D;
    this._memCost = 0;
    this._flags = 0;
    this._width = 0;
    this._height = 0;
    this._depth = 1;
    this._format = TextureFormat.Unknown;
    this._mipLevelCount = 0;
    this._sampler = null;
  }
  get target() {
    return this._target;
  }
  get linearColorSpace() {
    return !!(this._flags & GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE);
  }
  get width() {
    return this._width;
  }
  get height() {
    return this._height;
  }
  get depth() {
    return this._depth;
  }
  get format() {
    return this._format;
  }
  get mipLevelCount(): number {
    return this._mipLevelCount;
  }
  get sampler(): TextureSampler {
    return this._sampler;
  }
  set sampler(s: TextureSampler) {
    if (s !== this._sampler) {
      this._sampler = s as WebGLTextureSampler;
      if (this._sampler && !this._device.isWebGL2) {
        this._sampler.apply(this);
      }
    }
  }
  /** @internal */
  get currentSampler(): WebGLTextureSampler {
    return this._sampler;
  }
  isFilterable(): boolean {
    if (!this.getTextureCaps().getTextureFormatInfo(this._format)?.filterable) {
      return false;
    }
    if (!(this.device as WebGLDevice).isWebGL2 && !isPowerOf2(this._width) && !isPowerOf2(this._height)) {
      return false;
    }
    return true;
  }
  destroy(): void {
    if (this._object) {
      this._device.context.deleteTexture(this._object);
      this._object = null;
      this._device.updateVideoMemoryCost(-this._memCost);
      this._memCost = 0;
    }
  }
  async restore() {
    if (!this._object && !this._device.isContextLost()) {
      this.init();
      this.sampler = null;
    }
  }
  isTexture(): this is BaseTexture {
    return true;
  }
  getTextureCaps(): TextureCaps {
    return this._device.getTextureCaps();
  }
  isFloatFormat(): boolean {
    return isFloatTextureFormat(this._format);
  }
  isIntegerFormat(): boolean {
    return isIntegerTextureFormat(this._format);
  }
  isSignedFormat(): boolean {
    return isSignedTextureFormat(this._format);
  }
  isCompressedFormat(): boolean {
    return isCompressedTextureFormat(this._format);
  }
  isDepth(): boolean {
    return isDepthTextureFormat(this._format);
  }
  getDefaultSampler(shadow: boolean): TextureSampler {
    const params = (this.getTextureCaps() as WebGLTextureCap).getTextureFormatInfo(this._format);
    return this._device.createSampler(this._getSamplerOptions(params, shadow));
  }
  abstract generateMipmaps(): void;
  abstract init(): void;
  /** @internal */
  protected allocInternal(format: TextureFormat, width: number, height: number, depth: number, numMipLevels: number) {
    if (numMipLevels === 0) {
      numMipLevels = this._calcMipLevelCount(format, width, height, depth);
    } else if (numMipLevels !== 1) {
      const autoMipLevelCount = this._calcMipLevelCount(format, width, height, depth);
      if (!Number.isInteger(numMipLevels) || numMipLevels < 0 || numMipLevels > autoMipLevelCount) {
        numMipLevels = autoMipLevelCount;
      }
    }
    if (this._object && (this._format !== format || this._width !== width || this._height !== height || this._depth !== depth, this._mipLevelCount !== numMipLevels)) {
      const obj = this._object;
      this._device.runNextFrame(() => {
        this._device.context.deleteTexture(obj);
      });
      this._object = null;
    }
    if (!this._object) {
      this._format = format;
      this._width = width;
      this._height = height;
      this._depth = depth;
      this._mipLevelCount = numMipLevels;
      if (!this._device.isContextLost()) {
        this._object = this._device.context.createTexture();
        const gl = this._device.context;
        gl.bindTexture(textureTargetMap[this._target], this._object);
        const params = (this.getTextureCaps() as WebGLTextureCap).getTextureFormatInfo(this._format);
        if (isWebGL2(gl) && !this.isTextureVideo()) {
          if (!this.isTexture3D() && !this.isTexture2DArray()) {
            gl.texStorage2D(textureTargetMap[this._target], this._mipLevelCount, params.glInternalFormat, this._width, this._height);
          } else {
            gl.texStorage3D(textureTargetMap[this._target], this._mipLevelCount, params.glInternalFormat, this._width, this._height, this._depth);
          }
          this._device.context.texParameteri(textureTargetMap[this._target], WebGLEnum.TEXTURE_BASE_LEVEL, 0);
          this._device.context.texParameteri(textureTargetMap[this._target], WebGLEnum.TEXTURE_MAX_LEVEL, this._mipLevelCount - 1);
        } else {
          let w = this._width;
          let h = this._height;
          for (let mip = 0; mip < numMipLevels; mip++) {
            if (this.isTextureCube()) {
              for (let face = 0; face < 6; face++) {
                const faceTarget = cubeMapFaceMap[face];
                this._device.context.texImage2D(faceTarget, mip, params.glInternalFormat, w, h, 0, params.glFormat, params.glType[0], null);
              }
            } else {
              this._device.context.texImage2D(textureTargetMap[this._target], mip, params.glInternalFormat, w, h, 0, params.glFormat, params.glType[0], null);
            }
            w = Math.max(w >> 1, 1);
            h = Math.max(h >> 1, 1);
          }
        }
        const k = this.isTextureCube() ? 6 : 1;
        const memCost = (this.getTextureCaps() as WebGLTextureCap).calcMemoryUsage(this._format, params.glType[0], this._width * this._height * this._depth * k);
        this._device.updateVideoMemoryCost(memCost - this._memCost);
        this._memCost = memCost;
      }
    }
  }
  /** @internal */
  protected _calcMipLevelCount(format: TextureFormat, width: number, height: number, depth: number): number {
    if (isDepthTextureFormat(format) || this.isTexture3D() || this.isTextureVideo()) {
      return 1;
    }
    if (this._flags & GPUResourceUsageFlags.TF_NO_MIPMAP) {
      return 1;
    }
    if (!this._device.isWebGL2 && (!isPowerOf2(width) || !isPowerOf2(height))) {
      return 1;
    }
    const params = (this.getTextureCaps() as WebGLTextureCap).getTextureFormatInfo(format);
    if (!params || !params.renderable) {
      return 1;
    }
    return Math.floor(Math.log2(Math.max(width, height))) + 1;
  }
  /** @internal */
  protected _getSamplerOptions(params: ITextureFormatInfoWebGL, shadow: boolean): SamplerOptions {
    const comparison = this.isDepth() && shadow;
    const filterable = params.filterable || comparison;
    const magFilter = filterable
      ? TextureFilter.Linear
      : TextureFilter.Nearest;
    const minFilter = filterable
      ? TextureFilter.Linear
      : TextureFilter.Nearest;
    const mipFilter = this._mipLevelCount > 1
      ? filterable ? TextureFilter.Linear : TextureFilter.Nearest
      : TextureFilter.None;
    const addressU = TextureWrapping.ClampToEdge
    const addressV = TextureWrapping.ClampToEdge
    const addressW = TextureWrapping.ClampToEdge
    const compare = comparison ? CompareFunc.LessEqual : null;
    return {
      addressU,
      addressV,
      addressW,
      magFilter,
      minFilter,
      mipFilter,
      compare,
    };
  }
}
