import { ShadowImpl } from "./shadow_impl";
import { GaussianBlurBlitter, BlitType } from "../blitter";
import { computeShadowMapDepth, filterShadowESM } from "../renderers/shadowmap.shaderlib";
import { ShaderLib } from "../materiallib";
import { Device, FrameBuffer, TextureTarget, TextureFormat, GPUResourceUsageFlags, PBShaderExp, PBInsideFunctionScope, TextureSampler } from "../../device";
import type { ShadowMapper, ShadowMapType, ShadowMode } from "./shadowmapper";

class BlurBlitter extends GaussianBlurBlitter {
  protected _packFloat: boolean;
  get packFloat(): boolean {
    return this._packFloat;
  }
  set packFloat(b: boolean) {
    if (this._packFloat !== !!b) {
      this._packFloat = !!b;
      this.invalidateHash();
    }
  }
  readTexel(scope: PBInsideFunctionScope, type: BlitType, srcTex: PBShaderExp, srcUV: PBShaderExp, srcLayer: PBShaderExp): PBShaderExp {
    const pb = scope.$builder;
    const texel = super.readTexel(scope, type, srcTex, srcUV, srcLayer);
    if (this.packFloat) {
      const lib = new ShaderLib(pb);
      return pb.vec4(lib.decodeNormalizedFloatFromRGBA(texel), 0, 0, 1);
    } else {
      return texel;
    }
  }
  writeTexel(scope: PBInsideFunctionScope, type: BlitType, srcUV: PBShaderExp, texel: PBShaderExp): PBShaderExp {
    const pb = scope.$builder;
    const outTexel = super.writeTexel(scope, type, srcUV, texel);
    if (this.packFloat) {
      const lib = new ShaderLib(pb);
      return lib.encodeNormalizedFloatToRGBA(outTexel.r);
    } else {
      return outTexel;
    }
  }
  protected calcHash(): string {
    return `${super.calcHash()}-${Number(this.packFloat)}`;
  }
}


export class ESM extends ShadowImpl {
  /** @internal */
  protected _depthScale: number;
  /** @internal */
  protected _blur: boolean;
  /** @internal */
  protected _kernelSize: number;
  /** @internal */
  protected _blurSize: number;
  /** @internal */
  protected _logSpace: boolean;
  /** @internal */
  protected _blurMap: ShadowMapType;
  /** @internal */
  protected _blurFramebuffer: FrameBuffer;
  /** @internal */
  protected _blurMap2: ShadowMapType;
  /** @internal */
  protected _blurFramebuffer2: FrameBuffer;
  /** @internal */
  protected _blitterH: BlurBlitter;
  /** @internal */
  protected _blitterV: BlurBlitter;
  /** @internal */
  protected _mipmap: boolean;
  /** @internal */
  protected _shadowSampler: TextureSampler;
  constructor(kernelSize?: number, blurSize?: number, depthScale?: number) {
    super();
    this._blur = true;
    this._depthScale = depthScale ?? 500;
    this._kernelSize = kernelSize ?? 5;
    this._blurSize = blurSize ?? 1;
    this._logSpace = true;
    this._mipmap = true;
    this._shadowSampler = null;
    this._blitterH = new BlurBlitter('horizonal', this._kernelSize, 4, 1 / 1024);
    this._blitterV = new BlurBlitter('vertical', this._kernelSize, 4, 1 / 1024);
  }
  resourceDirty(): boolean {
    return this._resourceDirty;
  }
  get blur(): boolean {
    return this._blur;
  }
  set blur(val: boolean) {
    if (this._blur !== !!val) {
      this._blur = !!val;
      this._resourceDirty = true;
    }
  }
  get mipmap(): boolean {
    return this._mipmap;
  }
  set mipmap(b: boolean) {
    if (this._mipmap !== !!b) {
      this._mipmap = !!b;
      if (this._blur) {
        this._resourceDirty = true;
      }
    }
  }
  get kernelSize(): number {
    return this._kernelSize;
  }
  set kernelSize(val: number) {
    this._kernelSize = val;
  }
  get blurSize(): number {
    return this._blurSize;
  }
  set blurSize(val: number) {
    this._blurSize = val;
  }
  get logSpace(): boolean {
    return this._logSpace;
  }
  set logSpace(val: boolean) {
    this._logSpace = !!val;
  }
  getType(): ShadowMode {
    return 'esm';
  }
  dispose(): void {
    this._blurFramebuffer?.dispose();
    this._blurFramebuffer = null;
    this._blurFramebuffer2?.dispose();
    this._blurFramebuffer2 = null;
    this._blurMap?.dispose();
    this._blurMap = null;
    this._blurMap2?.dispose();
    this._blurMap2 = null;
    this._shadowSampler = null;
  }
  getShadowMap(shadowMapper: ShadowMapper): ShadowMapType {
    return this._blur ? this._blurMap2 : shadowMapper.getColorAttachment();
  }
  getShadowMapSampler(shadowMapper: ShadowMapper): TextureSampler {
    if (!this._shadowSampler) {
      this._shadowSampler = this.getShadowMap(shadowMapper)?.getDefaultSampler(false) || null;
    }
    return null;
  }
  /** @internal */
  protected isTextureInvalid(shadowMapper: ShadowMapper, texture: ShadowMapType, target: TextureTarget, format: TextureFormat, width: number, height: number): boolean {
    return texture && (texture.target !== target
      || texture.format !== format
      || texture.width !== width
      || texture.height !== height
      || texture.depth !== shadowMapper.numShadowCascades);
  }
  /** @internal */
  protected createTexture(device: Device, target: TextureTarget, format: TextureFormat, width: number, height: number, depth: number, mipmap: boolean): ShadowMapType {
    switch (target) {
      case TextureTarget.Texture2D:
        return device.createTexture2D(format, width, height, GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE | (mipmap ? 0 : GPUResourceUsageFlags.TF_NO_MIPMAP));
      case TextureTarget.TextureCubemap:
        return device.createCubeTexture(format, width, GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE | (mipmap ? 0 : GPUResourceUsageFlags.TF_NO_MIPMAP));
      case TextureTarget.Texture2DArray:
        return device.createTexture2DArray(format, width, height, depth, GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE | (mipmap ? 0 : GPUResourceUsageFlags.TF_NO_MIPMAP));
      default:
        return null;
    }
  }
  doUpdateResources(shadowMapper: ShadowMapper) {
    const device = shadowMapper.light.scene.device;
    const colorFormat = this.getShadowMapColorFormat(shadowMapper);
    const target = shadowMapper.getColorAttachment().target;
    const shadowMapWidth = shadowMapper.getColorAttachment().width;
    const shadowMapHeight = shadowMapper.getColorAttachment().height;
    const blur = this._blur;
    const blurMapWidth = shadowMapWidth;
    const blurMapHeight = shadowMapHeight;
    if (!blur) {
      this._blurFramebuffer?.dispose();
      this._blurFramebuffer = null;
      this._blurMap?.dispose();
      this._blurMap = null;
      this._blurFramebuffer2?.dispose();
      this._blurFramebuffer2 = null;
      this._blurMap2?.dispose();
      this._blurMap2 = null;
    }
    if (this.isTextureInvalid(shadowMapper, this._blurMap, target, colorFormat, blurMapWidth, blurMapHeight)) {
      this._blurFramebuffer?.dispose();
      this._blurFramebuffer = null;
      this._blurMap?.dispose();
      this._blurMap = null;
    }
    if (this.isTextureInvalid(shadowMapper, this._blurMap2, target, colorFormat, blurMapWidth, blurMapHeight)) {
      this._blurFramebuffer2?.dispose();
      this._blurFramebuffer2 = null;
      this._blurMap2?.dispose();
      this._blurMap2 = null;
    }
    if (blur) {
      if (!this._blurMap || this._blurMap.disposed) {
        this._blurMap = this.createTexture(device, target, colorFormat, blurMapWidth, blurMapHeight, shadowMapper.numShadowCascades, false);
      }
      if (!this._blurMap2 || (this._mipmap !== this._blurMap2.mipLevelCount > 1) || this._blurMap2.disposed) {
        this._blurMap2 = this.createTexture(device, target, colorFormat, blurMapWidth, blurMapHeight, shadowMapper.numShadowCascades, this._mipmap);
      }
      if (!this._blurFramebuffer || this._blurFramebuffer.disposed) {
        this._blurFramebuffer = device.createFrameBuffer({ colorAttachments: [{ texture: this._blurMap }] });
      }
      if (!this._blurFramebuffer2 || this._blurFramebuffer2.disposed) {
        this._blurFramebuffer2 = device.createFrameBuffer({ colorAttachments: [{ texture: this._blurMap2 }] });
      }
    }
    this._shadowSampler = null;
  }
  postRenderShadowMap(shadowMapper: ShadowMapper) {
    if (this._blur) {
      this._blitterH.blurSize = this._blurSize / shadowMapper.getColorAttachment().width;
      this._blitterH.kernelSize = this._kernelSize;
      this._blitterH.logSpace = this._logSpace;
      this._blitterH.packFloat = shadowMapper.getColorAttachment().format === TextureFormat.RGBA8UNORM;
      this._blitterV.blurSize = this._blurSize / shadowMapper.getColorAttachment().height;
      this._blitterV.kernelSize = this._kernelSize;
      this._blitterV.logSpace = this._logSpace;
      this._blitterV.packFloat = shadowMapper.getColorAttachment().format === TextureFormat.RGBA8UNORM;
      this._blitterH.blit(shadowMapper.getColorAttachment() as any, this._blurFramebuffer as any);
      this._blitterV.blit(this._blurMap as any, this._blurFramebuffer2 as any);
    }
  }
  getDepthScale(): number {
    return this._depthScale;
  }
  setDepthScale(val: number) {
    this._depthScale = val;
  }
  isSupported(shadowMapper: ShadowMapper): boolean {
    return this.getShadowMapColorFormat(shadowMapper) !== TextureFormat.Unknown && this.getShadowMapDepthFormat(shadowMapper) !== TextureFormat.Unknown;
  }
  getShaderHash(): string {
    return '';
  }
  getShadowMapColorFormat(shadowMapper: ShadowMapper): TextureFormat {
    const device = shadowMapper.light.scene.device;
    return device.getTextureCaps().supportHalfFloatColorBuffer
      ? device.getDeviceType() === 'webgl' ? TextureFormat.RGBA16F : TextureFormat.R16F
      : device.getTextureCaps().supportFloatColorBuffer
        ? device.getDeviceType() === 'webgl' ? TextureFormat.RGBA32F : TextureFormat.R32F
        : TextureFormat.RGBA8UNORM;
  }
  getShadowMapDepthFormat(shadowMapper: ShadowMapper): TextureFormat {
    return TextureFormat.D24S8;
  }
  computeShadowMapDepth(shadowMapper: ShadowMapper, scope: PBInsideFunctionScope): PBShaderExp {
    return computeShadowMapDepth(scope, shadowMapper.shadowMap.format);
  }
  computeShadowCSM(shadowMapper: ShadowMapper, scope: PBInsideFunctionScope, shadowVertex: PBShaderExp, NdotL: PBShaderExp, split: PBShaderExp): PBShaderExp {
    const funcNameComputeShadowCSM = 'lib_computeShadowCSM';
    const pb = scope.$builder;
    const lib = new ShaderLib(pb);
    if (!pb.getFunction(funcNameComputeShadowCSM)) {
      pb.globalScope.$function(funcNameComputeShadowCSM, [pb.vec4('shadowVertex'), pb.float('NdotL'), pb.int('split')], function () {
        this.$l.shadowCoord = pb.div(this.shadowVertex, this.shadowVertex.w);
        this.$l.shadowCoord = pb.add(pb.mul(this.shadowCoord, 0.5), 0.5);
        this.$l.inShadow = pb.all(pb.bvec2(pb.all(pb.bvec4(pb.greaterThanEqual(this.shadowCoord.x, 0), pb.lessThanEqual(this.shadowCoord.x, 1), pb.greaterThanEqual(this.shadowCoord.y, 0), pb.lessThanEqual(this.shadowCoord.y, 1))), pb.lessThanEqual(this.shadowCoord.z, 1)));
        this.$l.shadow = pb.float(1);
        this.$if(this.inShadow, function () {
          this.shadow = filterShadowESM(this, shadowMapper.light.lightType, shadowMapper.shadowMap.format, this.shadowCoord, this.split);
        });
        this.$return(this.shadow);
      });
    }
    return pb.globalScope[funcNameComputeShadowCSM](shadowVertex, NdotL, split);
  }
  computeShadow(shadowMapper: ShadowMapper, scope: PBInsideFunctionScope, shadowVertex: PBShaderExp, NdotL: PBShaderExp): PBShaderExp {
    const funcNameComputeShadow = 'lib_computeShadow';
    const pb = scope.$builder;
    if (!pb.getFunction(funcNameComputeShadow)) {
      pb.globalScope.$function(funcNameComputeShadow, [pb.vec4('shadowVertex'), pb.float('NdotL')], function () {
        if (shadowMapper.light.isPointLight()) {
          this.$return(filterShadowESM(this, shadowMapper.light.lightType, shadowMapper.shadowMap.format, this.shadowVertex));
        } else {
          this.$l.shadowCoord = pb.div(this.shadowVertex, this.shadowVertex.w);
          this.$l.shadowCoord = pb.add(pb.mul(this.shadowCoord, 0.5), 0.5);
          this.$l.inShadow = pb.all(pb.bvec2(pb.all(pb.bvec4(pb.greaterThanEqual(this.shadowCoord.x, 0), pb.lessThanEqual(this.shadowCoord.x, 1), pb.greaterThanEqual(this.shadowCoord.y, 0), pb.lessThanEqual(this.shadowCoord.y, 1))), pb.lessThanEqual(this.shadowCoord.z, 1)));
          this.$l.shadow = pb.float(1);
          this.$if(this.inShadow, function () {
            this.shadow = filterShadowESM(this, shadowMapper.light.lightType, shadowMapper.shadowMap.format, this.shadowCoord);
          });
          this.$return(this.shadow);
        }
      });
    }
    return pb.globalScope[funcNameComputeShadow](shadowVertex, NdotL);
  }
  useNativeShadowMap(shadowMapper: ShadowMapper): boolean {
    return false;
  }
}
