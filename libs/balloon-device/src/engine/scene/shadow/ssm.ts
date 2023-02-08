import { ShadowImpl } from "./shadow_impl";
import { TextureFormat, PBInsideFunctionScope, PBShaderExp, TextureSampler, TextureFilter } from "../../device";
import { ShaderLib } from "../materiallib";
import type { ShadowMapper, ShadowMapType, ShadowMode } from "./shadowmapper";

export class SSM extends ShadowImpl {
  static instance = new SSM();
  private _shadowSampler: TextureSampler;
  constructor() {
    super();
    this._shadowSampler = null;
  }
  isSupported(shadowMapper: ShadowMapper): boolean {
    return this.getShadowMapColorFormat(shadowMapper) !== TextureFormat.Unknown && this.getShadowMapDepthFormat(shadowMapper) !== TextureFormat.Unknown;
  }
  resourceDirty(): boolean {
    return false;
  }
  getType(): ShadowMode {
    return 'hard';
  }
  dispose(): void {
    this._shadowSampler = null;
  }
  getShadowMap(shadowMapper: ShadowMapper): ShadowMapType {
    return this.useNativeShadowMap(shadowMapper) ? shadowMapper.getDepthAttachment() : shadowMapper.getColorAttachment();
  }
  getShadowMapSampler(shadowMapper: ShadowMapper): TextureSampler {
    if (!this._shadowSampler) {
      this._shadowSampler = this.getShadowMap(shadowMapper)?.getDefaultSampler(this.useNativeShadowMap(shadowMapper)) || null;
    }
    return this._shadowSampler;
  }
  doUpdateResources() {
    this._shadowSampler = null;
  }
  postRenderShadowMap() {
  }
  getDepthScale(): number {
    return 1;
  }
  setDepthScale(val: number) {
  }
  getShaderHash(): string {
    return '';
  }
  getShadowMapColorFormat(shadowMapper: ShadowMapper): TextureFormat {
    if (this.useNativeShadowMap(shadowMapper)) {
      return TextureFormat.RGBA8UNORM;
    } else {
      const device = shadowMapper.light.scene.device;
      return device.getTextureCaps().supportHalfFloatColorBuffer
        ? device.getDeviceType() === 'webgl' ? TextureFormat.RGBA16F : TextureFormat.R16F
        : device.getTextureCaps().supportFloatColorBuffer
          ? device.getDeviceType() === 'webgl' ? TextureFormat.RGBA32F : TextureFormat.R32F
          : TextureFormat.RGBA8UNORM;
    }
  }
  getShadowMapDepthFormat(shadowMapper: ShadowMapper): TextureFormat {
    return shadowMapper.light.scene.device.getDeviceType() === 'webgl' ? TextureFormat.D24S8 : TextureFormat.D32F;
  }
  computeShadowMapDepth(shadowMapper: ShadowMapper, scope: PBInsideFunctionScope): PBShaderExp {
    if (this.useNativeShadowMap(shadowMapper)) {
      return scope.$builder.vec4(scope.$builder.emulateDepthClamp ? scope.$builder.clamp(scope.$inputs.clamppedDepth, 0, 1) : scope.$builtins.fragCoord.z, 0, 0, 1);
    } else {
      const pb = scope.$builder;
      const lib = new ShaderLib(pb);
      let depth: PBShaderExp = null;
      if (shadowMapper.light.isDirectionLight()) {
        depth = pb.emulateDepthClamp ? pb.clamp(scope.$inputs.clamppedDepth, 0, 1) : scope.$builtins.fragCoord.z;
      } else if (shadowMapper.light.isPointLight()) {
        const lightSpacePos = pb.mul(scope.global.light.viewMatrix, pb.vec4(scope.$query(ShaderLib.USAGE_WORLD_POSITION).xyz, 1));
        depth = pb.div(pb.length(lightSpacePos.xyz), scope.global.light.positionRange.w);
      } else if (shadowMapper.light.isSpotLight()) {
        const lightSpacePos = pb.mul(scope.global.light.viewMatrix, pb.vec4(scope.$query(ShaderLib.USAGE_WORLD_POSITION).xyz, 1));
        depth = pb.min(pb.div(pb.neg(lightSpacePos.z), scope.global.light.positionRange.w), 1);
      }
      return shadowMapper.shadowMap.format === TextureFormat.RGBA8UNORM ? lib.encodeNormalizedFloatToRGBA(depth) : pb.vec4(depth, 0, 0, 1);
    }
  }
  computeShadowCSM(shadowMapper: ShadowMapper, scope: PBInsideFunctionScope, shadowVertex: PBShaderExp, NdotL: PBShaderExp, split: PBShaderExp): PBShaderExp {
    const funcNameComputeShadowCSM = 'lib_computeShadowCSM';
    const pb = scope.$builder;
    const lib = new ShaderLib(pb);
    const that = this;
    if (!pb.getFunction(funcNameComputeShadowCSM)) {
      pb.globalScope.$function(funcNameComputeShadowCSM, [pb.vec4('shadowVertex'), pb.float('NdotL'), pb.int('split')], function () {
        const floatDepthTexture = shadowMapper.shadowMap.format !== TextureFormat.RGBA8UNORM;
        this.$l.shadowCoord = pb.div(this.shadowVertex.xyz, this.shadowVertex.w);
        this.$l.shadowCoord = pb.add(pb.mul(this.shadowCoord.xyz, 0.5), 0.5);
        this.$l.inShadow = pb.all(pb.bvec2(pb.all(pb.bvec4(pb.greaterThanEqual(this.shadowCoord.x, 0), pb.lessThanEqual(this.shadowCoord.x, 1), pb.greaterThanEqual(this.shadowCoord.y, 0), pb.lessThanEqual(this.shadowCoord.y, 1))), pb.lessThanEqual(this.shadowCoord.z, 1)));
        this.$l.shadow = pb.float(1);
        this.$if(this.inShadow, function () {
          this.$l.shadowBias = shadowMapper.computeShadowBiasCSM(this, this.NdotL, this.split);
          this.shadowCoord.z = pb.sub(this.shadowCoord.z, this.shadowBias);
          if (that.useNativeShadowMap(shadowMapper)) {
            if (shadowMapper.shadowMap.isTexture2DArray()) {
              this.shadow = pb.textureArraySampleCompareLevel(this.shadowMap, this.shadowCoord.xy, this.split, this.shadowCoord.z);
            } else {
              this.shadow = pb.textureSampleCompareLevel(this.shadowMap, this.shadowCoord.xy, this.shadowCoord.z);
            }
          } else {
            if (shadowMapper.shadowMap.isTexture2DArray()) {
              this.$l.shadowTex = pb.textureArraySampleLevel(this.shadowMap, this.shadowCoord.xy, this.split, 0);
            } else {
              this.$l.shadowTex = pb.textureSampleLevel(this.shadowMap, this.shadowCoord.xy, 0);
            }
            if (!floatDepthTexture) {
              this.shadowTex.x = lib.decodeNormalizedFloatFromRGBA(this.shadowTex);
            }
            this.shadow = pb.step(this.shadowCoord.z, this.shadowTex.x);
          }
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
        const floatDepthTexture = shadowMapper.shadowMap.format !== TextureFormat.RGBA8UNORM;
        if (shadowMapper.light.isPointLight()) {
          if (that.useNativeShadowMap(shadowMapper)) {
            this.$l.nearFar = pb.getDeviceType() === 'webgl' ? this.global.light.shadowCameraParams.xy : this.global.light.lightParams[5].xy;
            this.$l.distance = lib.linearToNonLinear(pb.max(pb.max(pb.abs(this.shadowVertex.x), pb.abs(this.shadowVertex.y)), pb.abs(this.shadowVertex.z)), this.nearFar);
            this.$l.shadowBias = shadowMapper.computeShadowBias(this, this.distance, this.NdotL);
            this.$return(pb.textureSampleCompareLevel(this.shadowMap, this.shadowVertex.xyz, pb.sub(this.distance, this.shadowBias)));
          } else {
            this.$l.distance = pb.length(this.shadowVertex.xyz);
            this.$l.distance = pb.div(this.$l.distance, this.global.light.lightParams[0].w);
            this.$l.shadowBias = shadowMapper.computeShadowBias(this, this.distance, this.NdotL);
            this.$l.shadowTex = pb.textureSampleLevel(this.shadowMap, this.shadowVertex.xyz, 0);
            if (!floatDepthTexture) {
              this.shadowTex.x = lib.decodeNormalizedFloatFromRGBA(this.shadowTex);
            }
            this.distance = pb.sub(this.distance, this.shadowBias);
            this.$return(pb.step(this.distance, this.shadowTex.x));
          }
        } else {
          this.$l.shadowCoord = pb.div(this.shadowVertex.xyz, this.shadowVertex.w);
          this.$l.shadowCoord = pb.add(pb.mul(this.shadowCoord.xyz, 0.5), 0.5);
          this.$l.inShadow = pb.all(pb.bvec2(pb.all(pb.bvec4(pb.greaterThanEqual(this.shadowCoord.x, 0), pb.lessThanEqual(this.shadowCoord.x, 1), pb.greaterThanEqual(this.shadowCoord.y, 0), pb.lessThanEqual(this.shadowCoord.y, 1))), pb.lessThanEqual(this.shadowCoord.z, 1)));
          this.$l.shadow = pb.float(1);
          this.$if(this.inShadow, function () {
            if (that.useNativeShadowMap(shadowMapper)) {
              this.$l.shadowBias = shadowMapper.computeShadowBias(this, this.shadowCoord.z, this.NdotL);
              this.shadowCoord.z = pb.sub(this.shadowCoord.z, this.shadowBias);
              this.shadow = pb.textureSampleCompareLevel(this.shadowMap, this.shadowCoord.xy, this.shadowCoord.z);
            } else {
              if (shadowMapper.light.isSpotLight()) {
                this.$l.nearFar = pb.getDeviceType() === 'webgl' ? this.global.light.shadowCameraParams.xy : this.global.light.lightParams[5].xy;
                this.shadowCoord.z = lib.nonLinearDepthToLinearNormalized(this.shadowCoord.z, this.nearFar);
              }
              this.$l.shadowBias = shadowMapper.computeShadowBias(this, this.shadowCoord.z, this.NdotL);
              this.shadowCoord.z = pb.sub(this.shadowCoord.z, this.shadowBias);
              this.$l.shadowTex = pb.textureSampleLevel(this.shadowMap, this.shadowCoord.xy, 0);
              if (!floatDepthTexture) {
                this.shadowTex.x = lib.decodeNormalizedFloatFromRGBA(this.shadowTex);
              }
              this.shadow = pb.step(this.shadowCoord.z, this.shadowTex.x);
            }
          });
          this.$return(this.shadow);
        }
      });
    }
    return pb.globalScope[funcNameComputeShadow](shadowVertex, NdotL);
  }
  useNativeShadowMap(shadowMapper: ShadowMapper): boolean {
    return shadowMapper.light.scene.device.getDeviceType() !== 'webgl';
  }
}

