import { Blitter, BlitType } from "./blitter";
import { BindGroup, ProgramBuilder, PBShaderExp, ShaderType, PBInsideFunctionScope, PBGlobalScope } from "../../device";

export class GammaBlitter extends Blitter {
  protected _gamma: number;
  constructor(gamma: number) {
    super();
    this._gamma = gamma ?? 2.2;
  }
  setup(scope: PBGlobalScope, type: BlitType) {
    const pb = scope.$builder;
    if (pb.shaderType === ShaderType.Fragment) {
      scope.gamma = pb.float().uniform(0);
    }
  }
  setUniforms(bindGroup: BindGroup) {
    bindGroup.setValue('gamma', this._gamma);
  }
  filter(scope: PBInsideFunctionScope, type: BlitType, srcTex: PBShaderExp, srcUV: PBShaderExp, srcLayer: PBShaderExp): PBShaderExp {
    const pb = scope.$builder;
    return pb.pow(this.readTexel(scope, type, srcTex, srcUV, srcLayer), pb.vec4(pb.vec3(scope.gamma), 1));
  }
  protected calcHash(): string {
    return '';
  }
}
