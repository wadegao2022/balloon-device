import { Material } from '../material';
import { ShaderLib } from './shaderlib';
import { Device, TextureCube, BindGroup, FaceMode, GPUProgram, PBGlobalScope, ProgramBuilder, TextureSampler } from '../../device';
import * as values from '../values';
import type { DrawContext } from '../drawable';

export class SkyboxMaterial extends Material {
  private _skyCubemap: TextureCube;
  private _skySampler: TextureSampler;
  constructor(device: Device) {
    super(device);
    this._renderStateSet.useRasterizerState().setCullMode(FaceMode.NONE);
    this._skyCubemap = null;
    this._skySampler = null;
  }
  get skyCubeMap(): TextureCube {
    return this._skyCubemap;
  }
  set skyCubeMap(tex: TextureCube) {
    tex = tex || null;
    if (tex !== this._skyCubemap) {
      const hash = this._createHash();
      this._skyCubemap = tex;
      if (tex && !this._skySampler) {
        this._skySampler = tex.getDefaultSampler(false);
      }
      this.optionChanged(hash !== this._createHash());
    }
  }
  supportLighting(): boolean {
    return false;
  }
  protected _createHash(): string {
    if (!this._skyCubemap) {
      return '0';
    } else if (this.device.getDeviceType() === 'webgpu') {
      return this._skyCubemap.isFilterable() ? '1' : '2';
    } else {
      return '1';
    }
  }
  protected _applyUniforms(bindGroup: BindGroup, ctx: DrawContext): void {
    if (this._skyCubemap) {
      bindGroup.setTexture('skyCubeMap', this._skyCubemap, this._skySampler);
    }
  }
  protected _createProgram(pb: ProgramBuilder, ctx: DrawContext, func: number): GPUProgram {
    const that = this;
    const lib = new ShaderLib(pb);
    return pb.buildRenderProgram({
      vertex(this: PBGlobalScope) {
        Material.initShader(pb, ctx);
        this.$inputs.pos = pb.vec3().attrib('position');
        this.$outputs.texCoord = pb.vec3();
        this.$mainFunc(function () {
          this.$outputs.texCoord = this.$inputs.pos;
          this.$l.worldPos = pb.add(pb.reflection.tag(ShaderLib.USAGE_CAMERA_POSITION), lib.objectSpacePositionToWorld(this.$inputs.pos).xyz);
          this.$builtins.position = lib.worldSpacePositionToClip(this.worldPos);
          this.$builtins.position.z = this.$builtins.position.w;
        });
      },
      fragment(this: PBGlobalScope) {
        Material.initShader(pb, ctx);
        if (func === values.MATERIAL_FUNC_NORMAL) {
          this.$outputs.outColor = pb.vec4();
          if (that._skyCubemap) {
            this.skyCubeMap = pb.texCube().uniform(2);
            if (!that._skyCubemap.isFilterable()) {
              this.skyCubeMap.sampleType('unfilterable-float');
            }
          }
          this.$mainFunc(function () {
            if (that._skyCubemap) {
              this.$l.texCoord = pb.normalize(this.$inputs.texCoord);
              this.$l.color = pb.device?.getShaderCaps().supportShaderTextureLod
                ? pb.textureSampleLevel(this.skyCubeMap, this.texCoord, 0).xyz
                : pb.textureSample(this.skyCubeMap, this.texCoord).xyz
            } else {
              this.$l.color = pb.vec3(0);
            }
            this.$outputs.outColor = lib.encodeColorOutput(pb.vec4(this.color, 1));
          });
        } else {
          this.$mainFunc(function () {
            pb.discard();
          });
        }
      }
    });
  }
}

