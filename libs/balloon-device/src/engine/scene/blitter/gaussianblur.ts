import { Blitter, BlitType } from "./blitter";
import { BindGroup, ProgramBuilder, PBShaderExp, ShaderType, PBInsideFunctionScope, PBGlobalScope } from "../../device";

export class GaussianBlurBlitter extends Blitter {
  protected _phase: 'horizonal' | 'vertical';
  protected _kernelSize: number;
  protected _sigma: number;
  protected _blurSize: number;
  protected _logSpace: boolean;
  protected _logSpaceMultiplier: number;
  constructor(phase: 'horizonal' | 'vertical', kernalSize: number, sigma: number, blurSize: number) {
    super();
    this._phase = phase;
    this._kernelSize = kernalSize;
    this._sigma = sigma;
    this._blurSize = blurSize;
    this._logSpace = false;
    this._logSpaceMultiplier = 1;
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
    if (this._kernelSize !== val) {
      this._kernelSize = val;
      this.invalidateHash();
    }
  }
  get logSpace(): boolean {
    return this._logSpace;
  }
  set logSpace(val: boolean) {
    if (this._logSpace !== !!val) {
      this._logSpace = !!val;
      this.invalidateHash();
    }
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
      scope.sigma = pb.float().uniform(0);
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
    }
  }
  setUniforms(bindGroup: BindGroup) {
    bindGroup.setValue('sigma', this._sigma);
    bindGroup.setValue('blurSize', this._blurSize);
    if (this._logSpace && this._phase === 'horizonal') {
      bindGroup.setValue('multiplier', this._logSpaceMultiplier);
    }
  }
  filter(scope: PBInsideFunctionScope, type: BlitType, srcTex: PBShaderExp, srcUV: PBShaderExp, srcLayer: PBShaderExp): PBShaderExp {
    const that = this;
    const pb = scope.$builder;
    scope.incrementalGaussian = pb.vec3();
    scope.incrementalGaussian.x = pb.div(1, pb.mul(scope.sigma, Math.sqrt(2 * Math.PI)));
    scope.incrementalGaussian.y = pb.exp(pb.div(-0.5, pb.mul(scope.sigma, scope.sigma)));
    scope.incrementalGaussian.z = pb.mul(scope.incrementalGaussian.y, scope.incrementalGaussian.y);
    scope.coefficientSum = pb.float(0);
    scope.minExpValue = pb.vec4(87, 87, 87, 87);
    scope.d0 = that.readTexel(scope, type, srcTex, srcUV, srcLayer);
    if (that._logSpace) {
      scope.avgValue = pb.vec4(scope.incrementalGaussian.x);
    } else {
      scope.avgValue = pb.mul(that.readTexel(scope, type, srcTex, srcUV, srcLayer), scope.incrementalGaussian.x);
    }
    scope.coefficientSum = pb.add(scope.coefficientSum, scope.incrementalGaussian.x);
    scope.incrementalGaussian = pb.vec3(pb.mul(scope.incrementalGaussian.xy, scope.incrementalGaussian.yz), scope.incrementalGaussian.z);
    scope.$for(pb.float('i'), 1, scope.numBlurPixelsPerSide, function () {
      this.d1 = that.readTexel(scope, type, srcTex, pb.sub(srcUV, pb.mul(this.blurMultiplyVec, this.blurSize, this.i)), srcLayer);
      this.d2 = that.readTexel(scope, type, srcTex, pb.add(srcUV, pb.mul(this.blurMultiplyVec, this.blurSize, this.i)), srcLayer);
      if (that._logSpace) {
        if (that._phase === 'horizonal') {
          this.avgValue = pb.add(this.avgValue, pb.mul(pb.exp(pb.min(this.minExpValue, pb.mul(pb.sub(this.d1, this.d0), this.multiplier))), this.incrementalGaussian.x));
          this.avgValue = pb.add(this.avgValue, pb.mul(pb.exp(pb.min(this.minExpValue, pb.mul(pb.sub(this.d2, this.d0), this.multiplier))), this.incrementalGaussian.x));
        } else {
          this.avgValue = pb.add(this.avgValue, pb.mul(pb.exp(pb.min(this.minExpValue, pb.sub(this.d1, this.d0))), this.incrementalGaussian.x));
          this.avgValue = pb.add(this.avgValue, pb.mul(pb.exp(pb.min(this.minExpValue, pb.sub(this.d2, this.d0))), this.incrementalGaussian.x));
        }
      } else {
        this.avgValue = pb.add(this.avgValue, pb.mul(this.d1, this.incrementalGaussian.x));
        this.avgValue = pb.add(this.avgValue, pb.mul(this.d2, this.incrementalGaussian.x));
      }
      this.coefficientSum = pb.add(this.coefficientSum, pb.mul(this.incrementalGaussian.x, 2));
      this.incrementalGaussian = pb.vec3(pb.mul(this.incrementalGaussian.xy, this.incrementalGaussian.yz), this.incrementalGaussian.z);
    });
    scope.$l.outColor = pb.div(scope.avgValue, scope.coefficientSum);
    if (that._logSpace) {
      if (that._phase === 'horizonal') {
        scope.outColor = pb.add(pb.mul(scope.multiplier, scope.d0), pb.log(scope.outColor));
      } else {
        scope.outColor = pb.add(scope.d0, pb.log(scope.outColor));
      }
    }
    return scope.outColor;
  }
  protected calcHash(): string {
    return `${this._phase}-${this._kernelSize}-${Number(!!this._logSpace)}`;
  }
}
