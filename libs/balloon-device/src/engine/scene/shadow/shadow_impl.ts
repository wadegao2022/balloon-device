import { PBInsideFunctionScope, PBShaderExp, TextureFormat, TextureSampler } from "../../device";
import type { ShadowMapper, ShadowMapType, ShadowMode } from "./shadowmapper";

export abstract class ShadowImpl {
  protected _resourceDirty: boolean;
  constructor() {
    this._resourceDirty = true;
  }
  invalidateResource() {
    this._resourceDirty = true;
  }
  updateResources(shadowMapper: ShadowMapper) {
    if (this._resourceDirty) {
      this.doUpdateResources(shadowMapper);
      this._resourceDirty = false;
    }
  }
  abstract dispose(): void;
  abstract getType(): ShadowMode;
  abstract getShadowMap(shadowMapper: ShadowMapper): ShadowMapType;
  abstract getShadowMapSampler(shadowMapper: ShadowMapper): TextureSampler;
  abstract postRenderShadowMap(shadowMapper: ShadowMapper);
  abstract getDepthScale(): number;
  abstract setDepthScale(val: number);
  abstract resourceDirty(): boolean;
  abstract isSupported(shadowMapper: ShadowMapper): boolean;
  abstract doUpdateResources(shadowMapper: ShadowMapper);
  abstract getShaderHash(): string;
  abstract computeShadowMapDepth(shadowMapper: ShadowMapper, scope: PBInsideFunctionScope): PBShaderExp;
  abstract computeShadow(shadowMapper: ShadowMapper, scope: PBInsideFunctionScope, shadowVertex: PBShaderExp, NdotL: PBShaderExp): PBShaderExp;
  abstract computeShadowCSM(shadowMapper: ShadowMapper, scope: PBInsideFunctionScope, shadowVertex: PBShaderExp, NdotL: PBShaderExp, split: PBShaderExp): PBShaderExp;
  abstract getShadowMapColorFormat(shadowMapper: ShadowMapper): TextureFormat;
  abstract getShadowMapDepthFormat(shadowMapper: ShadowMapper): TextureFormat;
  abstract useNativeShadowMap(shadowMapper: ShadowMapper): boolean;
}

