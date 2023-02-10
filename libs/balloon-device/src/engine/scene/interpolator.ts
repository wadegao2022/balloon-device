import { Quaternion } from "../math";
import { numberClamp, TypedArray } from "../../shared";

export enum InterpolationMode {
  UNKNOWN = 0,
  STEP = 1,
  LINEAR = 2,
  CUBICSPLINE = 3
}

export enum InterpolationTarget {
  UNKNOWN = 0,
  ROTATION = 1,
  TRANSLATION = 2,
  SCALING = 3,
  WEIGHTS = 4,
}

const tmpQuat1 = new Quaternion();
const tmpQuat2 = new Quaternion();

export class Interpolator {
  private _prevKey: number;
  private _prevT: number;
  private _inputs: TypedArray;
  private _outputs: TypedArray;
  private _mode: InterpolationMode;
  private _target: InterpolationTarget;
  private _stride: number;
  private _maxTime: number;
  constructor(mode: InterpolationMode, target: InterpolationTarget, inputs: TypedArray, outputs: TypedArray, stride?: number) {
    this._prevKey = 0;
    this._prevT = 0;
    this._inputs = inputs;
    this._outputs = outputs;
    this._mode = mode;
    this._target = target;
    this._stride = target === InterpolationTarget.WEIGHTS ? (stride ?? 0) : target === InterpolationTarget.ROTATION ? 4 : 3;
    this._maxTime = inputs[inputs.length - 1];
  }
  get mode(): InterpolationMode {
    return this._mode;
  }
  get target(): InterpolationTarget {
    return this._target;
  }
  get maxTime(): number {
    return this._maxTime;
  }
  slerpQuat(q1: Quaternion, q2: Quaternion, t: number, result?: Float32Array): Float32Array {
    return Quaternion.slerp(Quaternion.normalize(q1), Quaternion.normalize(q2), t, new Quaternion(result)).inplaceNormalize().getArray();
  }
  step(prevKey: number, result?: Float32Array): Float32Array {
    result = result || new Float32Array(this._stride);
    for (let i = 0; i < this._stride; i++) {
      result[i] = this._outputs[prevKey * this._stride + i];
    }
    return result;
  }
  linear(prevKey: number, nextKey: number, t: number, result?: Float32Array): Float32Array {
    result = result || new Float32Array(this._stride);
    for (let i = 0; i < this._stride; i++) {
      result[i] = this._outputs[prevKey * this._stride + i] * (1 - t) + this._outputs[nextKey * this._stride + i] * t;
    }
    return result;
  }
  cubicSpline(prevKey: number, nextKey: number, keyDelta: number, t: number, result?: Float32Array): Float32Array {
    result = result || new Float32Array(this._stride);
    const prevIndex = prevKey * this._stride * 3;
    const nextIndex = nextKey * this._stride * 3;
    const A = 0;
    const V = this._stride;
    const B = 2 * this._stride;
    const tSq = t * t;
    const tCub = tSq * t;
    for (let i = 0; i < this._stride; i++) {
      const v0 = this._outputs[prevIndex + i + V];
      const a = keyDelta * this._outputs[nextIndex + i + A];
      const b = keyDelta * this._outputs[prevIndex + i + B];
      const v1 = this._outputs[nextIndex + i + V];
      result[i] = ((2 * tCub - 3 * tSq + 1) * v0) + ((tCub - 2 * tSq + t) * b) + ((-2 * tCub + 3 * tSq) * v1) + ((tCub - tSq) * a);
    }
    return result;
  }
  interpolate(t: number, maxTime: number, result?: Float32Array): Float32Array {
    if (t === undefined) {
      return undefined;
    }
    const input = this._inputs;
    const output = this._outputs;
    if (output.length === this._stride) {
      result = result || new Float32Array(this._stride);
      for (let i = 0; i < this._stride; i++) {
        result[i] = output[i];
      }
      return result;
    }
    t = numberClamp(t % maxTime, input[0], input[input.length - 1]);
    if (this._prevT > t) {
      this._prevKey = 0;
    }
    this._prevT = t;
    let nextKey: number;
    for (let i = this._prevKey; i < input.length; ++i) {
      if (t <= input[i]) {
        nextKey = numberClamp(i, 1, input.length - 1);
        break;
      }
    }
    this._prevKey = numberClamp(nextKey - 1, 0, nextKey);
    const keyDelta = input[nextKey] - input[this._prevKey];
    const tn = (t - input[this._prevKey]) / keyDelta;
    if (this._target === InterpolationTarget.ROTATION) {
      if (this._mode === InterpolationMode.CUBICSPLINE) {
        return this.cubicSpline(this._prevKey, nextKey, keyDelta, tn, result);
      } else if (this._mode === InterpolationMode.LINEAR) {
        this.getQuat(this._prevKey, tmpQuat1.getArray());
        this.getQuat(nextKey, tmpQuat2.getArray());
        return this.slerpQuat(tmpQuat1, tmpQuat2, tn, result);
      } else /* if (this._mode === InterpolationMode.STEP) */ {
        return this.getQuat(this._prevKey, result);
      }
    }
    switch (this._mode) {
      case InterpolationMode.STEP:
        return this.step(this._prevKey, result);
      case InterpolationMode.CUBICSPLINE:
        return this.cubicSpline(this._prevKey, nextKey, keyDelta, tn, result);
      case InterpolationMode.LINEAR:
      default:
        return this.linear(this._prevKey, nextKey, tn, result);
    }
  }
  getQuat(index: number, result?: Float32Array): Float32Array {
    result = result || new Float32Array(4);
    result[0] = this._outputs[4 * index];
    result[1] = this._outputs[4 * index + 1];
    result[2] = this._outputs[4 * index + 2];
    result[3] = this._outputs[4 * index + 3];
    return result;
  }
}

