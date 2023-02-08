import { visitor, Visitor } from "../../../shared";
import { PBInsideFunctionScope, PBShaderExp } from "../../device";
import { ShaderLib } from "./shaderlib";
import { EnvironmentLighting, EnvConstantAmbient, EnvIBL } from "./envlight";

export const USAGE_PBR_F0 = 'brdf_usage_pbr_f0';
export const USAGE_PBR_METALLIC_MAP = 'brdf_usage_pbr_metallic_map';
export const USAGE_PBR_METALLIC_MAP_TEXCOORD = 'brdf_usage_pbr_metallic_map_texcoord';
export const USAGE_PBR_METALLIC = 'brdf_usage_pbr_metallic';
export const USAGE_PBR_ROUGHNESS = 'brdf_usage_pbr_roughness';

export abstract class Brdf extends Visitor {
  /** @internal */
  private static readonly funcNameEnvAmbient = 'Brdf_envAmbient';
  abstract getSurfaceData(scope: PBInsideFunctionScope): PBShaderExp;
  abstract calculate(scope: PBInsideFunctionScope, normal: PBShaderExp, lightDir: PBShaderExp, viewVec: PBShaderExp, surfaceData: PBShaderExp, outDiffuse: PBShaderExp, outSpecular: PBShaderExp);
  calculateEnv(envLight: EnvironmentLighting, scope: PBInsideFunctionScope, normal: PBShaderExp, viewVec: PBShaderExp, surfaceData: PBShaderExp, outDiffuse: PBShaderExp, outSpecular: PBShaderExp) {
    this.visit(envLight, scope, normal, viewVec, surfaceData, outDiffuse, outSpecular);
  }
  @visitor(EnvConstantAmbient)
  calculateEnvConstantAmbient(envLight: EnvConstantAmbient, scope: PBInsideFunctionScope, normal: PBShaderExp, viewVec: PBShaderExp, surfaceData: PBShaderExp, outDiffuse: PBShaderExp, outSpecular: PBShaderExp) {
    const pb = scope.$builder;
    if (!pb.getFunction(Brdf.funcNameEnvAmbient)) {
      pb.globalScope.$function(Brdf.funcNameEnvAmbient, [pb.vec3('diffuse'), pb.vec3('specular')], function () {
        this.diffuse = pb.queryGlobal(EnvConstantAmbient.USAGE_CONSTANT_AMBIENT_LIGHTING).xyz;
        this.specular = pb.vec3(0);
      });
    }
    return pb.globalScope[Brdf.funcNameEnvAmbient](outDiffuse, outSpecular);
  }
}

export class BrdfLambert extends Brdf {
  /** @internal */
  private static readonly funcNameEnvIrradiance = 'BrdfLambert_envIrradiance';
  /** @internal */
  private static readonly funcNameCalcLambertLight = 'BrdfLambert_calcLambertLight';

  getSurfaceData(): PBShaderExp {
    return null;
  }
  calculate(scope: PBInsideFunctionScope, normal: PBShaderExp, lightDir: PBShaderExp, viewVec: PBShaderExp, surfaceData: PBShaderExp, outDiffuse: PBShaderExp, outSpecular: PBShaderExp) {
    const pb = scope.$builder;
    if (!pb.getFunction(BrdfLambert.funcNameCalcLambertLight)) {
      pb.globalScope.$function(BrdfLambert.funcNameCalcLambertLight, [pb.vec3('diffuse'), pb.vec3('specular')], function () {
        this.diffuse = pb.vec3(1)
        this.specular = pb.vec3(0);
      });
    }
    return pb.globalScope[BrdfLambert.funcNameCalcLambertLight](outDiffuse, outSpecular);
  }
  @visitor(EnvIBL)
  calculateEnvIBL(envLight: EnvIBL, scope: PBInsideFunctionScope, normal: PBShaderExp, viewVec: PBShaderExp, surfaceData: PBShaderExp, outDiffuse: PBShaderExp, outSpecular: PBShaderExp) {
    const pb = scope.$builder;
    if (!pb.getFunction(BrdfLambert.funcNameEnvIrradiance)) {
      pb.globalScope.$function(BrdfLambert.funcNameEnvIrradiance, [pb.vec3('normal'), pb.vec3('diffuse'), pb.vec3('specular')], function () {
        this.diffuse = pb.mul(pb.textureSample(pb.queryGlobal(EnvIBL.USAGE_IBL_IRRADIANCE_MAP), this.normal).xyz, pb.queryGlobal(ShaderLib.USAGE_ENV_LIGHT_STRENGTH));
        this.specular = pb.vec3(0);
      });
    }
    return pb.globalScope[BrdfLambert.funcNameEnvIrradiance](normal, outDiffuse, outSpecular);
  }
}

export function getPBRSurfaceData(scope: PBInsideFunctionScope, albedo: PBShaderExp, metallicIndex: number, roughnessIndex: number): PBShaderExp {
  const pb = scope.$builder;
  const funcName = 'getPBRSurfaceData';
  if (!pb.getFunction(funcName)) {
    pb.globalScope.$function(funcName, [pb.vec3('albedo')], function () {
      const metallicMap = pb.queryGlobal(USAGE_PBR_METALLIC_MAP);
      const metallicFactor = pb.queryGlobal(USAGE_PBR_METALLIC);
      const roughnessFactor = pb.queryGlobal(USAGE_PBR_ROUGHNESS);
      if (metallicMap) {
        metallicIndex = metallicIndex ?? 2;
        roughnessIndex = roughnessIndex ?? 1;
        this.$l.t = pb.textureSample(metallicMap, pb.queryGlobal(USAGE_PBR_METALLIC_MAP_TEXCOORD) || pb.vec2(0, 0));
        const metallic = this.t['xyzw'[metallicIndex] || 'z'];
        const roughness = this.t['xyzw'[roughnessIndex] || 'y'];
        this.$l.metallic = metallicFactor ? pb.mul(metallic, metallicFactor) : metallic;
        this.$l.roughness = roughnessFactor ? pb.mul(roughness, roughnessFactor) : roughness;
      } else {
        this.$l.metallic = metallicFactor;
        this.$l.roughness = roughnessFactor;
      }
      const f0 = pb.queryGlobal(USAGE_PBR_F0) || 0.04;
      this.$l.f0 = pb.mix(pb.vec3(f0), this.albedo, this.metallic);
      this.$return(pb.defineStruct(null, 'default', pb.vec3('f0'), pb.float('metallic'), pb.float('roughness'))(this.f0, this.metallic, this.roughness));
    });
  }
  return pb.globalScope[funcName](albedo.xyz);
}

export class BrdfPBR extends Brdf {
  /** @internal */
  private static readonly funcNameFresnelSchlick = 'brdf_fresnelSchlick';
  /** @internal */
  private static readonly funcNameDistributionGGX = 'brdf_distributionGGX';
  /** @internal */
  private static readonly funcNameGeometrySchlickGGX = 'brdf_geometrySchlickGGX';
  /** @internal */
  private static readonly funcNameGeometrySmith = 'brdf_geometrySmith';
  /** @internal */
  private static readonly funcNameCalcPBRLight = 'brdf_calcPBRLight';
  static readonly USAGE_F0 = 'Env'
  /** @internal */
  private static readonly funcNameIllumEnvLight = 'EnvBrdfPBR_illumEnvLight_pbr';
  /** @internal */
  private static readonly funcNameFresnelSchlickRoughness = 'EnvBrdfPBR_fresnelSchlickRoughness';
  /** @internal */
  private static readonly funcNameEnvRadiance = 'EnvBrdfPBR_envRadiance';
  /** @internal */
  private static readonly funcNameEnvIrradiance = 'EnvBrdfPBR_envIrradiance';
  /** @internal */
  private static readonly funcNameEnvDFGLazarov = 'EnvBrdfPBR_envDFGLazarov';
  /** @internal */
  private _albedo: PBShaderExp;
  /** @internal */
  private _metallicIndex: number;
  /** @internal */
  private _roughnessIndex: number;

  constructor(albedo: PBShaderExp, metallicIndex: number, roughnessIndex: number) {
    super();
    this._albedo = albedo;
    this._metallicIndex = metallicIndex;
    this._roughnessIndex = roughnessIndex;
  }
  getSurfaceData(scope: PBInsideFunctionScope): PBShaderExp {
    return getPBRSurfaceData(scope, this._albedo, this._metallicIndex, this._roughnessIndex);
  }
  fresnelSchlickRoughness(scope: PBInsideFunctionScope, NdotV: PBShaderExp, surfaceData: PBShaderExp): PBShaderExp {
    const pb = scope.$builder;
    if (!pb.getFunction(BrdfPBR.funcNameFresnelSchlickRoughness)) {
      pb.globalScope.$function(
        BrdfPBR.funcNameFresnelSchlickRoughness, [pb.float('NdotV'), pb.struct(surfaceData.$ast.getType().toTypeName(pb.getDeviceType()), 'surfaceData')], function () {
          this.$return(
            pb.add(
              this.surfaceData.f0,
              pb.mul(
                pb.sub(pb.max(pb.vec3(pb.sub(1, this.surfaceData.roughness)), this.surfaceData.f0), this.surfaceData.f0),
                pb.pow(pb.sub(1, this.NdotV), 5),
              ),
            ),
          );
        },
      );
    }
    return pb.globalScope[BrdfPBR.funcNameFresnelSchlickRoughness](NdotV, surfaceData);
  }
  envDFGLazarov(scope: PBInsideFunctionScope, specularColor: PBShaderExp, gloss: PBShaderExp, NdotV: PBShaderExp): PBShaderExp {
    const pb = scope.$builder;
    if (!pb.getFunction(BrdfPBR.funcNameEnvDFGLazarov)) {
      pb.globalScope.$function(BrdfPBR.funcNameEnvDFGLazarov, [pb.vec3('specularColor'), pb.float('gloss'), pb.float('NdotV')], function () {
        this.$l.p0 = pb.vec4(0.5745, 1.548, -0.02397, 1.301);
        this.$l.p1 = pb.vec4(0.5753, -0.2511, -0.02066, 0.4755);
        this.$l.t = pb.add(pb.mul(this.p0, this.gloss), this.p1);
        this.$l.bias = pb.clamp(pb.add(pb.mul(this.t.x, pb.min(this.t.y, pb.exp2(pb.mul(-7.672, this.NdotV)))), this.t.z), 0, 1);
        this.$l.delta = pb.clamp(this.t.w, 0, 1);
        this.$l.scale = pb.sub(this.delta, this.bias);
        this.bias = pb.mul(this.bias, pb.clamp(pb.mul(50, this.specularColor.y), 0, 1));
        this.$return(pb.add(pb.mul(this.specularColor, this.scale), pb.vec3(this.bias)));
      });
    }
    return pb.globalScope[BrdfPBR.funcNameEnvDFGLazarov](specularColor, gloss, NdotV);
  }
  envRadiance(scope: PBInsideFunctionScope, F: PBShaderExp, refl: PBShaderExp, NdotV: PBShaderExp, surfaceData: PBShaderExp): PBShaderExp {
    const that = this;
    const pb = scope.$builder;
    if (!pb.getFunction(BrdfPBR.funcNameEnvRadiance)) {
      pb.globalScope.$function(BrdfPBR.funcNameEnvRadiance, [pb.vec3('F'), pb.vec3('refl'), pb.float('NdotV'), pb.struct(surfaceData.$ast.getType().toTypeName(pb.getDeviceType()), 'surfaceData')], function () {
        this.$l.maxLod = pb.queryGlobal(EnvIBL.USAGE_IBL_RADIANCE_MAP_MAX_LOD);
        this.$l.radiance = pb.device?.getShaderCaps().supportShaderTextureLod
          ? pb.textureSampleLevel(pb.queryGlobal(EnvIBL.USAGE_IBL_RADIANCE_MAP), this.refl, pb.mul(this.surfaceData.roughness, this.maxLod)).xyz
          : pb.textureSample(pb.queryGlobal(EnvIBL.USAGE_IBL_RADIANCE_MAP), this.refl).xyz
        this.$l.brdf = that.envDFGLazarov(this, this.surfaceData.f0, pb.sub(1, this.surfaceData.roughness), this.NdotV);
        this.$return(pb.mul(pb.mul(pb.mul(this.radiance, this.F), this.brdf), 3.1415926));
      });
    }
    return pb.globalScope[BrdfPBR.funcNameEnvRadiance](F, refl, NdotV, surfaceData);
  }
  envIrradiance(scope: PBInsideFunctionScope, normal: PBShaderExp, F: PBShaderExp, surfaceData: PBShaderExp): PBShaderExp {
    const pb = scope.$builder;
    if (!pb.getFunction(BrdfPBR.funcNameEnvIrradiance)) {
      pb.globalScope.$function(BrdfPBR.funcNameEnvIrradiance, [pb.vec3('normal'), pb.vec3('F'), pb.struct(surfaceData.$ast.getType().toTypeName(pb.getDeviceType()), 'surfaceData')], function () {
        this.$l.irradiance = pb.textureSample(pb.queryGlobal(EnvIBL.USAGE_IBL_IRRADIANCE_MAP), this.normal).xyz;
        this.$return(pb.mul(pb.mul(this.irradiance, pb.sub(1, this.surfaceData.metallic)), pb.sub(pb.vec3(1), this.F)));
      });
    }
    return pb.globalScope[BrdfPBR.funcNameEnvIrradiance](normal, F, surfaceData);
  }
  illumEnvLight(scope: PBInsideFunctionScope, normal: PBShaderExp, viewVec: PBShaderExp, surfaceData: PBShaderExp, diffuse: PBShaderExp, specular: PBShaderExp) {
    const pb = scope.$builder;
    const that = this;
    if (!pb.getFunction(BrdfPBR.funcNameIllumEnvLight)) {
      pb.globalScope.$function(BrdfPBR.funcNameIllumEnvLight, [
        pb.vec3('normal'),
        pb.vec3('viewVec'),
        pb.struct(surfaceData.$ast.getType().toTypeName(pb.getDeviceType()), 'surfaceData'),
        pb.vec3('diffuse'),
        pb.vec3('specular')
      ], function () {
        this.$l.refl = pb.reflect(pb.neg(this.viewVec), this.normal);
        this.$l.NdotV = pb.clamp(pb.dot(this.normal, this.viewVec), 0, 1);
        this.$l.F = that.fresnelSchlickRoughness(this, this.NdotV, this.surfaceData);
        this.diffuse = pb.mul(that.envIrradiance(this, this.normal, this.F, this.surfaceData), pb.queryGlobal(ShaderLib.USAGE_ENV_LIGHT_STRENGTH));
        this.specular = pb.mul(that.envRadiance(this, this.F, this.refl, this.NdotV, this.surfaceData), pb.queryGlobal(ShaderLib.USAGE_ENV_LIGHT_STRENGTH));
      });
    }
    pb.globalScope[BrdfPBR.funcNameIllumEnvLight](normal, viewVec, surfaceData, diffuse, specular);
  }
  @visitor(EnvIBL)
  calculateEnvIBL(env: EnvIBL, scope: PBInsideFunctionScope, normal: PBShaderExp, viewVec: PBShaderExp, surfaceData: PBShaderExp, outDiffuse: PBShaderExp, outSpecular: PBShaderExp) {
    this.illumEnvLight(scope, normal, viewVec, surfaceData, outDiffuse, outSpecular);
  }
  calculate(scope: PBInsideFunctionScope, normal: PBShaderExp, lightDir: PBShaderExp, viewVec: PBShaderExp, surfaceData: PBShaderExp, outDiffuse: PBShaderExp, outSpecular: PBShaderExp) {
    const pb = scope.$builder;
    const surfaceDataStructName = surfaceData.$ast.getType().toTypeName(pb.getDeviceType());
    if (!pb.getFunction(BrdfPBR.funcNameFresnelSchlick)) {
      pb.globalScope.$function(BrdfPBR.funcNameFresnelSchlick, [pb.float('cosTheta'), pb.vec3('F0')], function () {
        this.$return(pb.add(this.F0, pb.mul(pb.sub(1, this.F0), pb.pow(pb.sub(1, this.cosTheta), 5))));
      });
    }
    if (!pb.getFunction(BrdfPBR.funcNameDistributionGGX)) {
      pb.globalScope.$function(
        BrdfPBR.funcNameDistributionGGX,
        [pb.vec3('N'), pb.vec3('H'), pb.float('roughness')],
        function () {
          this.$l.a = pb.mul(this.roughness, this.roughness);
          this.$l.a2 = pb.mul(this.a, this.a);
          this.$l.NdotH = pb.max(pb.dot(this.N, this.H), 0);
          this.$l.NdotH2 = pb.mul(this.NdotH, this.NdotH);
          this.$l.num = this.a2;
          this.$l.denom = pb.add(pb.mul(this.NdotH2, pb.sub(this.a2, 1)), 1);
          this.denom = pb.mul(pb.mul(3.14159265, this.denom), this.denom);
          this.$return(pb.div(this.num, this.denom));
        },
      );
    }
    if (!pb.getFunction(BrdfPBR.funcNameGeometrySchlickGGX)) {
      pb.globalScope.$function(BrdfPBR.funcNameGeometrySchlickGGX, [pb.float('NdotV'), pb.float('roughness')], function () {
        this.$l.r = pb.add(this.roughness, 1);
        this.$l.k = pb.div(pb.mul(this.r, this.r), 8);
        this.$l.num = this.NdotV;
        this.$l.denom = pb.add(pb.mul(this.NdotV, pb.sub(1, this.k)), this.k);
        this.$return(pb.div(this.num, this.denom));
      });
    }
    if (!pb.getFunction(BrdfPBR.funcNameGeometrySmith)) {
      pb.globalScope.$function(
        BrdfPBR.funcNameGeometrySmith,
        [pb.vec3('N'), pb.vec3('V'), pb.vec3('L'), pb.float('roughness')],
        function () {
          this.$l.NdotV = pb.max(pb.dot(this.N, this.V), 0);
          this.$l.NdotL = pb.max(pb.dot(this.N, this.L), 0);
          this.$l.ggx2 = pb.globalScope[BrdfPBR.funcNameGeometrySchlickGGX](this.NdotV, this.roughness);
          this.$l.ggx1 = pb.globalScope[BrdfPBR.funcNameGeometrySchlickGGX](this.NdotL, this.roughness);
          this.$return(pb.mul(this.ggx1, this.ggx2));
        },
      );
    }
    if (!pb.getFunction(BrdfPBR.funcNameCalcPBRLight)) {
      pb.globalScope.$function(
        BrdfPBR.funcNameCalcPBRLight,
        [
          pb.vec3('normal'),
          pb.vec3('lightDir'),
          pb.vec3('viewVec'),
          pb.struct(surfaceDataStructName, 'surfaceData'),
          pb.vec3('diffuse'),
          pb.vec3('specular'),
        ],
        function () {
          this.$l.L = pb.neg(this.lightDir);
          this.$l.halfVec = pb.normalize(pb.sub(this.viewVec, this.lightDir));
          this.$l.NDF = pb.globalScope[BrdfPBR.funcNameDistributionGGX](this.normal, this.halfVec, this.surfaceData.roughness);
          this.$l.G = pb.globalScope[BrdfPBR.funcNameGeometrySmith](this.normal, this.viewVec, this.L, this.surfaceData.roughness);
          this.$l.F = pb.globalScope[BrdfPBR.funcNameFresnelSchlick](pb.max(pb.dot(this.halfVec, this.viewVec), 0), this.surfaceData.f0);
          this.$l.nominator = pb.mul(pb.mul(this.NDF, this.G), this.F);
          this.$l.denominator = pb.mul(pb.mul(4, pb.max(pb.dot(this.normal, this.viewVec), 0)), pb.max(pb.dot(this.normal, this.L), 0));
          this.specular = pb.div(this.nominator, pb.max(this.denominator, 0.001));
          this.diffuse = pb.mul(pb.sub(pb.vec3(1), this.F), pb.div(pb.sub(1, this.surfaceData.metallic), 3.1416));
        },
      );
    }
    pb.globalScope[BrdfPBR.funcNameCalcPBRLight](
      normal,
      lightDir,
      viewVec,
      surfaceData,
      outDiffuse,
      outSpecular,
    );
  }
}
