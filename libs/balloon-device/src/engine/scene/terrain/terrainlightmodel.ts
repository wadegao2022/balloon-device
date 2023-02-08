import { LambertLightModel } from "../materiallib";
import { ShaderType, PBInsideFunctionScope, PBGlobalScope, PBShaderExp, Texture2D, BindGroup, TextureWrapping, TextureFilter, TextureSampler, BaseTexture } from "../../device";
import { Vector2 } from "../../math";
import { MATERIAL_FUNC_NORMAL } from "../values";
import type { DrawContext } from "../drawable";

export class TerrainLightModel extends LambertLightModel {
  protected static readonly funcNameCalcTerrainAlbedo = 'lib_terrainLM_albedo';
  protected static readonly funcNameCalcTerrainNormal = 'lib_terrainLM_normal';
  protected static readonly uniformTerrainBaseMap = 'lib_terrainLM_baseMap';
  protected static readonly uniformTerrainNormalMap = 'lib_terrainLM_normalMap';
  protected static readonly uniformMaskMap = 'lib_terrainLM_maskMap';
  protected static readonly uniformDetailMap = 'lib_terrainLM_detailMap';
  protected static readonly uniformDetailScales = 'lib_terrainLM_detailScales';
  protected static readonly uniformTerrainUV = 'lib_terrainLM_uv';
  protected _terrainBaseMap: Texture2D;
  protected _terrainBaseMapSampler: TextureSampler;
  protected _terrainNormalMap: Texture2D;
  protected _terrainNormalMapSampler: TextureSampler;
  protected _detailMaskMap: Texture2D;
  protected _detailMaskMapSampler: TextureSampler;
  protected _detailColorMaps: Texture2D[];
  protected _detailColorMapSamplers: TextureSampler[];
  protected _detailScales: Vector2[];
  constructor() {
    super();
    this._terrainBaseMap = null;
    this._terrainBaseMapSampler = null;
    this._terrainNormalMap = null;
    this._terrainNormalMapSampler = null;
    this._detailMaskMap = null;
    this._detailMaskMapSampler = null;
    this._detailColorMaps = [];
    this._detailColorMapSamplers = [];
    this._detailScales = [];
  }
  get terrainBaseMap(): Texture2D {
    return this._terrainBaseMap;
  }
  set terrainBaseMap(tex: Texture2D) {
    tex = tex || null;
    if (this._terrainBaseMap !== tex) {
      this.optionChanged(!this._terrainBaseMap || !tex)
      this._terrainBaseMap = tex;
    }
  }
  get terrainNormalMap(): Texture2D {
    return this._terrainNormalMap;
  }
  set terrainNormalMap(tex: Texture2D) {
    tex = tex || null;
    if (this._terrainNormalMap !== tex) {
      this.optionChanged(!this._terrainNormalMap || !tex)
      this._terrainNormalMap = tex;
    }
  }
  get detailMaskMap(): Texture2D {
    return this._detailMaskMap;
  }
  set detailMaskMap(tex: Texture2D) {
    tex = tex || null;
    if (this._detailMaskMap !== tex) {
      this.optionChanged(!this._detailMaskMap || !tex)
      this._detailMaskMap = tex;
      this._detailMaskMapSampler = tex.device.createSampler({
        magFilter: tex.isFilterable() ? TextureFilter.Linear : TextureFilter.Nearest,
        minFilter: tex.isFilterable() ? TextureFilter.Linear : TextureFilter.Nearest,
        mipFilter: tex.mipLevelCount === 1 ? TextureFilter.None : tex.isFilterable() ? TextureFilter.Linear : TextureFilter.Nearest,
      });
    }
  }
  get numDetailMaps(): number {
    return this._detailMaskMap ? this._detailColorMaps.length : 0;
  }
  get uniformUV(): string {
    return TerrainLightModel.uniformTerrainUV;
  }
  getDetailColorMap(index: number): Texture2D {
    return this._detailColorMaps[index];
  }
  getDetailScale(index: number): Vector2 {
    return this._detailScales[index];
  }
  supportLighting(): boolean {
    return !!this._terrainNormalMap;
  }
  calculateHash(): string {
    return `${this._detailColorMaps.map(tex => this._calcTextureHash(tex)).join('')}_${this._calcTextureHash(this._terrainBaseMap)}_${this._calcTextureHash(this._terrainNormalMap)}`;
  }
  addDetailMap(color: Texture2D, scale: Vector2) {
    if (!color) {
      console.error(`addDetailMap(): texture can not be null`);
      return;
    }
    scale = scale || Vector2.one();
    this._detailColorMaps.push(color);
    this._detailColorMapSamplers.push(color.device.createSampler({
      addressU: TextureWrapping.Repeat,
      addressV: TextureWrapping.Repeat,
      magFilter: color.isFilterable() ? TextureFilter.Linear : TextureFilter.Nearest,
      minFilter: color.isFilterable() ? TextureFilter.Linear : TextureFilter.Nearest,
      mipFilter: color.mipLevelCount === 1 ? TextureFilter.None : color.isFilterable() ? TextureFilter.Linear : TextureFilter.Nearest,
    }));
    this._detailScales.push(scale);
    this.optionChanged(true);
  }
  applyUniforms(bindGroup: BindGroup, ctx: DrawContext): void {
    // super.applyUniforms(bindGroup, ctx);
    if (ctx.materialFunc === MATERIAL_FUNC_NORMAL) {
      if (this._terrainBaseMap) {
        bindGroup.setTexture('terrainlm_baseMap', this._terrainBaseMap, this._terrainBaseMapSampler);
      }
      if (this._terrainNormalMap) {
        bindGroup.setTexture('terrainlm_normalMap', this._terrainNormalMap, this._terrainNormalMapSampler);
      }
      if (this.numDetailMaps > 0) {
        bindGroup.setTexture('terrainlm_maskMap', this._detailMaskMap, this._detailMaskMapSampler);
        for (let i = 0; i < this.numDetailMaps; i++) {
          bindGroup.setTexture(`terrainlm_detailMap${i}`, this._detailColorMaps[i], this._detailColorMapSamplers[i]);
          bindGroup.setValue(`terrainlm_detailScale${i}`, this._detailScales[i]);
        }
      }
    }
  }
  setupUniforms(scope: PBGlobalScope) {
    const pb = scope.$builder;
    if (pb.shaderType === ShaderType.Fragment) {
      if (this._terrainBaseMap && !scope.$query(TerrainLightModel.uniformTerrainBaseMap)) {
        scope.terrainlm_baseMap = pb.tex2D().uniform(2).tag(TerrainLightModel.uniformTerrainBaseMap);
      }
      if (this._terrainNormalMap && !scope.$query(TerrainLightModel.uniformTerrainNormalMap)) {
        scope.terrainlm_normalMap = pb.tex2D().uniform(2).tag(TerrainLightModel.uniformTerrainNormalMap);
      }
      for (let i = 0; i < this.numDetailMaps; i++) {
        scope[`terrainlm_detailMap${i}`] = pb.tex2D().uniform(2).tag(`${TerrainLightModel.uniformDetailMap}${i}`);
        scope[`terrainlm_detailScale${i}`] = pb.vec2().uniform(2).tag(`${TerrainLightModel.uniformDetailScales}${i}`);
      }
      if (this.numDetailMaps > 0 && !scope.$query(TerrainLightModel.uniformMaskMap)) {
        scope.terrainlm_maskMap = pb.tex2D().uniform(2).tag(TerrainLightModel.uniformMaskMap);
      }
    }
  }
  calculateAlbedo(scope: PBInsideFunctionScope): PBShaderExp {
    const that = this;
    const pb = scope.$builder;
    if (!pb.getFunction(TerrainLightModel.funcNameCalcTerrainAlbedo)) {
      pb.globalScope.$function(TerrainLightModel.funcNameCalcTerrainAlbedo, [], function () {
        const maskMap = this.$query(TerrainLightModel.uniformMaskMap);
        const uv = this.$query(TerrainLightModel.uniformTerrainUV);
        if (maskMap) {
          if (uv) {
            this.$l.color = pb.vec3(0);
            this.$l.uv = uv;
            this.$l.mask = pb.textureSample(maskMap, this.uv);
            for (let i = 0; i < that.numDetailMaps; i++) {
              this.color = pb.add(this.color, pb.mul(pb.textureSample(this.$query(`${TerrainLightModel.uniformDetailMap}${i}`), pb.mul(this.uv, this.$query(`${TerrainLightModel.uniformDetailScales}${i}`))).xyz, this.mask[i]));
            }
            this.$return(pb.vec4(this.color, 1));
          } else {
            this.$return(pb.vec4(1));
          }
        } else {
          const baseMap = this.$query(TerrainLightModel.uniformTerrainBaseMap);
          if (baseMap && uv) {
            this.$return(pb.textureSample(baseMap, uv));
          } else {
            this.$return(pb.vec4(1));
          }
        }
      });
    }
    return pb.globalScope[TerrainLightModel.funcNameCalcTerrainAlbedo]();
  }
  /** @internal */
  _calcTextureHash(tex: BaseTexture): string {
    if (!tex) {
      return '0';
    } else if (tex.device.getDeviceType() === 'webgpu') {
      return tex.isFilterable() ? '1' : '2';
    } else {
      return '1';
    }
  }
}
