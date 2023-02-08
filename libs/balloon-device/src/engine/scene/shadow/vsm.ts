import { ShadowImpl } from "./shadow_impl";
import { Blitter, BlitType } from "../blitter";
import { ShaderLib } from "../materiallib";
import { Device, BindGroup, ShaderType, FrameBuffer, TextureTarget, TextureFormat, GPUResourceUsageFlags, ProgramBuilder, PBShaderExp, TextureFilter, PBInsideFunctionScope, TextureSampler, PBGlobalScope } from "../../device";
import { computeShadowMapDepth, filterShadowVSM } from "../renderers/shadowmap.shaderlib";
import type { ShadowMapper, ShadowMapType, ShadowMode } from "./shadowmapper";

export class VSMBlitter extends Blitter {
  protected _phase: 'horizonal' | 'vertical';
  protected _packFloat: boolean;
  protected _blurSize: number;
  protected _kernelSize: number;
  constructor(phase: 'horizonal' | 'vertical', kernelSize: number, blurSize: number, packFloat: boolean) {
    super();
    this._phase = phase;
    this._blurSize = blurSize;
    this._kernelSize = kernelSize;
    this._packFloat = packFloat;
  }
  get blurSize(): number {
    return this._blurSize;
  }
  set blurSize(val: number) {
    this._blurSize = val;
  }
  get kernelSize(): number {
    return this._kernelSize;
  }
  set kernelSize(val: number) {
    if (val !== this._kernelSize) {
      this._kernelSize = val;
      this.invalidateHash();
    }
  }
  get packFloat(): boolean {
    return this._packFloat;
  }
  set packFloat(b: boolean) {
    if (this._packFloat !== !!b) {
      this._packFloat = !!b;
      this.invalidateHash();
    }
  }
  setup(scope: PBGlobalScope, type: BlitType) {
    const pb = scope.$builder;
    if (pb.shaderType === ShaderType.Fragment) {
      scope.blurSize = pb.float().uniform(0);
      scope.blurMultiplyVec = type === 'cube'
        ? this._phase === 'horizonal' ? pb.vec3(1, 0, 0) : pb.vec3(0, 1, 0)
        : this._phase === 'horizonal' ? pb.vec2(1, 0) : pb.vec2(0, 1);
      scope.numBlurPixelsPerSide = pb.float((this._kernelSize + 1) / 2);
      scope.weight = pb.float(1 / (this._kernelSize * this._kernelSize));
    }
  }
  setUniforms(bindGroup: BindGroup) {
    bindGroup.setValue('blurSize', this._blurSize);
  }
  readTexel(scope: PBInsideFunctionScope, type: BlitType, srcTex: PBShaderExp, srcUV: PBShaderExp, srcLayer: PBShaderExp): PBShaderExp {
    const pb = scope.$builder;
    const texel = super.readTexel(scope, type, srcTex, srcUV, srcLayer);
    if (this._packFloat) {
      const lib = new ShaderLib(pb);
      if (this._phase === 'horizonal') {
        return pb.vec4(lib.decodeNormalizedFloatFromRGBA(texel));
      } else {
        return pb.vec4(lib.decode2HalfFromRGBA(texel), 0, 0);
      }
    } else {
      return texel;
    }
  }
  writeTexel(scope: PBInsideFunctionScope, type: BlitType, srcUV: PBShaderExp, texel: PBShaderExp): PBShaderExp {
    const pb = scope.$builder;
    const outTexel = super.writeTexel(scope, type, srcUV, texel);
    if (this._packFloat) {
      const lib = new ShaderLib(pb);
      return lib.encode2HalfToRGBA(outTexel.x, outTexel.y);
    } else {
      return outTexel;
    }
  }
  filter(scope: PBInsideFunctionScope, type: BlitType, srcTex: PBShaderExp, srcUV: PBShaderExp, srcLayer: PBShaderExp): PBShaderExp {
    const that = this;
    const pb = scope.$builder;
    scope.d0 = that.readTexel(scope, type, srcTex, srcUV, srcLayer);
    scope.mean = pb.float(0);
    scope.squaredMean = pb.float(0);
    scope.$for(pb.float('i'), 1, scope.numBlurPixelsPerSide, function () {
      this.d1 = that.readTexel(this, type, srcTex, pb.sub(srcUV, pb.mul(this.blurMultiplyVec, this.blurSize, this.i)), srcLayer);
      this.d2 = that.readTexel(this, type, srcTex, pb.add(srcUV, pb.mul(this.blurMultiplyVec, this.blurSize, this.i)), srcLayer);
      this.mean = pb.add(this.mean, this.d1.x);
      this.mean = pb.add(this.mean, this.d2.x);
      if (that._phase === 'horizonal') {
        this.squaredMean = pb.add(this.squaredMean, pb.mul(this.d1.x, this.d1.x));
        this.squaredMean = pb.add(this.squaredMean, pb.mul(this.d2.x, this.d2.x));
      } else {
        this.squaredMean = pb.add(this.squaredMean, pb.dot(this.d1.xy, this.d1.xy));
        this.squaredMean = pb.add(this.squaredMean, pb.dot(this.d2.xy, this.d2.xy));
      }
    });
    scope.mean = pb.div(scope.mean, that._kernelSize);
    scope.squaredMean = pb.div(scope.squaredMean, that._kernelSize);
    scope.stdDev = pb.sqrt(pb.max(0, pb.sub(scope.squaredMean, pb.mul(scope.mean, scope.mean))));
    return pb.vec4(scope.mean, scope.stdDev, 0, 1);
  }
  protected calcHash(): string {
    return `${this._phase}-${this._kernelSize}-${Number(this._packFloat)}`;
  }
}

export class VSM extends ShadowImpl {
  /** @internal */
  protected _blur: boolean;
  /** @internal */
  protected _kernelSize: number;
  /** @internal */
  protected _blurSize: number;
  /** @internal */
  protected _blurMap: ShadowMapType;
  /** @internal */
  protected _blurFramebuffer: FrameBuffer;
  /** @internal */
  protected _blurMap2: ShadowMapType;
  /** @internal */
  protected _blurFramebuffer2: FrameBuffer;
  /** @internal */
  protected _blitterH: VSMBlitter;
  /** @internal */
  protected _blitterV: VSMBlitter;
  /** @internal */
  protected _mipmap: boolean;
  /** @internal */
  protected _darkness: number;
  /** @internal */
  protected _shadowSampler: TextureSampler;
  constructor(kernelSize?: number, blurSize?: number, darkness?: number) {
    super();
    this._blur = true;
    this._kernelSize = kernelSize ?? 5;
    this._blurSize = blurSize ?? 1;
    this._darkness = darkness ?? 0;
    this._mipmap = true;
    this._shadowSampler = null;
    this._blitterH = new VSMBlitter('horizonal', this._kernelSize, 1 / 1024, false);
    this._blitterV = new VSMBlitter('vertical', this._kernelSize, 1 / 1024, false);
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
  getDepthScale(): number {
    return this._darkness;
  }
  setDepthScale(val: number) {
    this._darkness = val;
  }
  getType(): ShadowMode {
    return 'vsm';
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
    return this._shadowSampler;
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
      this._blitterH.blurSize = this._blurSize / shadowMapper.shadowMap.width;
      this._blitterH.kernelSize = this._kernelSize;
      this._blitterH.packFloat = shadowMapper.shadowMap.format === TextureFormat.RGBA8UNORM;
      this._blitterV.blurSize = this._blurSize / shadowMapper.shadowMap.height;
      this._blitterV.kernelSize = this._kernelSize;
      this._blitterV.packFloat = shadowMapper.shadowMap.format === TextureFormat.RGBA8UNORM;
      this._blitterH.blit(shadowMapper.getColorAttachment() as any, this._blurFramebuffer as any);
      this._blitterV.blit(this._blurMap as any, this._blurFramebuffer2 as any);
    }
  }
  isSupported(shadowMapper: ShadowMapper): boolean {
    return this.getShadowMapColorFormat(shadowMapper) !== TextureFormat.Unknown && this.getShadowMapDepthFormat(shadowMapper) !== TextureFormat.Unknown;
  }
  getShaderHash(): string {
    return '';
  }
  getShadowMapColorFormat(shadowMapper: ShadowMapper): TextureFormat {
    const device = shadowMapper.light.scene.device;
    return device.getTextureCaps().supportFloatColorBuffer && device.getTextureCaps().supportLinearFloatTexture
      ? device.getDeviceType() === 'webgl' ? TextureFormat.RGBA32F : TextureFormat.RG32F
      : device.getTextureCaps().supportHalfFloatColorBuffer && device.getTextureCaps().supportLinearHalfFloatTexture
        ? device.getDeviceType() === 'webgl' ? TextureFormat.RGBA16F : TextureFormat.RG16F
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
    if (!pb.getFunction(funcNameComputeShadowCSM)) {
      pb.globalScope.$function(funcNameComputeShadowCSM, [pb.vec4('shadowVertex'), pb.float('NdotL'), pb.int('split')], function () {
        this.$l.shadowCoord = pb.div(this.shadowVertex, this.shadowVertex.w);
        this.$l.shadowCoord = pb.add(pb.mul(this.shadowCoord, 0.5), 0.5);
        this.$l.inShadow = pb.all(pb.bvec2(pb.all(pb.bvec4(pb.greaterThanEqual(this.shadowCoord.x, 0), pb.lessThanEqual(this.shadowCoord.x, 1), pb.greaterThanEqual(this.shadowCoord.y, 0), pb.lessThanEqual(this.shadowCoord.y, 1))), pb.lessThanEqual(this.shadowCoord.z, 1)));
        this.$l.shadow = pb.float(1);
        this.$if(this.inShadow, function () {
          this.$l.shadowBias = shadowMapper.computeShadowBiasCSM(this, this.NdotL, this.split);
          this.shadowCoord.z = pb.sub(this.shadowCoord.z, this.shadowBias);
          this.shadow = filterShadowVSM(this, shadowMapper.light.lightType, shadowMapper.shadowMap.format, this.shadowCoord, this.split);
        });
        this.$return(this.shadow);
      });
    }
    return pb.globalScope[funcNameComputeShadowCSM](shadowVertex, NdotL, split);
  }
  computeShadow(shadowMapper: ShadowMapper, scope: PBInsideFunctionScope, shadowVertex: PBShaderExp, NdotL: PBShaderExp): PBShaderExp {
    const funcNameComputeShadow = 'lib_computeShadow';
    const pb = scope.$builder;
    const lib = new ShaderLib(pb);
    const that = this;
    if (!pb.getFunction(funcNameComputeShadow)) {
      pb.globalScope.$function(funcNameComputeShadow, [pb.vec4('shadowVertex'), pb.float('NdotL')], function () {
        if (shadowMapper.light.isPointLight()) {
          this.$l.shadowBias = shadowMapper.computeShadowBias(this, this.distance, this.NdotL);
          this.$l.coord = pb.vec4(this.shadowVertex.xyz, pb.sub(pb.div(pb.length(this.shadowVertex.xyz), this.global.light.lightParams[0].w), this.shadowBias));
          this.$return(filterShadowVSM(this, shadowMapper.light.lightType, shadowMapper.shadowMap.format, this.coord));
        } else {
          this.$l.shadowCoord = pb.div(this.shadowVertex, this.shadowVertex.w);
          this.$l.shadowCoord = pb.add(pb.mul(this.shadowCoord, 0.5), 0.5);
          this.$l.inShadow = pb.all(pb.bvec2(pb.all(pb.bvec4(pb.greaterThanEqual(this.shadowCoord.x, 0), pb.lessThanEqual(this.shadowCoord.x, 1), pb.greaterThanEqual(this.shadowCoord.y, 0), pb.lessThanEqual(this.shadowCoord.y, 1))), pb.lessThanEqual(this.shadowCoord.z, 1)));
          this.$l.shadow = pb.float(1);
          this.$if(this.inShadow, function () {
            if (shadowMapper.light.isSpotLight()) {
              this.$l.nearFar = pb.getDeviceType() === 'webgl' ? this.global.light.shadowCameraParams.xy : this.global.light.lightParams[5].xy;
              this.shadowCoord.z = lib.nonLinearDepthToLinearNormalized(this.shadowCoord.z, this.nearFar);
            }
            this.$l.shadowBias = shadowMapper.computeShadowBias(this, this.shadowCoord.z, this.NdotL);
            this.shadowCoord.z = pb.sub(this.shadowCoord.z, this.shadowBias);
            this.shadow = filterShadowVSM(this, shadowMapper.light.lightType, shadowMapper.shadowMap.format, this.shadowCoord);
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
