import type { BaseTexture, BindGroup, ProgramBuilder, TextureCube, TextureSampler } from "../../device";
import { Vector4 } from "../../math";

export abstract class EnvironmentLighting {
  abstract initShaderBindings(pb: ProgramBuilder): void;
  abstract updateBindGroup(bg: BindGroup): void;
  isIBL(): this is EnvIBL {
    return false;
  }
  isConstant(): this is EnvConstantAmbient {
    return false;
  }
}

export class EnvIBL extends EnvironmentLighting {
  public static readonly USAGE_IBL_RADIANCE_MAP = 'usage_ibl_radiance_map';
  public static readonly USAGE_IBL_RADIANCE_MAP_MAX_LOD = 'usage_ibl_radiance_map_maxlod';
  public static readonly USAGE_IBL_IRRADIANCE_MAP = 'usage_ibl_irradiance_map';
  private _radianceMap: TextureCube;
  private _radianceMapSampler: TextureSampler;
  private _irradianceMap: TextureCube;
  private _irradianceMapSampler: TextureSampler;
  constructor(radianceMap?: TextureCube, irradianceMap?: TextureCube) {
    super();
    this._radianceMap = radianceMap || null;
    this._radianceMapSampler = radianceMap?.getDefaultSampler(false) || null;
    this._irradianceMap = irradianceMap || null;
    this._irradianceMapSampler = irradianceMap?.getDefaultSampler(false) || null;
  }
  get radianceMap(): TextureCube {
    return this._radianceMap;
  }
  set radianceMap(tex: TextureCube) {
    this._radianceMap = tex;
    if (!this._radianceMapSampler && tex) {
      this._radianceMapSampler = tex.getDefaultSampler(false) || null;
    }
  }
  get irradianceMap(): TextureCube {
    return this._irradianceMap;
  }
  set irradianceMap(tex: TextureCube) {
    this._irradianceMap = tex;
    if (!this._irradianceMapSampler && tex) {
      this._irradianceMapSampler = tex.getDefaultSampler(false);
    }
  }
  initShaderBindings(pb: ProgramBuilder): void {
    pb.globalScope.iblRadianceMap = pb.texCube().uniform(0).tag(EnvIBL.USAGE_IBL_RADIANCE_MAP);
    pb.globalScope.iblIrradianceMap = pb.texCube().uniform(0).tag(EnvIBL.USAGE_IBL_IRRADIANCE_MAP);
    pb.globalScope.iblParams = pb.defineStruct(null, 'std140', pb.float('radianceMaxLod'))().uniform(0).tag({ radianceMaxLod: EnvIBL.USAGE_IBL_RADIANCE_MAP_MAX_LOD });
  }
  updateBindGroup(bg: BindGroup): void {
    bg.setValue('iblParams', { radianceMaxLod: this._radianceMap ? this._radianceMap.mipLevelCount - 1 : 0 });
    bg.setTexture('iblRadianceMap', this._radianceMap, this._radianceMapSampler);
    bg.setTexture('iblIrradianceMap', this._irradianceMap, this._irradianceMapSampler);
  }
  isIBL(): this is EnvIBL {
    return true;
  }
  private getMapSampler(tex: BaseTexture): TextureSampler {
    return tex.getDefaultSampler(false);
  }
}

export class EnvConstantAmbient extends EnvironmentLighting {
  public static readonly USAGE_CONSTANT_AMBIENT_LIGHTING = 'usage_env_constant_ambient';
  public static readonly funcNameGetAmbient = 'lib_getConstantAmbient';
  private _ambientColor: Vector4;
  constructor(ambientColor?: Vector4) {
    super();
    this._ambientColor = ambientColor ? new Vector4(ambientColor) : new Vector4(0, 0, 0, 1);
  }
  get ambientColor(): Vector4 {
    return this._ambientColor;
  }
  set ambientColor(ambientColor: Vector4) {
    if (ambientColor) {
      this._ambientColor.assign(ambientColor.getArray());
    }
  }
  initShaderBindings(pb: ProgramBuilder): void {
    pb.globalScope.envLight = pb.defineStruct(null, 'std140', pb.vec4('ambient'))().uniform(0).tag({ ambient: EnvConstantAmbient.USAGE_CONSTANT_AMBIENT_LIGHTING });
  }
  updateBindGroup(bg: BindGroup): void {
    bg.setValue('envLight', { ambient: this._ambientColor });
  }
  isConstant(): this is EnvConstantAmbient {
    return true;
  }
}
