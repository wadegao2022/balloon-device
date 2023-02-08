import { Blitter, BlitType } from "./blitter";
import { BindGroup, ProgramBuilder, PBShaderExp, ShaderType, PBInsideFunctionScope, PBGlobalScope } from "../../device";

export class BoxFilterBlitter extends Blitter {
  protected _phase: 'horizonal' | 'vertical';
  protected _kernelSize: number;
  protected _sigma: number;
  protected _blurSize: number;
  protected _logSpace: boolean;
  protected _logSpaceMultiplier: number;
  constructor(phase: 'horizonal' | 'vertical', kernelSize: number, blurSize: number) {
    super();
    this._phase = phase;
    this._kernelSize = kernelSize;
    this._blurSize = blurSize;
    this._logSpace = false;
    this._logSpaceMultiplier = 1;
  }
  get logSpace(): boolean {
    return this._logSpace;
  }
  set logSpace(val: boolean) {
    this._logSpace = !!val;
  }
  get logSpaceMultiplier(): number {
    return this._logSpaceMultiplier;
  }
  set logSpaceMultiplier(val: number) {
    this._logSpaceMultiplier = val;
  }
  setup(scope: PBGlobalScope, type: BlitType) {
    const pb = scope.$builder;
    if (pb.shaderType === ShaderType.Fragment) {
      scope.blurSize = pb.float().uniform(0);
      if (this._logSpace && this._phase === 'horizonal') {
        scope.multiplier = pb.float().uniform(0);
      }
      if (this._phase !== 'horizonal' && this._phase !== 'vertical') {
        throw new Error(`GaussianBlurFilter.setupFilter() failed: invalid phase: ${this._phase}`);
      }
      if (!Number.isInteger(this._kernelSize) || this._kernelSize < 0 || (this._kernelSize & 1) === 0) {
        throw new Error(`GaussianBlurFilter.setupFilter() failed: invalid kernel size: ${this._kernelSize}`);
      }
      scope.blurMultiplyVec = type === 'cube'
        ? this._phase === 'horizonal' ? pb.vec3(1, 0, 0) : pb.vec3(0, 1, 0)
        : this._phase === 'horizonal' ? pb.vec2(1, 0) : pb.vec2(0, 1);
      scope.numBlurPixelsPerSide = pb.float((this._kernelSize + 1) / 2);
      scope.weight = pb.float(1 / this._kernelSize);
    }
  }
  setUniforms(bindGroup: BindGroup) {
    bindGroup.setValue('blurSize', this._blurSize);
    if (this._logSpace && this._phase === 'horizonal') {
      bindGroup.setValue('multiplier', this._logSpaceMultiplier);
    }
  }
  filter(scope: PBInsideFunctionScope, type: BlitType, srcTex: PBShaderExp, srcUV: PBShaderExp, srcLayer: PBShaderExp): PBShaderExp {
    const that = this;
    const pb = scope.$builder;
    scope.d0 = that.readTexel(scope, type, srcTex, srcUV, srcLayer);
    if (that._logSpace) {
      scope.avgValue = pb.vec4(scope.weight);
    } else {
      scope.avgValue = pb.mul(that.readTexel(scope, type, srcTex, srcUV, srcLayer), scope.weight);
    }
    scope.$for(pb.float('i'), 1, scope.numBlurPixelsPerSide, function () {
      this.d1 = that.readTexel(this, type, srcTex, pb.sub(srcUV, pb.mul(this.blurMultiplyVec, this.blurSize, this.i)), srcLayer);
      this.d2 = that.readTexel(this, type, srcTex, pb.add(srcUV, pb.mul(this.blurMultiplyVec, this.blurSize, this.i)), srcLayer);
      if (that._logSpace) {
        if (that._phase === 'horizonal') {
          this.avgValue = pb.add(this.avgValue, pb.mul(pb.exp(pb.mul(pb.sub(this.d1, this.d0), this.multiplier)), this.weight));
          this.avgValue = pb.add(this.avgValue, pb.mul(pb.exp(pb.mul(pb.sub(this.d2, this.d0), this.multiplier)), this.weight));
        } else {
          this.avgValue = pb.add(this.avgValue, pb.mul(pb.exp(pb.sub(this.d1, this.d0)), this.weight));
          this.avgValue = pb.add(this.avgValue, pb.mul(pb.exp(pb.sub(this.d2, this.d0)), this.weight));
        }
      } else {
        this.avgValue = pb.add(this.avgValue, pb.mul(this.d1, this.weight));
        this.avgValue = pb.add(this.avgValue, pb.mul(this.d2, this.weight));
      }
    });
    if (that._logSpace) {
      if (that._phase === 'horizonal') {
        scope.avgValue = pb.add(pb.mul(scope.multiplier, scope.d0), pb.log(scope.avgValue));
      } else {
        scope.avgValue = pb.add(scope.d0, pb.log(scope.avgValue));
      }
    }
    return scope.avgValue;
  }
  protected calcHash(): string {
    return `${this._phase}-${this._kernelSize}-${Number(!!this._logSpace)}`;
  }
}
