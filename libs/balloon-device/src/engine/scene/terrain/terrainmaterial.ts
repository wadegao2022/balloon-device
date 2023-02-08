import { Material } from '../material';
import { ShaderLib } from '../materiallib';
import { TerrainLightModel } from './terrainlightmodel';
import { Device, Texture2D, BindGroup, GPUProgram, PBGlobalScope, ProgramBuilder } from '../../device';
import { forwardComputeLighting, forwardComputeLightingMultiPass, ShadowMapPass } from '../renderers';
import * as values from '../values';
import type { DrawContext } from '../drawable';
import type { Vector2 } from '../../math';

export enum TerrainRenderMode {
  UNKNOWN = 0,
  NORMAL = 1,
  DETAIL = 2,
}

export const MAX_DETAIL_TEXTURE_LEVELS = 8;

export class TerrainMaterial extends Material {
  private _lightModel: TerrainLightModel;
  constructor(device: Device) {
    super(device);
    this._lightModel = new TerrainLightModel();
  }
  get baseMap(): Texture2D {
    return this._lightModel.terrainBaseMap;
  }
  set baseMap(tex: Texture2D) {
    this._lightModel.terrainBaseMap = tex;
  }
  get normalMap(): Texture2D {
    return this._lightModel.terrainNormalMap;
  }
  set normalMap(tex: Texture2D) {
    this._lightModel.terrainNormalMap = tex;
  }
  get detailMaskMap(): Texture2D {
    return this._lightModel.detailMaskMap;
  }
  set detailMaskMap(tex: Texture2D) {
    this._lightModel.detailMaskMap = tex;
  }
  get numDetailMaps(): number {
    return this._lightModel.numDetailMaps;
  }
  getDetailColorMap(index: number): Texture2D {
    return this._lightModel.getDetailColorMap(index);
  }
  getDetailScale(index: number): Vector2 {
    return this._lightModel.getDetailScale(index);
  }
  addDetailMap(color: Texture2D, scale: Vector2) {
    this._lightModel.addDetailMap(color, scale);
  }
  isTransparent(): boolean {
    return false;
  }
  supportLighting(): boolean {
    return this._lightModel.supportLighting();
  }
  applyUniforms(bindGroup: BindGroup, ctx: DrawContext, needUpdate: boolean): void {
    super.applyUniforms(bindGroup, ctx, needUpdate);
    this._lightModel.applyUniformsIfOutdated(bindGroup, ctx);
  }
  protected _createHash(): string {
    return this._lightModel.getHash();
  }
  protected _createProgram(pb: ProgramBuilder, ctx: DrawContext, func: number): GPUProgram {
    const that = this;
    const lib = new ShaderLib(pb);
    if (ctx.materialFunc === values.MATERIAL_FUNC_DEPTH_SHADOW && (ctx.renderPass as ShadowMapPass).light.shadow.depthClampEnabled) {
      pb.emulateDepthClamp = true;
    } else {
      pb.emulateDepthClamp = false;
    }
    return pb.buildRenderProgram({
      vertex(this: PBGlobalScope) {
        const terrainInfoStruct = pb.defineStruct(null, 'std140', pb.ivec4('value'));
        Material.initShader(pb, ctx);
        that._lightModel.setupUniforms(this);
        this.$inputs.pos = pb.vec3().attrib('position');
        this.$inputs.normal = pb.vec3().attrib('normal');
        this.$inputs.height = pb.float().attrib('custom0');
        this.$outputs.uv = pb.vec2().tag(that._lightModel.uniformUV);
        this.$outputs.worldPosition = pb.vec4().tag(ShaderLib.USAGE_WORLD_POSITION);
        this.$outputs.worldNormal = pb.vec3().tag(ShaderLib.USAGE_WORLD_NORMAL);
        this.scaleOffset = pb.defineStruct(null, 'std140', pb.vec4('value'))().uniform(2);
        this.terrainInfo = terrainInfoStruct().uniform(2); // terrainSizeX, terrainSizeZ, numDetailTextureLevels, detailTextureSize
        this.$mainFunc(function () {
          this.$l.p = pb.add(pb.mul(this.$inputs.pos.xz, this.scaleOffset.value.xz), this.scaleOffset.value.yw);
          this.$l.pos = pb.vec3(this.p.x, this.$inputs.height, this.p.y);
          // this.$builtins.position = lib.ftransform(this.$l.pos);
          this.$outputs.uv = pb.div(this.p.xy, pb.vec2(this.terrainInfo.value.xy));
          this.$outputs.worldPosition = lib.objectSpacePositionToWorld(this.$l.pos);
          this.$outputs.worldNormal = pb.normalize(lib.objectSpaceVectorToWorld(this.$inputs.normal));
          this.$builtins.position = lib.ftransform(this.$l.pos);
        });
      },
      fragment(this: PBGlobalScope) {
        Material.initShader(pb, ctx);
        if (func === values.MATERIAL_FUNC_NORMAL) {
          that._lightModel.setupUniforms(this);
          this.$outputs.outColor = pb.vec4();
          this.$mainFunc(function () {
            this.$l.litColor = forwardComputeLighting(this, that._lightModel, ctx);
            this.$outputs.outColor = lib.encodeColorOutput(this.litColor);
          });
        } else if (func === values.MATERIAL_FUNC_DEPTH_ONLY) {
          this.$outputs.outColor = pb.vec4();
          this.$mainFunc(function () {
            this.$outputs.outColor = pb.vec4(1);
          })
        } else if (func === values.MATERIAL_FUNC_DEPTH_SHADOW) {
          this.$outputs.outColor = pb.vec4();
          this.$mainFunc(function () {
            this.$outputs.outColor = (ctx.renderPass as ShadowMapPass).light.shadow.computeShadowMapDepth(this);
          });
        } else {
          throw new Error(`unknown material function: ${func}`);
        }
      }
    });
  }
}

/*
export class TerrainMaterial extends Material {
  protected _renderMode: TerrainRenderMode;
  protected _detailTexture: Texture2D;
  protected _normalTexture: Texture2D;
  protected _detailNormalTexture: Texture2D;
  protected _lightModel: LambertLightModel;
  constructor(device: Device) {
    super(device);
    this._renderMode = TerrainRenderMode.DETAIL;
    this._detailTexture = null;
    this._normalTexture = null;
    this._detailNormalTexture = null;
    this._lightModel = new LambertLightModel();
  }
  get renderMode(): TerrainRenderMode {
    return this._renderMode;
  }
  set renderMode(val: TerrainRenderMode) {
    if (val !== this._renderMode) {
      this._renderMode = val;
      this.optionChanged(true);
    }
  }
  get detailTexture(): Texture2D {
    return this._detailTexture;
  }
  set detailTexture(tex: Texture2D) {
    tex = tex || null;
    if (tex !== this._detailTexture) {
      this.optionChanged(!this._detailTexture || !tex);
      this._detailTexture = tex;
    }
  }
  get normalTexture(): Texture2D {
    return this._normalTexture;
  }
  set normalTexture(tex: Texture2D) {
    tex = tex || null;
    if (tex !== this._normalTexture) {
      this.optionChanged(!this._normalTexture || !tex);
      this._normalTexture = tex;
    }
  }
  get detailNormalTexture(): Texture2D {
    return this._detailNormalTexture;
  }
  set detailNormalTexture(tex: Texture2D) {
    tex = tex || null;
    if (tex !== this._detailNormalTexture) {
      this.optionChanged(!this._detailNormalTexture || !tex);
      this._detailNormalTexture = tex;
    }
  }
  supportLighting(): boolean {
    return this._lightModel ? this._lightModel.supportLighting() : false;
  }
  applyUniforms(bindGroup: BindGroup, ctx: DrawContext, needUpdate: boolean): void {
    super.applyUniforms(bindGroup, ctx, needUpdate);
    this._lightModel?.applyUniformsIfOutdated(bindGroup);
  }
  protected _createHash(): string {
    return `${this._renderMode}|${Number(!!this._detailTexture)}|${Number(!!this._detailNormalTexture)}|${this._lightModel?.getHash() || ''}`;
  }
  protected _applyUniforms(bindGroup: BindGroup, ctx: DrawContext) {
    if (this._detailTexture) {
      bindGroup.setTexture('detailTexture', this._detailTexture);
    }
    if (this._normalTexture) {
      bindGroup.setTexture('normalTexture', this._normalTexture);
    }
    if (this._detailNormalTexture) {
      bindGroup.setTexture('detailNormalTexture', this._detailNormalTexture);
    }
  }
  protected _createProgram(pb: ProgramBuilder, ctx: DrawContext, func: number): GPUProgram {
    const that = this;
    const lib = new ShaderLib(pb);
    return pb.buildRenderProgram({
      vertex(this: PBGlobalScope) {
        const terrainInfoStruct = pb.defineStruct(null, 'std140', pb.ivec4('value'));
        Material.initShader(pb, ctx);
        this.$inputs.pos = pb.vec3().attrib('position');
        this.$inputs.height = pb.float().attrib('custom0');
        const texCoordUsed = [];
        for (let i = 0; i < MAX_TEXCOORD_INDEX_COUNT; i++) {
          texCoordUsed[i] = !!that._lightModel?.isTexCoordIndexUsed(i);
        }
        for (let i = 0; i < MAX_TEXCOORD_INDEX_COUNT; i++) {
          if (texCoordUsed[i]) {
            this.$inputs[`texcoord${i}`] = pb.vec2().attrib(`texCoord${i}` as any);
          }
        }
        this.$outputs.uv = pb.vec2();
        this.$outputs.worldPosition = pb.vec4().tag(ShaderLib.USAGE_WORLD_POSITION);
        this.$outputs.normalScale = pb.float().tag(ShaderLib.USAGE_NORMAL_SCALE);
        this.scaleOffset = pb.defineStruct(null, 'std140', pb.vec4('value'))().uniform(2);
        this.terrainInfo = terrainInfoStruct().uniform(2); // terrainSizeX, terrainSizeZ, numDetailTextureLevels, detailTextureSize
        this.$mainFunc(function () {
          this.$l.p = pb.add(pb.mul(this.$inputs.pos.xz, this.scaleOffset.value.xz), this.scaleOffset.value.yw);
          this.$l.pos = pb.vec3(this.p.x, this.$inputs.height, this.p.y);
          this.$builtins.position = lib.ftransform(this.$l.pos);
          this.$outputs.uv = pb.div(this.p.xy, pb.vec2(this.terrainInfo.value.xy));
          this.$outputs.normalScale = 1;
          this.$outputs.worldPosition = lib.objectSpacePositionToWorld(this.$l.pos);
          for (let i = 0; i < MAX_TEXCOORD_INDEX_COUNT; i++) {
            if (texCoordUsed[i]) {
              this.$outputs[`texcoord${i}`] = this.$inputs[`texcoord${i}`];
            }
          }
        });
      },
      fragment(this: PBGlobalScope) {
        Material.initShader(pb, ctx);
        if (func === values.MATERIAL_FUNC_NORMAL) {
          const terrainInfoStruct = pb.defineStruct(null, 'std140', pb.ivec4('value'));
          this.normalTexture = pb.tex2D().uniform(2);
          this.terrainInfo = terrainInfoStruct().uniform(2); // terrainSizeX, terrainSizeZ, numDetailTextureLevels, detailTextureSize
          this.detailTextureRects = pb.vec4[MAX_DETAIL_TEXTURE_LEVELS]().uniform(2);
          this.detailTexture = pb.tex2D().uniform(2);
          if (that._detailNormalTexture) {
            this.detailNormalTexture = pb.tex2D().uniform(2).tag(ShaderLib.USAGE_NORMAL_MAP);
          }
          that._lightModel?.setupUniforms(this);
          this.$outputs.outColor = pb.vec4();
          this.$mainFunc(function () {
            this.normal = pb.sub(pb.mul(pb.textureSample(this.normalTexture, this.$inputs.uv).xyz, 2), pb.vec3(1));
            this.worldNormal = pb.normalize(lib.objectSpaceVectorToWorld(this.normal));
            if (that._detailNormalTexture) {
              this.axis = pb.sign(this.worldNormal);
              this.tangent = pb.vec3(1, 0, 0);
              this.binormal = pb.cross(this.tangent, this.worldNormal);
              this.tangent = pb.cross(this.worldNormal, this.binormal);
            }
            if (that._renderMode === TerrainRenderMode.DETAIL || that._detailNormalTexture) {
              this.$l.uv = this.$inputs.uv;
              this.$l.padding = pb.vec2(pb.div(pb.float(1), pb.float(this.terrainInfo.value.w)));
              this.$l.numLevels = this.terrainInfo.value.z;
              if (that._renderMode === TerrainRenderMode.DETAIL) {
                this.$l.albedo = pb.vec3();
              }
              this.$for(pb.int('i'), 0, MAX_DETAIL_TEXTURE_LEVELS, function () {
                this.rect = this.detailTextureRects.at(this.i);
                this.rectLeftTopPadded = pb.add(this.rect.xy, this.padding);
                this.rectRightBottomPadded = pb.sub(this.rect.zw, this.padding);
                this.$if(pb.or(pb.equal(this.i, pb.sub(this.numLevels, 1)), pb.all(pb.bvec4(pb.greaterThanEqual(this.uv, this.rectLeftTopPadded), pb.lessThanEqual(this.uv, this.rectRightBottomPadded)))), function () {
                  this.$l.detailUV = pb.div(pb.sub(this.uv, this.rect.xy), pb.sub(this.rect.zw, this.rect.xy));
                  this.$l.detailUV.x = pb.div(pb.add(pb.float(this.i), this.$l.detailUV.x), pb.float(this.numLevels));
                  this.$l.detailUV.y = pb.sub(1, this.$l.detailUV.y);
                  if (that._renderMode === TerrainRenderMode.DETAIL) {
                    this.albedo = pb.textureSample(this.detailTexture, this.detailUV).xyz;
                  }
                  if (that._detailNormalTexture) {
                    this.worldNormal = lib.evalNormal(this.worldNormal, this.detailUV, this.tangent, this.binormal);
                  }
                  this.$break();
                });
              });
            }
            if (that._renderMode === TerrainRenderMode.DETAIL) {
              this.$l.litcolor = forwardComputeLighting(pb, this.worldNormal, this.albedo, (ctx.renderPass as ForwardRenderPass).shadowMaps, ctx.renderPass.renderScheme.useFloatShadowMap(), that._lightModel, ctx.environment);
            } else {
              this.$l.litcolor = pb.add(pb.mul(this.worldNormal, 0.5), pb.vec3(0.5));
            }
            this.$outputs.outColor = lib.encodeColorOutput(pb.vec4(this.litcolor, 1));
          });
        } else if (func === values.MATERIAL_FUNC_DEPTH_ONLY) {
          this.$outputs.outColor = pb.vec4();
          this.$mainFunc(function () {
            this.$outputs.outColor = pb.vec4(1);
          })
        } else if (func === values.MATERIAL_FUNC_DEPTH_SHADOW) {
          const floatFB = ctx.renderPass.renderScheme.useFloatShadowMap();
          const lib = new ShaderLib(pb);
          this.$outputs.outColor = pb.vec4();
          this.$mainFunc(function () {
            this.$l.depth = shadowMapComputeDepth(this);
            this.$outputs.outColor = floatFB ? pb.vec4(this.depth, 0, 0, 1) : lib.encodeNormalizedFloatToRGBA(this.depth);
          });
        } else {
          throw new Error(`unknown material function: ${func}`);
        }
      }
    });
  }
}
*/
