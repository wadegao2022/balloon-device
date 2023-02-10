/**
 *  Math type definitions
 */

import { IterableWrapper, formatNumber, numberEquals, numberClamp } from '../../shared';

export enum CubeFace {
  PX = 0,
  NX = 1,
  PY = 2,
  NY = 3,
  PZ = 4,
  NZ = 5,
}

export class VectorBase extends IterableWrapper {
  /** @internal */
  protected _doCallback: boolean;
  /** @internal */
  protected _changeCallback: () => void;
  constructor(nOrArray: number | Float32Array) {
    super(nOrArray);
    this._doCallback = true;
    this._changeCallback = null;
  }
  getChangeCallback(): () => void {
    return this._changeCallback;
  }
  setChangeCallback(callback: () => void) {
    this._changeCallback = callback;
  }
  get callbackEnabled() {
    return this._doCallback;
  }
  set callbackEnabled(enabled: boolean) {
    this._doCallback = enabled;
  }
  changeNotify() {
    this._doCallback && this._changeCallback?.();
  }
  equalsTo(other: IterableWrapper, epsilon?: number): boolean {
    if (!other || this.size !== other.size) {
      return false;
    }
    if (this === other) {
      return true;
    }
    const thisData = this.getArray();
    const otherData = other.getArray();
    for (let i = 0; i < this.size; i++) {
      if (!numberEquals(thisData[i], otherData[i], epsilon)) {
        return false;
      }
    }
    return true;
  }
  toString(): string {
    const elements = Array(this.size);
    const data = this.getArray();
    for (let i = 0; i < this.size; i++) {
      elements[i] = formatNumber(data[i], 3);
    }
    return `${this.constructor.name}{${elements.join(', ')}}`;
  }
  assign(other: ArrayLike<number>) {
    this._v.set((other as any)._v || other);
    this.changeNotify();
    return this;
  }
  isNaN(): boolean {
    const data = this.getArray();
    for (let i = 0; i < this.size; i++) {
      if (Number.isNaN(data[i])) {
        return true;
      }
    }
    return false;
  }
}

export interface IVector2Like {
  x: number;
  y: number;
}
export class Vector2 extends VectorBase {
  constructor(x: number, y: number);
  constructor(array: number[]);
  constructor(rhs: Vector2);
  constructor(array: Float32Array);
  constructor();
  constructor(xOrOther?: number | number[] | Vector2 | Float32Array, y?: number) {
    super(xOrOther instanceof Float32Array ? xOrOther : 2);
    if (xOrOther !== undefined && !(xOrOther instanceof Float32Array)) {
      if (typeof xOrOther === 'number') {
        this._v[0] = Number(xOrOther);
        this._v[1] = Number(y);
      } else if (xOrOther instanceof Vector2) {
        this.assign(xOrOther.getArray());
      } else {
        this.assign(xOrOther);
      }
    }
  }
  clone(): Vector2 {
    return new Vector2(this);
  }
  get x() {
    return this._v[0];
  }
  set x(v: number) {
    this.setX(v);
  }
  setX(v: number) {
    this._v[0] = v;
    this.changeNotify();
    return this;
  }
  get y() {
    return this._v[1];
  }
  set y(v: number) {
    this.setY(v);
  }
  setY(v: number) {
    this._v[1] = v;
    this.changeNotify();
    return this;
  }
  get magnitude() {
    return Vector2.magnitude(this);
  }
  set magnitude(val: number) {
    this.setMagnitude(val);
  }
  setMagnitude(val: number) {
    this.scaleBy(val / this.magnitude);
    return this;
  }
  get magnitudeSq() {
    return Vector2.magnitudeSq(this);
  }
  set(x: number, y: number) {
    this._v[0] = x;
    this._v[1] = y;
    this.changeNotify();
    return this;
  }
  setAndNormalize(x: number, y: number) {
    this._v[0] = x;
    this._v[1] = y;
    return this.inplaceNormalize();
  }
  subBy(other: IVector2Like) {
    return Vector2.sub(this, other, this);
  }
  addBy(other: IVector2Like) {
    return Vector2.add(this, other, this);
  }
  mulBy(other: IVector2Like) {
    return Vector2.mul(this, other, this);
  }
  divBy(other: IVector2Like) {
    return Vector2.div(this, other, this);
  }
  scaleBy(f: number) {
    return Vector2.scale(this, f, this);
  }
  inplaceNormalize() {
    return Vector2.normalize(this, this);
  }
  inplaceInverse() {
    return Vector2.inverse(this, this);
  }
  inplaceMin(other: IVector2Like) {
    return Vector2.min(this, other, this);
  }
  inplaceMax(other: IVector2Like) {
    return Vector2.max(this, other, this);
  }
  inplaceAbs() {
    return Vector2.abs(this, this);
  }
  static zero(): Vector2 {
    return new Vector2(0, 0);
  }
  static one(): Vector2 {
    return new Vector2(1, 1);
  }
  static axisPX(): Vector2 {
    return new Vector2(1, 0);
  }
  static axisNX(): Vector2 {
    return new Vector2(-1, 0);
  }
  static axisPY(): Vector2 {
    return new Vector2(0, 1);
  }
  static axisNY(): Vector2 {
    return new Vector2(0, -1);
  }
  static magnitudeSq(v: IVector2Like): number {
    return v.x * v.x + v.y * v.y;
  }
  static magnitude(v: IVector2Like): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }
  static distance(v1: IVector2Like, v2: IVector2Like): number {
    return Math.sqrt(this.distanceSq(v1, v2));
  }
  static distanceSq(v1: IVector2Like, v2: IVector2Like): number {
    const dx = v1.x - v2.x;
    const dy = v1.y - v2.y;
    return dx * dx + dy * dy;
  }
  static normalize(v: IVector2Like, result?: Vector2): Vector2 {
    const len = Vector2.magnitude(v);
    const x = v.x / len;
    const y = v.y / len;
    return (result || new Vector2()).set(x, y);
  }
  static inverse(v: IVector2Like, result?: Vector2): Vector2 {
    const x = 1 / v.x;
    const y = 1 / v.y;
    return (result || new Vector2()).set(x, y);
  }
  static sub(a: IVector2Like, b: IVector2Like, result?: Vector2): Vector2 {
    const x = a.x - b.x;
    const y = a.y - b.y;
    return (result || new Vector2()).set(x, y);
  }
  static add(a: IVector2Like, b: IVector2Like, result?: Vector2): Vector2 {
    const x = a.x + b.x;
    const y = a.y + b.y;
    return (result || new Vector2()).set(x, y);
  }
  static mul(a: IVector2Like, b: IVector2Like, result?: Vector2): Vector2 {
    const x = a.x * b.x;
    const y = a.y * b.y;
    return (result || new Vector2()).set(x, y);
  }
  static div(a: IVector2Like, b: IVector2Like, result?: Vector2): Vector2 {
    const x = a.x / b.x;
    const y = a.y / b.y;
    return (result || new Vector2()).set(x, y);
  }
  static scale(a: IVector2Like, b: number, result?: Vector2): Vector2 {
    const x = a.x * b;
    const y = a.y * b;
    return (result || new Vector2()).set(x, y);
  }
  static min(a: IVector2Like, b: IVector2Like, result?: Vector2): Vector2 {
    const x = a.x < b.x ? a.x : b.x;
    const y = a.y < b.y ? a.y : b.y;
    return (result || new Vector2()).set(x, y);
  }
  static max(a: IVector2Like, b: IVector2Like, result?: Vector2): Vector2 {
    const x = a.x > b.x ? a.x : b.x;
    const y = a.y > b.y ? a.y : b.y;
    return (result || new Vector2()).set(x, y);
  }
  static abs(a: IVector2Like, result?: Vector2): Vector2 {
    const x = a.x < 0 ? -a.x : a.x;
    const y = a.y < 0 ? -a.y : a.y;
    return (result || new Vector2()).set(x, y);
  }
  static dot(a: IVector2Like, b: IVector2Like): number {
    return a.x * b.x + a.y * b.y;
  }
  static cross(a: IVector2Like, b: IVector2Like): number {
    return a.x * b.y - a.y * b.x;
  }
}
export interface IVector3Like {
  x: number;
  y: number;
  z: number;
}
export class Vector3 extends VectorBase {
  constructor(x: number, y: number, z: number);
  constructor(array: number[]);
  constructor(rhs: Vector3)
  constructor(array: Float32Array)
  constructor();
  constructor(xOrOther?: number | number[] | Vector3 | Float32Array, y?: number, z?: number) {
    super(xOrOther instanceof Float32Array ? xOrOther : 3);
    if (xOrOther !== undefined && !(xOrOther instanceof Float32Array)) {
      if (typeof xOrOther === 'number') {
        this._v[0] = Number(xOrOther);
        this._v[1] = Number(y);
        this._v[2] = Number(z);
      } else if (xOrOther instanceof Vector3) {
        this.assign(xOrOther.getArray());
      } else {
        this.assign(xOrOther);
      }
    }
  }
  clone(): Vector3 {
    return new Vector3(this);
  }
  get x() {
    return this._v[0];
  }
  set x(v: number) {
    this.setX(v);
  }
  setX(v: number) {
    this._v[0] = v;
    this.changeNotify();
    return this;
  }
  get y() {
    return this._v[1];
  }
  set y(v: number) {
    this.setY(v);
  }
  setY(v: number) {
    this._v[1] = v;
    this.changeNotify();
    return this;
  }
  get z() {
    return this._v[2];
  }
  set z(v: number) {
    this.setZ(v);
  }
  setZ(v: number) {
    this._v[2] = v;
    this.changeNotify();
    return this;
  }
  get magnitude(): number {
    return Vector3.magnitude(this);
  }
  set magnitude(val: number) {
    this.setMagnitude(val);
  }
  setMagnitude(val: number) {
    return this.scaleBy(val / this.magnitude);
  }
  get magnitudeSq(): number {
    return Vector3.magnitudeSq(this);
  }
  xy(): Vector2 {
    return new Vector2(this.x, this.y);
  }
  set(x: number, y: number, z: number): Vector3 {
    this._v[0] = x;
    this._v[1] = y;
    this._v[2] = z;
    this.changeNotify();
    return this;
  }
  setAndNormalize(x: number, y: number, z: number): Vector3 {
    this._v[0] = x;
    this._v[1] = y;
    this._v[2] = z;
    return this.inplaceNormalize();
  }
  subBy(other: IVector3Like): Vector3 {
    return Vector3.sub(this, other, this);
  }
  addBy(other: IVector3Like): Vector3 {
    return Vector3.add(this, other, this);
  }
  mulBy(other: IVector3Like): Vector3 {
    return Vector3.mul(this, other, this);
  }
  divBy(other: IVector3Like): Vector3 {
    return Vector3.div(this, other, this);
  }
  scaleBy(f: number): Vector3 {
    return Vector3.scale(this, f, this);
  }
  crossBy(other: IVector3Like): Vector3 {
    return Vector3.cross(this, other, this);
  }
  inplaceNormalize() {
    return Vector3.normalize(this, this);
  }
  inplaceInverse() {
    return Vector3.inverse(this, this);
  }
  inplaceMin(other: IVector3Like) {
    return Vector3.min(this, other, this);
  }
  inplaceMax(other: IVector3Like) {
    return Vector3.max(this, other, this);
  }
  inplaceAbs() {
    return Vector3.abs(this, this);
  }
  static zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }
  static one(): Vector3 {
    return new Vector3(1, 1, 1);
  }
  static axisPX(): Vector3 {
    return new Vector3(1, 0, 0);
  }
  static axisNX(): Vector3 {
    return new Vector3(-1, 0, 0);
  }
  static axisPY(): Vector3 {
    return new Vector3(0, 1, 0);
  }
  static axisNY(): Vector3 {
    return new Vector3(0, -1, 0);
  }
  static axisPZ(): Vector3 {
    return new Vector3(0, 0, 1);
  }
  static axisNZ(): Vector3 {
    return new Vector3(0, 0, -1);
  }
  static magnitude(v: IVector3Like): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }
  static magnitudeSq(v: IVector3Like): number {
    return v.x * v.x + v.y * v.y + v.z * v.z;
  }
  static distance(v1: IVector3Like, v2: IVector3Like): number {
    return Math.sqrt(this.distanceSq(v1, v2));
  }
  static distanceSq(v1: IVector3Like, v2: IVector3Like): number {
    const dx = v1.x - v2.x;
    const dy = v1.y - v2.y;
    const dz = v1.z - v2.z;
    return dx * dx + dy * dy + dz * dz;
  }
  static normalize(v: IVector3Like, result?: Vector3): Vector3 {
    const len = Vector3.magnitude(v);
    const x = v.x / len;
    const y = v.y / len;
    const z = v.z / len;
    return (result || new Vector3()).set(x, y, z);
  }
  static inverse(v: IVector3Like, result?: Vector3): Vector3 {
    const x = 1 / v.x;
    const y = 1 / v.y;
    const z = 1 / v.z;
    return (result || new Vector3()).set(x, y, z);
  }
  static sub(a: IVector3Like, b: IVector3Like, result?: Vector3): Vector3 {
    const x = a.x - b.x;
    const y = a.y - b.y;
    const z = a.z - b.z;
    return (result || new Vector3()).set(x, y, z);
  }
  static add(a: IVector3Like, b: IVector3Like, result?: Vector3): Vector3 {
    const x = a.x + b.x;
    const y = a.y + b.y;
    const z = a.z + b.z;
    return (result || new Vector3()).set(x, y, z);
  }
  static mul(a: IVector3Like, b: IVector3Like, result?: Vector3): Vector3 {
    const x = a.x * b.x;
    const y = a.y * b.y;
    const z = a.z * b.z;
    return (result || new Vector3()).set(x, y, z);
  }
  static div(a: IVector3Like, b: IVector3Like, result?: Vector3): Vector3 {
    const x = a.x / b.x;
    const y = a.y / b.y;
    const z = a.z / b.z;
    return (result || new Vector3()).set(x, y, z);
  }
  static scale(a: IVector3Like, b: number, result?: Vector3): Vector3 {
    const x = a.x * b;
    const y = a.y * b;
    const z = a.z * b;
    return (result || new Vector3()).set(x, y, z);
  }
  static min(a: IVector3Like, b: IVector3Like, result?: Vector3): Vector3 {
    const x = a.x < b.x ? a.x : b.x;
    const y = a.y < b.y ? a.y : b.y;
    const z = a.z < b.z ? a.z : b.z;
    return (result || new Vector3()).set(x, y, z);
  }
  static max(a: IVector3Like, b: IVector3Like, result?: Vector3): Vector3 {
    const x = a.x > b.x ? a.x : b.x;
    const y = a.y > b.y ? a.y : b.y;
    const z = a.z > b.z ? a.z : b.z;
    return (result || new Vector3()).set(x, y, z);
  }
  static abs(a: IVector3Like, result?: Vector3): Vector3 {
    const x = a.x < 0 ? -a.x : a.x;
    const y = a.y < 0 ? -a.y : a.y;
    const z = a.z < 0 ? -a.z : a.z;
    return (result || new Vector3()).set(x, y, z);
  }
  static dot(a: IVector3Like, b: IVector3Like): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }
  static cross(a: IVector3Like, b: IVector3Like, result?: Vector3): Vector3 {
    const x = a.y * b.z - a.z * b.y;
    const y = a.z * b.x - a.x * b.z;
    const z = a.x * b.y - a.y * b.x;
    return (result || new Vector3()).set(x, y, z);
  }
}
export interface IVector4Like {
  x: number;
  y: number;
  z: number;
  w: number;
}
export class Vector4 extends VectorBase {
  constructor(x: number, y: number, z: number, w: number);
  constructor(array: number[]);
  constructor(array: Float32Array);
  constructor(rhs: Vector4);
  constructor(v3: Vector3, w: number);
  constructor();
  constructor(xOrOther?: number | number[] | Vector3 | Vector4 | Float32Array, y?: number, z?: number, w?: number) {
    super(xOrOther instanceof Float32Array ? xOrOther : 4);
    if (xOrOther !== undefined && !(xOrOther instanceof Float32Array)) {
      if (typeof xOrOther === 'number') {
        this._v[0] = Number(xOrOther);
        this._v[1] = Number(y);
        this._v[2] = Number(z);
        this._v[3] = Number(w);
      } else if (xOrOther instanceof Vector3) {
        this._v[0] = Number(xOrOther.x);
        this._v[1] = Number(xOrOther.y);
        this._v[2] = Number(xOrOther.z);
        this._v[3] = Number(y);
      } else if (xOrOther instanceof Vector4) {
        this.assign(xOrOther.getArray());
      } else {
        this.assign(xOrOther);
      }
    }
  }
  clone(): Vector4 {
    return new Vector4(this);
  }
  get x() {
    return this._v[0];
  }
  set x(v: number) {
    this.setX(v);
  }
  setX(v: number) {
    this._v[0] = v;
    this.changeNotify();
    return this;
  }
  get y() {
    return this._v[1];
  }
  set y(v: number) {
    this.setY(v);
  }
  setY(v: number) {
    this._v[1] = v;
    this.changeNotify();
    return this;
  }
  get z() {
    return this._v[2];
  }
  set z(v: number) {
    this.setZ(v);
  }
  setZ(v: number) {
    this._v[2] = v;
    this.changeNotify();
    return this;
  }
  get w() {
    return this._v[3];
  }
  set w(v: number) {
    this.setW(v);
  }
  setW(v: number) {
    this._v[3] = v;
    this.changeNotify();
    return this;
  }
  get magnitude(): number {
    return Vector4.magnitude(this);
  }
  set magnitude(val: number) {
    this.setMagnitude(val);
  }
  setMagnitude(val: number) {
    return this.scaleBy(val / this.magnitude);
  }
  get magnitudeSq(): number {
    return Vector4.magnitudeSq(this);
  }
  xy(): Vector2 {
    return new Vector2(this.x, this.y);
  }
  xyz(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }
  set(x: number, y: number, z: number, w: number): Vector4 {
    this._v[0] = x;
    this._v[1] = y;
    this._v[2] = z;
    this._v[3] = w;
    this.changeNotify();
    return this;
  }
  setAndNormalize(x: number, y: number, z: number, w: number): Vector4 {
    this._v[0] = x;
    this._v[1] = y;
    this._v[2] = z;
    this._v[3] = w;
    return this.inplaceNormalize();
  }
  subBy(other: IVector4Like): Vector4 {
    return Vector4.sub(this, other, this);
  }
  addBy(other: IVector4Like): Vector4 {
    return Vector4.add(this, other, this);
  }
  mulBy(other: IVector4Like): Vector4 {
    return Vector4.mul(this, other, this);
  }
  divBy(other: IVector4Like): Vector4 {
    return Vector4.div(this, other, this);
  }
  scaleBy(f: number): Vector4 {
    return Vector4.scale(this, f, this);
  }
  inplaceNormalize(): Vector4 {
    return Vector4.normalize(this, this);
  }
  inplaceInverse(): Vector4 {
    return Vector4.inverse(this, this);
  }
  inplaceMin(other: IVector4Like) {
    return Vector4.min(this, other, this);
  }
  inplaceMax(other: IVector4Like) {
    return Vector4.max(this, other, this);
  }
  inplaceAbs() {
    return Vector4.abs(this, this);
  }
  static zero(): Vector4 {
    return new Vector4(0, 0, 0, 0);
  }
  static one(): Vector4 {
    return new Vector4(1, 1, 1, 1);
  }
  static axisPX(): Vector4 {
    return new Vector4(1, 0, 0, 0);
  }
  static axisNX(): Vector4 {
    return new Vector4(-1, 0, 0, 0);
  }
  static axisPY(): Vector4 {
    return new Vector4(0, 1, 0, 0);
  }
  static axisNY(): Vector4 {
    return new Vector4(0, -1, 0, 0);
  }
  static axisPZ(): Vector4 {
    return new Vector4(0, 0, 1, 0);
  }
  static axisNZ(): Vector4 {
    return new Vector4(0, 0, -1, 0);
  }
  static axisPW(): Vector4 {
    return new Vector4(0, 0, 0, 1);
  }
  static axisNW(): Vector4 {
    return new Vector4(0, 0, 0, -1);
  }
  static magnitude(v: IVector4Like): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z + v.w * v.w);
  }
  static magnitudeSq(v: IVector4Like): number {
    return v.x * v.x + v.y * v.y + v.z * v.z + v.w * v.w;
  }
  static normalize(v: IVector4Like, result?: Vector4): Vector4 {
    const len = Vector4.magnitude(v);
    const x = v.x / len;
    const y = v.y / len;
    const z = v.z / len;
    const w = v.w / len;
    return (result || new Vector4()).set(x, y, z, w);
  }
  static inverse(v: IVector4Like, result?: Vector4): Vector4 {
    const x = 1 / v.x;
    const y = 1 / v.y;
    const z = 1 / v.z;
    const w = 1 / v.w;
    return (result || new Vector4()).set(x, y, z, w);
  }
  static sub(a: IVector4Like, b: IVector4Like, result?: Vector4): Vector4 {
    const x = a.x - b.x;
    const y = a.y - b.y;
    const z = a.z - b.z;
    const w = a.w - b.w;
    return (result || new Vector4()).set(x, y, z, w);
  }
  static add(a: IVector4Like, b: IVector4Like, result?: Vector4): Vector4 {
    const x = a.x + b.x;
    const y = a.y + b.y;
    const z = a.z + b.z;
    const w = a.w + b.w;
    return (result || new Vector4()).set(x, y, z, w);
  }
  static mul(a: IVector4Like, b: IVector4Like, result?: Vector4): Vector4 {
    const x = a.x * b.x;
    const y = a.y * b.y;
    const z = a.z * b.z;
    const w = a.w * b.w;
    return (result || new Vector4()).set(x, y, z, w);
  }
  static div(a: IVector4Like, b: IVector4Like, result?: Vector4): Vector4 {
    const x = a.x / b.x;
    const y = a.y / b.y;
    const z = a.z / b.z;
    const w = a.w / b.w;
    return (result || new Vector4()).set(x, y, z, w);
  }
  static scale(a: IVector4Like, b: number, result?: Vector4): Vector4 {
    const x = a.x * b;
    const y = a.y * b;
    const z = a.z * b;
    const w = a.w * b;
    return (result || new Vector4()).set(x, y, z, w);
  }
  static min(a: IVector4Like, b: IVector4Like, result?: Vector4): Vector4 {
    const x = a.x < b.x ? a.x : b.x;
    const y = a.y < b.y ? a.y : b.y;
    const z = a.z < b.z ? a.z : b.z;
    const w = a.w < b.w ? a.w : b.w;
    return (result || new Vector4()).set(x, y, z, w);
  }
  static max(a: IVector4Like, b: IVector4Like, result?: Vector4): Vector4 {
    const x = a.x > b.x ? a.x : b.x;
    const y = a.y > b.y ? a.y : b.y;
    const z = a.z > b.z ? a.z : b.z;
    const w = a.w > b.w ? a.w : b.w;
    return (result || new Vector4()).set(x, y, z, w);
  }
  static abs(a: IVector4Like, result?: Vector4): Vector4 {
    const x = a.x < 0 ? -a.x : a.x;
    const y = a.y < 0 ? -a.y : a.y;
    const z = a.z < 0 ? -a.z : a.z;
    const w = a.w < 0 ? -a.w : a.w;
    return (result || new Vector4()).set(x, y, z, w);
  }
  static dot(a: IVector4Like, b: IVector4Like): number {
    return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  }
}
export class Quaternion extends VectorBase {
  constructor(x: number, y: number, z: number, w: number);
  constructor(array: number[]);
  constructor(array: Float32Array);
  constructor(rhs: Quaternion);
  constructor(matrix: Matrix3x3);
  constructor(matrix: Matrix4x4);
  constructor();
  constructor(xOrOther?: number | number[] | Quaternion | Matrix3x3 | Matrix4x4 | Float32Array, y?: number, z?: number, w?: number) {
    super(xOrOther instanceof Float32Array ? xOrOther : 4);
    if (xOrOther !== undefined && !(xOrOther instanceof Float32Array)) {
      if (xOrOther instanceof Matrix3x3 || xOrOther instanceof Matrix4x4) {
        this.fromRotationMatrix(xOrOther);
      } else if (xOrOther instanceof Quaternion) {
        this.assign(xOrOther.getArray());
      } else if (typeof xOrOther === 'number') {
        this._v[0] = Number(xOrOther);
        this._v[1] = Number(y);
        this._v[2] = Number(z);
        this._v[3] = Number(w);
      } else {
        this.assign(xOrOther);
      }
    }
  }
  clone(): Quaternion {
    return new Quaternion(this);
  }
  get x() {
    return this._v[0];
  }
  set x(v: number) {
    this.setX(v);
  }
  setX(v: number) {
    this._v[0] = v;
    this.changeNotify();
    return this;
  }
  get y() {
    return this._v[1];
  }
  set y(v: number) {
    this.setY(v);
  }
  setY(v: number) {
    this._v[1] = v;
    this.changeNotify();
    return this;
  }
  get z() {
    return this._v[2];
  }
  set z(v: number) {
    this.setZ(v);
  }
  setZ(v: number) {
    this._v[2] = v;
    this.changeNotify();
    return this;
  }
  get w() {
    return this._v[3];
  }
  set w(v: number) {
    this.setW(v);
  }
  setW(v: number) {
    this._v[3] = v;
    this.changeNotify();
    return this;
  }
  set(x: number, y: number, z: number, w: number): Quaternion {
    this._v[0] = x;
    this._v[1] = y;
    this._v[2] = z;
    this._v[3] = w;
    this.changeNotify();
    return this;
  }
  scaleBy(f: number): Quaternion {
    return Quaternion.scale(this, f, this);
  }
  setAndNormalize(x: number, y: number, z: number, w: number): Quaternion {
    this._v[0] = x;
    this._v[1] = y;
    this._v[2] = z;
    this._v[3] = w;
    return this.inplaceNormalize();
  }
  get magnitude(): number {
    return Quaternion.magnitude(this);
  }
  get magnitudeSq(): number {
    return Quaternion.magnitudeSq(this);
  }
  identity(): Quaternion {
    return Quaternion.identity(this);
  }
  inplaceNormalize(): Quaternion {
    return Quaternion.normalize(this, this);
  }
  inplaceConjugate(): Quaternion {
    return Quaternion.conjugate(this, this);
  }
  multiplyRight(other: IVector4Like) {
    return Quaternion.multiply(this, other, this);
  }
  multiplyLeft(other: IVector4Like) {
    return Quaternion.multiply(other, this, this);
  }
  slerpRight(other: IVector4Like, t: number) {
    return Quaternion.slerp(this, other, t, this);
  }
  slerpLeft(other: IVector4Like, t: number) {
    return Quaternion.slerp(other, this, t, this);
  }
  unitVectorToUnitVector(from: IVector3Like, to: IVector3Like) {
    return Quaternion.unitVectorToUnitVector(from, to, this);
  }
  fromEulerAngle(
    a: number,
    b: number,
    c: number,
    order: 'XYZ' | 'YXZ' | 'ZXY' | 'ZYX' | 'YZX' | 'XZY',
  ) {
    return Quaternion.fromEulerAngle(a, b, c, order, this);
  }
  fromAxisAngle(axis: IVector3Like, angle: number) {
    return Quaternion.fromAxisAngle(axis, angle, this);
  }
  fromRotationMatrix(matrix: Matrix3x3 | Matrix4x4) {
    return Quaternion.fromRotationMatrix(matrix, this);
  }
  toMatrix3x3(matrix?: Matrix3x3): Matrix3x3 {
    const m = matrix || new Matrix3x3();
    this.toMatrix(m);
    return m;
  }
  toMatrix4x4(matrix?: Matrix4x4): Matrix4x4 {
    const m = matrix || Matrix4x4.identity();
    this.toMatrix(m);
    return m;
  }
  toMatrix(matrix: Matrix3x3 | Matrix4x4) {
    const xx = this.x * this.x;
    const yy = this.y * this.y;
    const zz = this.z * this.z;
    const xy = this.x * this.y;
    const zw = this.z * this.w;
    const zx = this.z * this.x;
    const yw = this.y * this.w;
    const yz = this.y * this.z;
    const xw = this.x * this.w;
    matrix.m00 = 1 - 2 * (yy + zz);
    matrix.m10 = 2 * (xy + zw);
    matrix.m20 = 2 * (zx - yw);
    matrix.m01 = 2 * (xy - zw);
    matrix.m11 = 1 - 2 * (zz + xx);
    matrix.m21 = 2 * (yz + xw);
    matrix.m02 = 2 * (zx + yw);
    matrix.m12 = 2 * (yz - xw);
    matrix.m22 = 1 - 2 * (yy + xx);
  }
  getAxisAngle(): Vector4 {
    const sign = this.w < 0 ? -1 : 1;
    const x = this.x * sign;
    const y = this.y * sign;
    const z = this.z * sign;
    const w = this.w * sign;
    const halfAngle = Math.acos(w);
    const sinHalf = Math.sin(halfAngle);
    return new Vector4(x / sinHalf, y / sinHalf, z / sinHalf, 2 * halfAngle);
  }
  transform(v: IVector3Like, result?: Vector3): Vector3 {
    result = result || new Vector3();
    const x = this.x * 2;
    const y = this.y * 2;
    const z = this.z * 2;
    const xx = this.x * x;
    const yy = this.y * y;
    const zz = this.z * z;
    const xy = this.x * y;
    const xz = this.x * z;
    const yz = this.y * z;
    const wx = this.w * x;
    const wy = this.w * y;
    const wz = this.w * z;
    return result.set(
      (1 - yy - zz) * v.x + (xy - wz) * v.y + (xz + wy) * v.z,
      (xy + wz) * v.x + (1 - xx - zz) * v.y + (yz - wx) * v.z,
      (xz - wy) * v.x + (yz + wx) * v.y + (1 - xx - yy) * v.z,
    );
  }
  addBy(other: Quaternion): Quaternion {
    return Quaternion.add(this, other, this);
  }
  static magnitude(q: IVector4Like): number {
    return Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  }
  static magnitudeSq(q: IVector4Like): number {
    return q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w;
  }
  static add(q: Quaternion, other: Quaternion, result?: Quaternion): Quaternion {
    result = result || q;
    result.x = q.x + other.x;
    result.y = q.y + other.y;
    result.z = q.z + other.z;
    result.w = q.w + other.w;
    return result;
  }
  static scale(q: Quaternion, t: number, result?: Quaternion): Quaternion {
    result = result || q;
    result.x = q.x * t;
    result.y = q.y * t;
    result.z = q.z * t;
    result.w = q.w * t;
    return result;
  }
  static dot(a: IVector4Like, b: IVector4Like): number {
    return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  }
  static identity(q?: Quaternion): Quaternion {
    return (q || new Quaternion()).set(0, 0, 0, 1);
  }
  static normalize(q: IVector4Like, result?: Quaternion): Quaternion {
    const mag = Quaternion.magnitude(q);
    return (result || new Quaternion()).set(q.x / mag, q.y / mag, q.z / mag, q.w / mag);
  }
  static conjugate(q: IVector4Like, result?: Quaternion): Quaternion {
    return (result || new Quaternion()).set(-q.x, -q.y, -q.z, q.w);
  }
  static multiply(a: IVector4Like, b: IVector4Like, result?: Quaternion): Quaternion {
    result = result || new Quaternion();
    const x = a.x * b.w + a.w * b.x + a.y * b.z - a.z * b.y;
    const y = a.y * b.w + a.w * b.y + a.z * b.x - a.x * b.z;
    const z = a.z * b.w + a.w * b.z + a.x * b.y - a.y * b.x;
    const w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
    return result.set(x, y, z, w);
  }
  static slerp(a: IVector4Like, b: IVector4Like, t: number, result?: Quaternion): Quaternion {
    result = result || new Quaternion();
    if (t <= 0) {
      return result.set(a.x, a.y, a.z, a.w);
    }
    if (t >= 1) {
      return result.set(b.x, b.y, b.z, b.w);
    }
    const halfCos1 = this.dot(a, b);
    const inv = halfCos1 < 0 ? -1 : 1;
    const ax = a.x;
    const ay = a.y;
    const az = a.z;
    const aw = a.w;
    const bx = b.x * inv;
    const by = b.y * inv;
    const bz = b.z * inv;
    const bw = b.w * inv;
    const halfCos = halfCos1 * inv;
    if (halfCos >= 1) {
      return result.set(ax, ay, az, aw);
    }
    const halfSinSqr = 1 - halfCos * halfCos;
    if (halfSinSqr <= Number.EPSILON) {
      const s = 1 - t;
      return result.setAndNormalize(
        a.x * s + b.x * t,
        a.y * s + b.y * t,
        a.z * s + b.z * t,
        a.w * s + b.w * t,
      );
    }
    const halfSin = Math.sqrt(halfSinSqr);
    const halfTheta = Math.atan2(halfSin, halfCos);
    const ratioA = Math.sin((1 - t) * halfTheta) / halfSin;
    const ratioB = Math.sin(t * halfTheta) / halfSin;
    return result.set(
      ax * ratioA + bx * ratioB,
      ay * ratioA + by * ratioB,
      az * ratioA + bz * ratioB,
      aw * ratioA + bw * ratioB,
    );
  }
  static angleBetween(a: IVector4Like, b: IVector4Like): number {
    return 2 * Math.acos(Math.abs(numberClamp(this.dot(a, b), -1, 1)));
  }
  static unitVectorToUnitVector(
    from: IVector3Like,
    to: IVector3Like,
    result?: Quaternion,
  ): Quaternion {
    // assume from and to are unit vectors
    result = result || new Quaternion();
    let r = Vector3.dot(from, to) + 1;
    if (r < 0.000001) {
      r = 0;
      if (Math.abs(from.x) > Math.abs(from.z)) {
        return result.setAndNormalize(-from.y, from.x, 0, r);
      } else {
        return result.setAndNormalize(0, -from.z, from.y, r);
      }
    } else {
      return result.setAndNormalize(
        from.y * to.z - from.z * to.y,
        from.z * to.x - from.x * to.z,
        from.x * to.y - from.y * to.x,
        r,
      );
    }
  }
  static fromEulerAngle(
    a: number,
    b: number,
    c: number,
    order: 'XYZ' | 'YXZ' | 'ZXY' | 'ZYX' | 'YZX' | 'XZY',
    result?: Quaternion,
  ): Quaternion {
    result = result || new Quaternion();
    const c1 = Math.cos(a / 2);
    const c2 = Math.cos(b / 2);
    const c3 = Math.cos(c / 2);
    const s1 = Math.sin(a / 2);
    const s2 = Math.sin(b / 2);
    const s3 = Math.sin(c / 2);
    switch (order) {
      case 'XYZ':
        return result.set(
          s1 * c2 * c3 + c1 * s2 * s3,
          c1 * s2 * c3 - s1 * c2 * s3,
          c1 * c2 * s3 + s1 * s2 * c3,
          c1 * c2 * c3 - s1 * s2 * s3,
        );
      case 'YXZ':
        return result.set(
          s1 * c2 * c3 + c1 * s2 * s3,
          c1 * s2 * c3 - s1 * c2 * s3,
          c1 * c2 * s3 - s1 * s2 * c3,
          c1 * c2 * c3 + s1 * s2 * s3,
        );
      case 'ZXY':
        return result.set(
          s1 * c2 * c3 - c1 * s2 * s3,
          c1 * s2 * c3 + s1 * c2 * s3,
          c1 * c2 * s3 + s1 * s2 * c3,
          c1 * c2 * c3 - s1 * s2 * s3,
        );
      case 'ZYX':
        return result.set(
          s1 * c2 * c3 - c1 * s2 * s3,
          c1 * s2 * c3 + s1 * c2 * s3,
          c1 * c2 * s3 - s1 * s2 * c3,
          c1 * c2 * c3 + s1 * s2 * s3,
        );
      case 'YZX':
        return result.set(
          s1 * c2 * c3 + c1 * s2 * s3,
          c1 * s2 * c3 + s1 * c2 * s3,
          c1 * c2 * s3 - s1 * s2 * c3,
          c1 * c2 * c3 - s1 * s2 * s3,
        );
      case 'XZY':
        return result.set(
          s1 * c2 * c3 - c1 * s2 * s3,
          c1 * s2 * c3 - s1 * c2 * s3,
          c1 * c2 * s3 + s1 * s2 * c3,
          c1 * c2 * c3 + s1 * s2 * s3,
        );
    }
  }
  static fromAxisAngle(axis: IVector3Like, angle: number, result?: Quaternion): Quaternion {
    // assume axis is normalized
    result = result || new Quaternion();
    const halfAngle = angle / 2;
    const s = Math.sin(halfAngle);
    return result.set(axis.x * s, axis.y * s, axis.z * s, Math.cos(halfAngle));
  }
  static fromRotationMatrix(matrix: Matrix3x3 | Matrix4x4, result?: Quaternion): Quaternion {
    // assume matrix contains rotation without scaling
    result = result || new Quaternion();
    const trace = matrix.m00 + matrix.m11 + matrix.m22;
    let s;
    if (trace > 0) {
      s = 0.5 / Math.sqrt(trace + 1);
      result.set(
        (matrix.m21 - matrix.m12) * s,
        (matrix.m02 - matrix.m20) * s,
        (matrix.m10 - matrix.m01) * s,
        0.25 / s,
      );
    } else if (matrix.m00 > matrix.m11 && matrix.m00 > matrix.m22) {
      s = 2 * Math.sqrt(1 + matrix.m00 - matrix.m11 - matrix.m22);
      result.set(
        0.25 * s,
        (matrix.m01 + matrix.m10) / s,
        (matrix.m02 + matrix.m20) / s,
        (matrix.m21 - matrix.m12) / s,
      );
    } else if (matrix.m11 > matrix.m22) {
      s = 2 * Math.sqrt(1 - matrix.m00 + matrix.m11 - matrix.m22);
      result.set(
        (matrix.m10 + matrix.m01) / s,
        0.25 * s,
        (matrix.m21 + matrix.m12) / s,
        (matrix.m02 - matrix.m20) / s,
      );
    } else {
      s = 2 * Math.sqrt(1 - matrix.m00 - matrix.m11 + matrix.m22);
      result.set(
        (matrix.m02 + matrix.m20) / s,
        (matrix.m12 + matrix.m21) / s,
        0.25 * s,
        (matrix.m10 - matrix.m01) / s,
      );
    }
    return result;
  }
}
export class Matrix3x3 extends VectorBase {
  constructor();
  constructor(q: Quaternion);
  constructor(rhs: Matrix3x3);
  constructor(m4: Matrix4x4);
  constructor(array: number[]);
  constructor(array: Float32Array);
  constructor(quatOrArray?: Quaternion | Matrix3x3 | Matrix4x4 | number[] | Float32Array) {
    super(quatOrArray instanceof Float32Array ? quatOrArray : 9);
    if (quatOrArray !== undefined && !(quatOrArray instanceof Float32Array)) {
      if (quatOrArray instanceof Quaternion) {
        quatOrArray.toMatrix(this);
      } else if (quatOrArray instanceof Matrix3x3) {
        this.assign(quatOrArray.getArray());
      } else if (quatOrArray instanceof Matrix4x4) {
        const data = quatOrArray.getArray();
        this._v[0] = data[0];
        this._v[1] = data[1];
        this._v[2] = data[2];
        this._v[3] = data[4];
        this._v[4] = data[5];
        this._v[5] = data[6];
        this._v[6] = data[8];
        this._v[7] = data[9];
        this._v[8] = data[10];
      } else {
        this.assign(quatOrArray);
      }
    }
  }
  clone(): Matrix3x3 {
    return new Matrix3x3(this);
  }
  get m00() {
    return this._v[0];
  }
  set m00(v: number) {
    this._v[0] = v;
    this.changeNotify();
  }
  get m10() {
    return this._v[1];
  }
  set m10(v: number) {
    this._v[1] = v;
    this.changeNotify();
  }
  get m20() {
    return this._v[2];
  }
  set m20(v: number) {
    this._v[2] = v;
    this.changeNotify();
  }
  get m01() {
    return this._v[3];
  }
  set m01(v: number) {
    this._v[3] = v;
    this.changeNotify();
  }
  get m11() {
    return this._v[4];
  }
  set m11(v: number) {
    this._v[4] = v;
    this.changeNotify();
  }
  get m21() {
    return this._v[5];
  }
  set m21(v: number) {
    this._v[5] = v;
    this.changeNotify();
  }
  get m02() {
    return this._v[6];
  }
  set m02(v: number) {
    this._v[6] = v;
    this.changeNotify();
  }
  get m12() {
    return this._v[7];
  }
  set m12(v: number) {
    this._v[7] = v;
    this.changeNotify();
  }
  get m22() {
    return this._v[8];
  }
  set m22(v: number) {
    this._v[8] = v;
    this.changeNotify();
  }
  getRow(row: number, result?: Vector3): Vector3 {
    return (result || new Vector3()).set(
      this._v[row * 3],
      this._v[row * 3 + 1],
      this._v[row * 3 + 2],
    );
  }
  setRow(row: number, v: IVector3Like) {
    this._v[row * 3] = v.x;
    this._v[row * 3 + 1] = v.y;
    this._v[row * 3 + 2] = v.z;
    this.changeNotify();
    return this;
  }
  getCol(col: number, result?: Vector3): Vector3 {
    return (result || new Vector3()).set(this._v[col], this._v[3 + col], this._v[6 + col]);
  }
  setCol(col: number, v: IVector3Like) {
    this._v[col] = v.x;
    this._v[3 + col] = v.y;
    this._v[6 + col] = v.z;
    this.changeNotify();
    return this;
  }
  static add(a: Matrix3x3, b: Matrix3x3, result?: Matrix3x3) {
    result = result || new Matrix3x3();
    const v1 = a.getArray();
    const v2 = b.getArray();
    const v = result.getArray();
    for (let i = 0; i < 9; i++) {
      v[i] = v1[i] + v2[i];
    }
    result.changeNotify();
    return result;
  }
  static sub(a: Matrix3x3, b: Matrix3x3, result?: Matrix3x3) {
    result = result || new Matrix3x3();
    const v1 = a.getArray();
    const v2 = b.getArray();
    const v = result.getArray();
    for (let i = 0; i < 9; i++) {
      v[i] = v1[i] - v2[i];
    }
    result.changeNotify();
    return result;
  }
  static mul(a: Matrix3x3, b: Matrix3x3, result?: Matrix3x3) {
    result = result || new Matrix3x3();
    const v1 = a.getArray();
    const v2 = b.getArray();
    const v = result.getArray();
    for (let i = 0; i < 9; i++) {
      v[i] = v1[i] * v2[i];
    }
    result.changeNotify();
    return result;
  }
  static div(a: Matrix3x3, b: Matrix3x3, result?: Matrix3x3) {
    result = result || new Matrix3x3();
    const v1 = a.getArray();
    const v2 = b.getArray();
    const v = result.getArray();
    for (let i = 0; i < 9; i++) {
      v[i] = v1[i] / v2[i];
    }
    result.changeNotify();
    return result;
  }
  static scale(a: Matrix3x3, f: number, result?: Matrix3x3) {
    result = result || new Matrix3x3();
    const v1 = a.getArray();
    const v = result.getArray();
    for (let i = 0; i < 9; i++) {
      v[i] = v1[i] * f;
    }
    result.changeNotify();
    return result;
  }
  static identity(result?: Matrix3x3): Matrix3x3 {
    result = result || new Matrix3x3();
    const v = result.getArray();
    v[0] = 1;
    v[1] = 0;
    v[2] = 0;
    v[3] = 0;
    v[4] = 1;
    v[5] = 0;
    v[6] = 0;
    v[7] = 0;
    v[8] = 1;
    result.changeNotify();
    return result;
  }
  static transpose(matrix: Matrix3x3, result?: Matrix3x3): Matrix3x3 {
    result = result || new Matrix3x3();
    const v = matrix.getArray();
    const d = result.getArray();
    if (v === d) {
      let t: number;
      t = d[1];
      d[1] = d[3];
      d[3] = t;
      t = d[2];
      d[2] = d[6];
      d[6] = t;
      t = d[5];
      d[5] = d[7];
      d[7] = t;
    } else {
      d[0] = v[0];
      d[1] = v[3];
      d[2] = v[6];
      d[3] = v[1];
      d[4] = v[4];
      d[5] = v[7];
      d[6] = v[2];
      d[7] = v[5];
      d[8] = v[8];
    }
    result.changeNotify();
    return result;
  }
  static inverse(matrix: Matrix3x3, result?: Matrix3x3): Matrix3x3 {
    result = result || new Matrix3x3();
    const v = matrix.getArray();
    const t = result.getArray();
    const m00 = v[0];
    const m01 = v[1];
    const m02 = v[2];
    const m10 = v[3];
    const m11 = v[4];
    const m12 = v[5];
    const m20 = v[6];
    const m21 = v[7];
    const m22 = v[8];
    const tmp_0 = m22 * m11 - m12 * m21;
    const tmp_1 = m12 * m20 - m22 * m10;
    const tmp_2 = m21 * m10 - m20 * m11;
    const d = 1 / (m00 * tmp_0 + m01 * tmp_1 + m02 * tmp_2);
    t[0] = tmp_0 * d;
    t[1] = (m02 * m21 - m22 * m01) * d;
    t[2] = (m12 * m01 - m02 * m11) * d;
    t[3] = tmp_1 * d;
    t[4] = (m22 * m00 - m02 * m20) * d;
    t[5] = (m02 * m10 - m12 * m00) * d;
    t[6] = tmp_2 * d;
    t[7] = (m01 * m20 - m21 * m00) * d;
    t[8] = (m11 * m00 - m01 * m10) * d;
    result.changeNotify();
    return result;
  }
  static inverseAffine(matrix: Matrix3x3, result?: Matrix3x3): Matrix3x3 {
    // TODO optimize?
    return this.inverse(matrix, result);
  }
  static scaling(s: IVector3Like, result?: Matrix3x3): Matrix3x3 {
    result = result || new Matrix3x3();
    const v = result.getArray();
    v[0] = s.x;
    v[1] = 0;
    v[2] = 0;
    v[3] = 0;
    v[4] = s.y;
    v[5] = 0;
    v[6] = 0;
    v[7] = 0;
    v[8] = s.z;
    result.changeNotify();
    return result;
  }
  static rotationX(angle: number, result?: Matrix3x3): Matrix3x3 {
    result = result || new Matrix3x3();
    const v = result.getArray();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    v[0] = 1;
    v[1] = 0;
    v[2] = 0;
    v[3] = 0;
    v[4] = c;
    v[5] = s;
    v[6] = 0;
    v[7] = -s;
    v[8] = c;
    result.changeNotify();
    return result;
  }
  static rotationY(angle: number, result?: Matrix3x3): Matrix3x3 {
    result = result || new Matrix3x3();
    const v = result.getArray();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    v[0] = c;
    v[1] = 0;
    v[2] = -s;
    v[3] = 0;
    v[4] = 1;
    v[5] = 0;
    v[6] = s;
    v[7] = 0;
    v[8] = c;
    result.changeNotify();
    return result;
  }
  static rotationZ(angle: number, result?: Matrix3x3): Matrix3x3 {
    result = result || new Matrix3x3();
    const v = result.getArray();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    v[0] = c;
    v[1] = s;
    v[2] = 0;
    v[3] = -s;
    v[4] = c;
    v[5] = 0;
    v[6] = 0;
    v[7] = 0;
    v[8] = 1;
    result.changeNotify();
    return result;
  }
  static rotation(axis: IVector3Like, angle: number, result?: Matrix3x3): Matrix3x3 {
    result = result || new Matrix3x3();
    const v = result.getArray();
    let x = axis.x;
    let y = axis.y;
    let z = axis.z;
    const n = Math.sqrt(x * x + y * y + z * z);
    x /= n;
    y /= n;
    z /= n;
    const xx = x * x;
    const yy = y * y;
    const zz = z * z;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const oneMinusCosine = 1 - c;
    v[0] = xx + (1 - xx) * c;
    v[1] = x * y * oneMinusCosine + z * s;
    v[2] = x * z * oneMinusCosine - y * s;
    v[3] = x * y * oneMinusCosine - z * s;
    v[4] = yy + (1 - yy) * c;
    v[5] = y * z * oneMinusCosine + x * s;
    v[6] = x * z * oneMinusCosine + y * s;
    v[7] = y * z * oneMinusCosine - x * s;
    v[8] = zz + (1 - zz) * c;
    result.changeNotify();
    return result;
  }
  static multiply(m1: Matrix3x3, m2: Matrix3x3, result?: Matrix3x3): Matrix3x3 {
    result = result || new Matrix3x3();
    const v = result.getArray();
    const a = m1.getArray();
    const b = m2.getArray();
    const a00 = a[0];
    const a01 = a[1];
    const a02 = a[2];
    const a10 = a[3];
    const a11 = a[4];
    const a12 = a[5];
    const a20 = a[6];
    const a21 = a[7];
    const a22 = a[8];
    const b00 = b[0];
    const b01 = b[1];
    const b02 = b[2];
    const b10 = b[3];
    const b11 = b[4];
    const b12 = b[5];
    const b20 = b[6];
    const b21 = b[7];
    const b22 = b[8];

    v[0] = a00 * b00 + a10 * b01 + a20 * b02;
    v[1] = a01 * b00 + a11 * b01 + a21 * b02;
    v[2] = a02 * b00 + a12 * b01 + a22 * b02;
    v[3] = a00 * b10 + a10 * b11 + a20 * b12;
    v[4] = a01 * b10 + a11 * b11 + a21 * b12;
    v[5] = a02 * b10 + a12 * b11 + a22 * b12;
    v[6] = a00 * b20 + a10 * b21 + a20 * b22;
    v[7] = a01 * b20 + a11 * b21 + a21 * b22;
    v[8] = a02 * b20 + a12 * b21 + a22 * b22;

    result.changeNotify();
    return result;
  }
  static multiplyAffine(m1: Matrix3x3, m2: Matrix3x3, result?: Matrix3x3): Matrix3x3 {
    return this.multiply(m1, m2, result);
  }
  subBy(other: Matrix3x3) {
    return Matrix3x3.sub(this, other, this);
  }
  addBy(other: Matrix3x3) {
    return Matrix3x3.add(this, other, this);
  }
  mulBy(other: Matrix3x3) {
    return Matrix3x3.mul(this, other, this);
  }
  divBy(other: Matrix3x3) {
    return Matrix3x3.div(this, other, this);
  }
  scaleBy(f: number) {
    return Matrix3x3.scale(this, f, this);
  }
  identity() {
    return Matrix3x3.identity(this);
  }
  scaling(s: IVector3Like) {
    return Matrix3x3.scaling(s, this);
  }
  inplaceInverse() {
    return Matrix3x3.inverse(this, this);
  }
  inplaceInverseAffine() {
    return Matrix3x3.inverseAffine(this, this);
  }
  transpose() {
    return Matrix3x3.transpose(this, this);
  }
  multiplyRight(other: Matrix3x3) {
    return Matrix3x3.multiply(this, other, this);
  }
  multiplyRightAffine(other: Matrix3x3) {
    return Matrix3x3.multiplyAffine(this, other, this);
  }
  multiplyLeft(other: Matrix3x3) {
    return Matrix3x3.multiply(other, this, this);
  }
  multiplyLeftAffine(other: Matrix3x3) {
    return Matrix3x3.multiplyAffine(other, this, this);
  }
  rotationX(angle: number) {
    return Matrix3x3.rotationX(angle, this);
  }
  rotationY(angle: number) {
    return Matrix3x3.rotationY(angle, this);
  }
  rotationZ(angle: number) {
    return Matrix3x3.rotationZ(angle, this);
  }
  rotation(axis: IVector3Like, angle: number) {
    return Matrix3x3.rotation(axis, angle, this);
  }
  transform(point: IVector3Like, result?: Vector3): Vector3 {
    result = result || new Vector3();
    const v = this.getArray();
    const px = point.x,
      py = point.y,
      pz = point.z;
    return result.set(
      v[0] * px + v[3] * py + v[6] * pz,
      v[1] * px + v[4] * py + v[7] * pz,
      v[2] * px + v[5] * py + v[8] * pz,
    );
  }
  transformPoint(vec: IVector3Like, result?: Vector3): Vector3 {
    return this.transform(vec, result);
  }
  transformPointAffine(point: IVector3Like, result?: Vector3): Vector3 {
    return this.transform(point, result);
  }
  transformVector(vec: IVector3Like, result?: Vector3): Vector3 {
    return this.transform(vec, result);
  }
  transformVectorAffine(vec: IVector3Like, result?: Vector3): Vector3 {
    return this.transform(vec, result);
  }
  transformAffine(vec: IVector4Like, result?: Vector3): Vector3 {
    return this.transform(vec, result);
  }
  testRotationPart(epsl?: number) {
    const v = this._v;
    if (epsl === undefined) epsl = 0.0001;
    for (let i = 0; i < 3; i++) {
      const t = v[i * 3] * v[i * 3] + v[i * 3 + 1] * v[i * 3 + 1] + v[i * 3 + 2] * v[i * 4 + 2];
      if (!numberEquals(t, 1, epsl)) {
        return false;
      }
      const q = v[i] * v[i] + v[3 + i] * v[3 + i] + v[6 + i] * v[6 + i];
      if (!numberEquals(q, 1, epsl)) {
        return false;
      }
    }
    return true;
  }
}

export class Matrix4x4 extends VectorBase {
  constructor();
  constructor(array: number[]);
  constructor(array: Float32Array);
  constructor(rhs: Matrix4x4);
  constructor(mat33: Matrix3x3);
  constructor(quat: Quaternion);
  constructor(arrayOrMatOrQuat?: number[] | Matrix3x3 | Matrix4x4 | Quaternion | Float32Array) {
    super(arrayOrMatOrQuat instanceof Float32Array ? arrayOrMatOrQuat : 16);
    if (arrayOrMatOrQuat !== undefined && !(arrayOrMatOrQuat instanceof Float32Array)) {
      if (arrayOrMatOrQuat instanceof Matrix3x3) {
        this.m00 = arrayOrMatOrQuat.m00;
        this.m01 = arrayOrMatOrQuat.m01;
        this.m02 = arrayOrMatOrQuat.m02;
        this.m03 = 0;
        this.m10 = arrayOrMatOrQuat.m10;
        this.m11 = arrayOrMatOrQuat.m11;
        this.m12 = arrayOrMatOrQuat.m12;
        this.m13 = 0;
        this.m20 = arrayOrMatOrQuat.m20;
        this.m21 = arrayOrMatOrQuat.m21;
        this.m22 = arrayOrMatOrQuat.m22;
        this.m23 = 0;
        this.m30 = 0;
        this.m31 = 0;
        this.m32 = 0;
        this.m33 = 1;
      } else if (arrayOrMatOrQuat instanceof Matrix4x4) {
        this.assign(arrayOrMatOrQuat.getArray());
      } else if (arrayOrMatOrQuat instanceof Quaternion) {
        arrayOrMatOrQuat.toMatrix(this);
        this.m03 = 0;
        this.m13 = 0;
        this.m23 = 0;
        this.m30 = 0;
        this.m31 = 0;
        this.m32 = 0;
        this.m33 = 1;
      } else {
        this.assign(arrayOrMatOrQuat);
      }
    }
  }
  clone(): Matrix4x4 {
    return new Matrix4x4(this);
  }
  get m00() {
    return this._v[0];
  }
  set m00(v: number) {
    this._v[0] = v;
    this.changeNotify();
  }
  get m10() {
    return this._v[1];
  }
  set m10(v: number) {
    this._v[1] = v;
    this.changeNotify();
  }
  get m20() {
    return this._v[2];
  }
  set m20(v: number) {
    this._v[2] = v;
    this.changeNotify();
  }
  get m30() {
    return this._v[3];
  }
  set m30(v: number) {
    this._v[3] = v;
    this.changeNotify();
  }
  get m01() {
    return this._v[4];
  }
  set m01(v: number) {
    this._v[4] = v;
    this.changeNotify();
  }
  get m11() {
    return this._v[5];
  }
  set m11(v: number) {
    this._v[5] = v;
    this.changeNotify();
  }
  get m21() {
    return this._v[6];
  }
  set m21(v: number) {
    this._v[6] = v;
    this.changeNotify();
  }
  get m31() {
    return this._v[7];
  }
  set m31(v: number) {
    this._v[7] = v;
    this.changeNotify();
  }
  get m02() {
    return this._v[8];
  }
  set m02(v: number) {
    this._v[8] = v;
    this.changeNotify();
  }
  get m12() {
    return this._v[9];
  }
  set m12(v: number) {
    this._v[9] = v;
    this.changeNotify();
  }
  get m22() {
    return this._v[10];
  }
  set m22(v: number) {
    this._v[10] = v;
    this.changeNotify();
  }
  get m32() {
    return this._v[11];
  }
  set m32(v: number) {
    this._v[11] = v;
    this.changeNotify();
  }
  get m03() {
    return this._v[12];
  }
  set m03(v: number) {
    this._v[12] = v;
    this.changeNotify();
  }
  get m13() {
    return this._v[13];
  }
  set m13(v: number) {
    this._v[13] = v;
    this.changeNotify();
  }
  get m23() {
    return this._v[14];
  }
  set m23(v: number) {
    this._v[14] = v;
    this.changeNotify();
  }
  get m33() {
    return this._v[15];
  }
  set m33(v: number) {
    this._v[15] = v;
    this.changeNotify();
  }
  getRow(row: number, result?: Vector4): Vector4 {
    return (result || new Vector4()).set(
      this._v[row * 4],
      this._v[row * 4 + 1],
      this._v[row * 4 + 2],
      this._v[row * 4 + 3],
    );
  }
  getRow3(row: number, result?: Vector3): Vector3 {
    return (result || new Vector3()).set(
      this._v[row * 4],
      this._v[row * 4 + 1],
      this._v[row * 4 + 2],
    );
  }
  setRow(row: number, v: IVector4Like) {
    this._v[row * 4] = v.x;
    this._v[row * 4 + 1] = v.y;
    this._v[row * 4 + 2] = v.z;
    this._v[row * 4 + 3] = v.w;
    this.changeNotify();
    return this;
  }
  getCol(col: number, result?: Vector4): Vector4 {
    return (result || new Vector4()).set(
      this._v[col],
      this._v[4 + col],
      this._v[8 + col],
      this._v[12 + col],
    );
  }
  setCol(col: number, v: IVector4Like) {
    this._v[col] = v.x;
    this._v[4 + col] = v.y;
    this._v[8 + col] = v.z;
    this._v[12 + col] = v.w;
    this.changeNotify();
    return this;
  }
  static add(a: Matrix4x4, b: Matrix4x4, result?: Matrix4x4) {
    result = result || new Matrix4x4();
    const v1 = a.getArray();
    const v2 = b.getArray();
    const v = result.getArray();
    for (let i = 0; i < 16; i++) {
      v[i] = v1[i] + v2[i];
    }
    result.changeNotify();
    return result;
  }
  static sub(a: Matrix4x4, b: Matrix4x4, result?: Matrix4x4) {
    result = result || new Matrix4x4();
    const v1 = a.getArray();
    const v2 = b.getArray();
    const v = result.getArray();
    for (let i = 0; i < 16; i++) {
      v[i] = v1[i] - v2[i];
    }
    result.changeNotify();
    return result;
  }
  static mul(a: Matrix4x4, b: Matrix4x4, result?: Matrix4x4) {
    result = result || new Matrix4x4();
    const v1 = a.getArray();
    const v2 = b.getArray();
    const v = result.getArray();
    for (let i = 0; i < 16; i++) {
      v[i] = v1[i] * v2[i];
    }
    result.changeNotify();
    return result;
  }
  static div(a: Matrix4x4, b: Matrix4x4, result?: Matrix4x4) {
    result = result || new Matrix4x4();
    const v1 = a.getArray();
    const v2 = b.getArray();
    const v = result.getArray();
    for (let i = 0; i < 16; i++) {
      v[i] = v1[i] / v2[i];
    }
    result.changeNotify();
    return result;
  }
  static scale(a: Matrix4x4, f: number, result?: Matrix4x4) {
    result = result || new Matrix4x4();
    const v1 = a.getArray();
    const v = result.getArray();
    for (let i = 0; i < 16; i++) {
      v[i] = v1[i] * f;
    }
    result.changeNotify();
    return result;
  }
  static identity(result?: Matrix4x4): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    v[0] = 1;
    v[1] = 0;
    v[2] = 0;
    v[3] = 0;
    v[4] = 0;
    v[5] = 1;
    v[6] = 0;
    v[7] = 0;
    v[8] = 0;
    v[9] = 0;
    v[10] = 1;
    v[11] = 0;
    v[12] = 0;
    v[13] = 0;
    v[14] = 0;
    v[15] = 1;
    result.changeNotify();
    return result;
  }
  static ortho(
    left: number,
    right: number,
    bottom: number,
    top: number,
    znear: number,
    zfar: number,
    result?: Matrix4x4,
  ): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    v[0] = 2 / (right - left);
    v[1] = 0;
    v[2] = 0;
    v[3] = 0;
    v[4] = 0;
    v[5] = 2 / (top - bottom);
    v[6] = 0;
    v[7] = 0;
    v[8] = 0;
    v[9] = 0;
    v[10] = 2 / (znear - zfar);
    v[11] = 0;
    v[12] = (left + right) / (left - right);
    v[13] = (bottom + top) / (bottom - top);
    v[14] = (znear + zfar) / (znear - zfar);
    v[15] = 1;
    result.changeNotify();
    return result;
  }
  static reflection(nx: number, ny: number, nz: number, d: number, result?: Matrix4x4): Matrix4x4 {
    result = result || new Matrix4x4();
    result.m00 = 1 - 2 * nx * nx;
    result.m01 = -2 * nx * ny;
    result.m02 = -2 * nx * nz;
    result.m03 = -2 * nx * d;
    result.m10 = result.m01;
    result.m11 = 1 - 2 * ny * ny;
    result.m12 = -2 * ny * nz;
    result.m13 = -2 * ny * d;
    result.m20 = result.m02;
    result.m21 = result.m12;
    result.m22 = 1 - 2 * nz * nz;
    result.m23 = -2 * nz * d;
    result.m30 = 0;
    result.m31 = 0;
    result.m32 = 0;
    result.m33 = 1;
    return result;
  }
  static perspective(
    fovY: number,
    aspect: number,
    znear: number,
    zfar: number,
    result?: Matrix4x4,
  ): Matrix4x4 {
    const h = znear * Math.tan(fovY * 0.5);
    const w = h * aspect;
    return this.frustum(-w, w, -h, h, znear, zfar, result);
  }
  static perspectiveZ(
    fovY: number,
    aspect: number,
    znear: number,
    zfar: number,
    result?: Matrix4x4,
  ): Matrix4x4 {
    const h = znear * Math.tan(fovY * 0.5);
    const w = h * aspect;
    return this.frustumZ(-w, w, -h, h, znear, zfar, result);
  }
  static obliquePerspective(perspectiveMatrix: Matrix4x4, nearPlane: Vector4): Matrix4x4 {
    const result = new Matrix4x4(perspectiveMatrix);
    const q = new Vector4(
      ((nearPlane.x > 0 ? 1 : nearPlane.x < 0 ? -1 : 0) + perspectiveMatrix.m20) / perspectiveMatrix.m00,
      ((nearPlane.y > 0 ? 1 : nearPlane.y < 0 ? -1 : 0) + perspectiveMatrix.m21) / perspectiveMatrix.m11,
      -1,
      (1 + perspectiveMatrix.m22) / perspectiveMatrix.m32);
    const c = Vector4.scale(nearPlane, 2 / Vector4.dot(nearPlane, q));
    result.m02 = c.x;
    result.m12 = c.y;
    result.m22 = c.z + 1;
    result.m32 = c.w;
    return result;
    /*
        float       matrix[16];
        Vector4D    q;

        // Grab the current projection matrix from OpenGL
        glGetFloatv(GL_PROJECTION_MATRIX, matrix);

        // Calculate the clip-space corner point opposite the clipping plane
        // as (sgn(clipPlane.x), sgn(clipPlane.y), 1, 1) and
        // transform it into camera space by multiplying it
        // by the inverse of the projection matrix

        q.x = (sgn(clipPlane.x) + matrix[8]) / matrix[0];
        q.y = (sgn(clipPlane.y) + matrix[9]) / matrix[5];
        q.z = -1.0F;
        q.w = (1.0F + matrix[10]) / matrix[14];

        // Calculate the scaled plane vector
        Vector4D c = clipPlane * (2.0F / Dot(clipPlane, q));

        // Replace the third row of the projection matrix
        matrix[2] = c.x;
        matrix[6] = c.y;
        matrix[10] = c.z + 1.0F;
        matrix[14] = c.w;

        // Load it back into OpenGL
        glMatrixMode(GL_PROJECTION);
        glLoadMatrix(matrix);
    }
    */
  }
  static frustum(
    left: number,
    right: number,
    bottom: number,
    top: number,
    znear: number,
    zfar: number,
    result?: Matrix4x4,
  ): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    const dx = right - left;
    const dy = top - bottom;
    const dz = znear - zfar;
    v[0] = (2 * znear) / dx;
    v[1] = 0;
    v[2] = 0;
    v[3] = 0;
    v[4] = 0;
    v[5] = (2 * znear) / dy;
    v[6] = 0;
    v[7] = 0;
    v[8] = (left + right) / dx;
    v[9] = (top + bottom) / dy;
    v[10] = (znear + zfar) / dz;
    v[11] = -1;
    v[12] = 0;
    v[13] = 0;
    v[14] = (2 * znear * zfar) / dz;
    v[15] = 0;

    result.changeNotify();
    return result;
  }
  static frustumZ(
    left: number,
    right: number,
    bottom: number,
    top: number,
    znear: number,
    zfar: number,
    result?: Matrix4x4,
  ): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    const dx = right - left;
    const dy = top - bottom;
    const dz = znear - zfar;
    v[0] = (2 * znear) / dx;
    v[1] = 0;
    v[2] = 0;
    v[3] = 0;
    v[4] = 0;
    v[5] = (2 * znear) / dy;
    v[6] = 0;
    v[7] = 0;
    v[8] = (left + right) / dx;
    v[9] = (top + bottom) / dy;
    v[10] = zfar / dz;
    v[11] = -1;
    v[12] = 0;
    v[13] = 0;
    v[14] = znear * zfar / dz;
    v[15] = 0;

    result.changeNotify();
    return result;
  }
  static transpose(matrix: Matrix4x4, result?: Matrix4x4): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = matrix.getArray();
    const d = result.getArray();
    if (v === d) {
      let t: number;
      t = d[1];
      d[1] = d[4];
      d[4] = t;
      t = d[2];
      d[2] = d[8];
      d[8] = t;
      t = d[3];
      d[3] = d[12];
      d[12] = t;
      t = d[6];
      d[6] = d[9];
      d[9] = t;
      t = d[7];
      d[7] = d[13];
      d[13] = t;
      t = d[11];
      d[11] = d[14];
      d[14] = t;
    } else {
      d[0] = v[0];
      d[1] = v[4];
      d[2] = v[8];
      d[3] = v[12];
      d[4] = v[1];
      d[5] = v[5];
      d[6] = v[9];
      d[7] = v[13];
      d[8] = v[2];
      d[9] = v[6];
      d[10] = v[10];
      d[11] = v[14];
      d[12] = v[3];
      d[13] = v[7];
      d[14] = v[11];
      d[15] = v[15];
    }
    result.changeNotify();
    return result;
  }
  static inverse(matrix: Matrix4x4, result?: Matrix4x4): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = matrix.getArray();
    const t = result.getArray();
    const m00 = v[0 * 4 + 0];
    const m01 = v[0 * 4 + 1];
    const m02 = v[0 * 4 + 2];
    const m03 = v[0 * 4 + 3];
    const m10 = v[1 * 4 + 0];
    const m11 = v[1 * 4 + 1];
    const m12 = v[1 * 4 + 2];
    const m13 = v[1 * 4 + 3];
    const m20 = v[2 * 4 + 0];
    const m21 = v[2 * 4 + 1];
    const m22 = v[2 * 4 + 2];
    const m23 = v[2 * 4 + 3];
    const m30 = v[3 * 4 + 0];
    const m31 = v[3 * 4 + 1];
    const m32 = v[3 * 4 + 2];
    const m33 = v[3 * 4 + 3];
    const tmp_0 = m22 * m33;
    const tmp_1 = m32 * m23;
    const tmp_2 = m12 * m33;
    const tmp_3 = m32 * m13;
    const tmp_4 = m12 * m23;
    const tmp_5 = m22 * m13;
    const tmp_6 = m02 * m33;
    const tmp_7 = m32 * m03;
    const tmp_8 = m02 * m23;
    const tmp_9 = m22 * m03;
    const tmp_10 = m02 * m13;
    const tmp_11 = m12 * m03;
    const tmp_12 = m20 * m31;
    const tmp_13 = m30 * m21;
    const tmp_14 = m10 * m31;
    const tmp_15 = m30 * m11;
    const tmp_16 = m10 * m21;
    const tmp_17 = m20 * m11;
    const tmp_18 = m00 * m31;
    const tmp_19 = m30 * m01;
    const tmp_20 = m00 * m21;
    const tmp_21 = m20 * m01;
    const tmp_22 = m00 * m11;
    const tmp_23 = m10 * m01;

    const t0 = tmp_0 * m11 + tmp_3 * m21 + tmp_4 * m31 - (tmp_1 * m11 + tmp_2 * m21 + tmp_5 * m31);
    const t1 = tmp_1 * m01 + tmp_6 * m21 + tmp_9 * m31 - (tmp_0 * m01 + tmp_7 * m21 + tmp_8 * m31);
    const t2 =
      tmp_2 * m01 + tmp_7 * m11 + tmp_10 * m31 - (tmp_3 * m01 + tmp_6 * m11 + tmp_11 * m31);
    const t3 =
      tmp_5 * m01 + tmp_8 * m11 + tmp_11 * m21 - (tmp_4 * m01 + tmp_9 * m11 + tmp_10 * m21);

    const d = 1.0 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3);

    t[0] = d * t0;
    t[1] = d * t1;
    t[2] = d * t2;
    t[3] = d * t3;
    t[4] =
      d * (tmp_1 * m10 + tmp_2 * m20 + tmp_5 * m30 - (tmp_0 * m10 + tmp_3 * m20 + tmp_4 * m30));
    t[5] =
      d * (tmp_0 * m00 + tmp_7 * m20 + tmp_8 * m30 - (tmp_1 * m00 + tmp_6 * m20 + tmp_9 * m30));
    t[6] =
      d * (tmp_3 * m00 + tmp_6 * m10 + tmp_11 * m30 - (tmp_2 * m00 + tmp_7 * m10 + tmp_10 * m30));
    t[7] =
      d * (tmp_4 * m00 + tmp_9 * m10 + tmp_10 * m20 - (tmp_5 * m00 + tmp_8 * m10 + tmp_11 * m20));
    t[8] =
      d *
      (tmp_12 * m13 + tmp_15 * m23 + tmp_16 * m33 - (tmp_13 * m13 + tmp_14 * m23 + tmp_17 * m33));
    t[9] =
      d *
      (tmp_13 * m03 + tmp_18 * m23 + tmp_21 * m33 - (tmp_12 * m03 + tmp_19 * m23 + tmp_20 * m33));
    t[10] =
      d *
      (tmp_14 * m03 + tmp_19 * m13 + tmp_22 * m33 - (tmp_15 * m03 + tmp_18 * m13 + tmp_23 * m33));
    t[11] =
      d *
      (tmp_17 * m03 + tmp_20 * m13 + tmp_23 * m23 - (tmp_16 * m03 + tmp_21 * m13 + tmp_22 * m23));
    t[12] =
      d *
      (tmp_14 * m22 + tmp_17 * m32 + tmp_13 * m12 - (tmp_16 * m32 + tmp_12 * m12 + tmp_15 * m22));
    t[13] =
      d *
      (tmp_20 * m32 + tmp_12 * m02 + tmp_19 * m22 - (tmp_18 * m22 + tmp_21 * m32 + tmp_13 * m02));
    t[14] =
      d *
      (tmp_18 * m12 + tmp_23 * m32 + tmp_15 * m02 - (tmp_22 * m32 + tmp_14 * m02 + tmp_19 * m12));
    t[15] =
      d *
      (tmp_22 * m22 + tmp_16 * m02 + tmp_21 * m12 - (tmp_20 * m12 + tmp_23 * m22 + tmp_17 * m02));

    result.changeNotify();
    return result;
  }
  static inverseAffine(matrix: Matrix4x4, result?: Matrix4x4): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = matrix.getArray();
    const t = result.getArray();
    const m00 = v[0 * 4 + 0];
    const m01 = v[0 * 4 + 1];
    const m02 = v[0 * 4 + 2];
    const m10 = v[1 * 4 + 0];
    const m11 = v[1 * 4 + 1];
    const m12 = v[1 * 4 + 2];
    const m20 = v[2 * 4 + 0];
    const m21 = v[2 * 4 + 1];
    const m22 = v[2 * 4 + 2];
    const m30 = v[3 * 4 + 0];
    const m31 = v[3 * 4 + 1];
    const m32 = v[3 * 4 + 2];
    const t0 = m22 * m11 - m12 * m21;
    const t1 = m02 * m21 - m22 * m01;
    const t2 = m12 * m01 - m02 * m11;
    const d = 1.0 / (m00 * t0 + m10 * t1 + m20 * t2);
    t[0] = d * t0;
    t[1] = d * t1;
    t[2] = d * t2;
    t[3] = 0;
    t[4] = d * (m12 * m20 - m22 * m10);
    t[5] = d * (m22 * m00 - m02 * m20);
    t[6] = d * (m02 * m10 - m12 * m00);
    t[7] = 0;
    t[8] = d * (m10 * m21 - m20 * m11);
    t[9] = d * (m20 * m01 - m00 * m21);
    t[10] = d * (m00 * m11 - m10 * m01);
    t[11] = 0;
    t[12] =
      d *
      (m10 * m31 * m22 +
        m20 * m11 * m32 +
        m30 * m21 * m12 -
        (m10 * m21 * m32 + m20 * m31 * m12 + m30 * m11 * m22));
    t[13] =
      d *
      (m00 * m21 * m32 +
        m20 * m31 * m02 +
        m30 * m01 * m22 -
        (m00 * m31 * m22 + m20 * m01 * m32 + m30 * m21 * m02));
    t[14] =
      d *
      (m00 * m31 * m12 +
        m10 * m01 * m32 +
        m30 * m11 * m02 -
        (m00 * m11 * m32 + m10 * m31 * m02 + m30 * m01 * m12));
    t[15] = 1;

    result.changeNotify();
    return result;
  }
  static translation(t: IVector3Like, result?: Matrix4x4): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    v[0] = 1;
    v[1] = 0;
    v[2] = 0;
    v[3] = 0;
    v[4] = 0;
    v[5] = 1;
    v[6] = 0;
    v[7] = 0;
    v[8] = 0;
    v[9] = 0;
    v[10] = 1;
    v[11] = 0;
    v[12] = t.x;
    v[13] = t.y;
    v[14] = t.z;
    v[15] = 1;

    result.changeNotify();
    return result;
  }
  static scaling(s: IVector3Like, result?: Matrix4x4): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    v[0] = s.x;
    v[1] = 0;
    v[2] = 0;
    v[3] = 0;
    v[4] = 0;
    v[5] = s.y;
    v[6] = 0;
    v[7] = 0;
    v[8] = 0;
    v[9] = 0;
    v[10] = s.z;
    v[11] = 0;
    v[12] = 0;
    v[13] = 0;
    v[14] = 0;
    v[15] = 1;

    result.changeNotify();
    return result;
  }
  static rotationX(angle: number, result?: Matrix4x4): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    v[0] = 1;
    v[1] = 0;
    v[2] = 0;
    v[3] = 0;
    v[4] = 0;
    v[5] = c;
    v[6] = s;
    v[7] = 0;
    v[8] = 0;
    v[9] = -s;
    v[10] = c;
    v[11] = 0;
    v[12] = 0;
    v[13] = 0;
    v[14] = 0;
    v[15] = 1;

    result.changeNotify();
    return result;
  }
  static rotationY(angle: number, result?: Matrix4x4): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    v[0] = c;
    v[1] = 0;
    v[2] = -s;
    v[3] = 0;
    v[4] = 0;
    v[5] = 1;
    v[6] = 0;
    v[7] = 0;
    v[8] = s;
    v[9] = 0;
    v[10] = c;
    v[11] = 0;
    v[12] = 0;
    v[13] = 0;
    v[14] = 0;
    v[15] = 1;

    result.changeNotify();
    return result;
  }
  static rotationZ(angle: number, result?: Matrix4x4): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    v[0] = c;
    v[1] = s;
    v[2] = 0;
    v[3] = 0;
    v[4] = -s;
    v[5] = c;
    v[6] = 0;
    v[7] = 0;
    v[8] = 0;
    v[9] = 0;
    v[10] = 1;
    v[11] = 0;
    v[12] = 0;
    v[13] = 0;
    v[14] = 0;
    v[15] = 1;

    result.changeNotify();
    return result;
  }
  static rotation(axis: IVector3Like, angle: number, result?: Matrix4x4): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    let x = axis.x;
    let y = axis.y;
    let z = axis.z;
    const n = Math.sqrt(x * x + y * y + z * z);
    x /= n;
    y /= n;
    z /= n;
    const xx = x * x;
    const yy = y * y;
    const zz = z * z;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const oneMinusCosine = 1 - c;
    v[0] = xx + (1 - xx) * c;
    v[1] = x * y * oneMinusCosine + z * s;
    v[2] = x * z * oneMinusCosine - y * s;
    v[3] = 0;
    v[4] = x * y * oneMinusCosine - z * s;
    v[5] = yy + (1 - yy) * c;
    v[6] = y * z * oneMinusCosine + x * s;
    v[7] = 0;
    v[8] = x * z * oneMinusCosine + y * s;
    v[9] = y * z * oneMinusCosine - x * s;
    v[10] = zz + (1 - zz) * c;
    v[11] = 0;
    v[12] = 0;
    v[13] = 0;
    v[14] = 0;
    v[15] = 1;

    result.changeNotify();
    return result;
  }
  static lookAt(
    eye: IVector3Like,
    target: IVector3Like,
    up: IVector3Like,
    result?: Matrix4x4,
  ): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    const zAxis = Vector3.normalize(Vector3.sub(eye, target));
    const xAxis = Vector3.normalize(Vector3.cross(up, zAxis));
    const yAxis = Vector3.normalize(Vector3.cross(zAxis, xAxis));
    v[0] = xAxis.x;
    v[1] = xAxis.y;
    v[2] = xAxis.z;
    v[3] = 0;
    v[4] = yAxis.x;
    v[5] = yAxis.y;
    v[6] = yAxis.z;
    v[7] = 0;
    v[8] = zAxis.x;
    v[9] = zAxis.y;
    v[10] = zAxis.z;
    v[11] = 0;
    v[12] = eye.x;
    v[13] = eye.y;
    v[14] = eye.z;
    v[15] = 1;

    result.changeNotify();
    return result;
  }
  static lookAtCubeFace(face: CubeFace, result?: Matrix4x4): Matrix4x4 {
    switch (face) {
      case CubeFace.PX:
        return this.lookAt(Vector3.zero(), Vector3.axisPX(), Vector3.axisNY(), result);
      case CubeFace.NX:
        return this.lookAt(Vector3.zero(), Vector3.axisNX(), Vector3.axisNY(), result);
      case CubeFace.PY:
        return this.lookAt(Vector3.zero(), Vector3.axisPY(), Vector3.axisPZ(), result);
      case CubeFace.NY:
        return this.lookAt(Vector3.zero(), Vector3.axisNY(), Vector3.axisNZ(), result);
      case CubeFace.PZ:
        return this.lookAt(Vector3.zero(), Vector3.axisPZ(), Vector3.axisNY(), result);
      case CubeFace.NZ:
        return this.lookAt(Vector3.zero(), Vector3.axisNZ(), Vector3.axisNY(), result);
      default:
        return null;
    }
  }
  static multiply(m1: Matrix4x4, m2: Matrix4x4, result?: Matrix4x4): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    const a = m1.getArray();
    const b = m2.getArray();
    const a00 = a[0];
    const a01 = a[1];
    const a02 = a[2];
    const a03 = a[3];
    const a10 = a[4];
    const a11 = a[5];
    const a12 = a[6];
    const a13 = a[7];
    const a20 = a[8];
    const a21 = a[9];
    const a22 = a[10];
    const a23 = a[11];
    const a30 = a[12];
    const a31 = a[13];
    const a32 = a[14];
    const a33 = a[15];
    const b00 = b[0];
    const b01 = b[1];
    const b02 = b[2];
    const b03 = b[3];
    const b10 = b[4];
    const b11 = b[5];
    const b12 = b[6];
    const b13 = b[7];
    const b20 = b[8];
    const b21 = b[9];
    const b22 = b[10];
    const b23 = b[11];
    const b30 = b[12];
    const b31 = b[13];
    const b32 = b[14];
    const b33 = b[15];

    v[0] = a00 * b00 + a10 * b01 + a20 * b02 + a30 * b03;
    v[1] = a01 * b00 + a11 * b01 + a21 * b02 + a31 * b03;
    v[2] = a02 * b00 + a12 * b01 + a22 * b02 + a32 * b03;
    v[3] = a03 * b00 + a13 * b01 + a23 * b02 + a33 * b03;
    v[4] = a00 * b10 + a10 * b11 + a20 * b12 + a30 * b13;
    v[5] = a01 * b10 + a11 * b11 + a21 * b12 + a31 * b13;
    v[6] = a02 * b10 + a12 * b11 + a22 * b12 + a32 * b13;
    v[7] = a03 * b10 + a13 * b11 + a23 * b12 + a33 * b13;
    v[8] = a00 * b20 + a10 * b21 + a20 * b22 + a30 * b23;
    v[9] = a01 * b20 + a11 * b21 + a21 * b22 + a31 * b23;
    v[10] = a02 * b20 + a12 * b21 + a22 * b22 + a32 * b23;
    v[11] = a03 * b20 + a13 * b21 + a23 * b22 + a33 * b23;
    v[12] = a00 * b30 + a10 * b31 + a20 * b32 + a30 * b33;
    v[13] = a01 * b30 + a11 * b31 + a21 * b32 + a31 * b33;
    v[14] = a02 * b30 + a12 * b31 + a22 * b32 + a32 * b33;
    v[15] = a03 * b30 + a13 * b31 + a23 * b32 + a33 * b33;

    result.changeNotify();
    return result;
  }
  static multiplyAffine(m1: Matrix4x4, m2: Matrix4x4, result?: Matrix4x4): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    const a = m1.getArray();
    const b = m2.getArray();
    const a00 = a[0];
    const a01 = a[1];
    const a02 = a[2];
    const a10 = a[4];
    const a11 = a[5];
    const a12 = a[6];
    const a20 = a[8];
    const a21 = a[9];
    const a22 = a[10];
    const a30 = a[12];
    const a31 = a[13];
    const a32 = a[14];
    const b00 = b[0];
    const b01 = b[1];
    const b02 = b[2];
    const b10 = b[4];
    const b11 = b[5];
    const b12 = b[6];
    const b20 = b[8];
    const b21 = b[9];
    const b22 = b[10];
    const b30 = b[12];
    const b31 = b[13];
    const b32 = b[14];

    v[0] = a00 * b00 + a10 * b01 + a20 * b02;
    v[1] = a01 * b00 + a11 * b01 + a21 * b02;
    v[2] = a02 * b00 + a12 * b01 + a22 * b02;
    v[3] = 0;
    v[4] = a00 * b10 + a10 * b11 + a20 * b12;
    v[5] = a01 * b10 + a11 * b11 + a21 * b12;
    v[6] = a02 * b10 + a12 * b11 + a22 * b12;
    v[7] = 0;
    v[8] = a00 * b20 + a10 * b21 + a20 * b22;
    v[9] = a01 * b20 + a11 * b21 + a21 * b22;
    v[10] = a02 * b20 + a12 * b21 + a22 * b22;
    v[11] = 0;
    v[12] = a00 * b30 + a10 * b31 + a20 * b32 + a30;
    v[13] = a01 * b30 + a11 * b31 + a21 * b32 + a31;
    v[14] = a02 * b30 + a12 * b31 + a22 * b32 + a32;
    v[15] = 1;

    result.changeNotify();
    return result;
  }
  static translateRight(m: Matrix4x4, t: IVector3Like, result?: Matrix4x4): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    const a = m.getArray();
    if (v !== a) {
      v[0] = a[0];
      v[1] = a[1];
      v[2] = a[2];
      v[3] = a[3];
      v[4] = a[4];
      v[5] = a[5];
      v[6] = a[6];
      v[7] = a[7];
      v[8] = a[8];
      v[9] = a[9];
      v[10] = a[10];
      v[11] = a[11];
      v[12] = a[0] * t.x + a[4] * t.y + a[8] * t.z + a[12];
      v[13] = a[1] * t.x + a[5] * t.y + a[9] * t.z + a[13];
      v[14] = a[2] * t.x + a[6] * t.y + a[10] * t.z + a[14];
      v[15] = a[15];
    } else {
      const x = a[0] * t.x + a[4] * t.y + a[8] * t.z + a[12];
      const y = a[1] * t.x + a[5] * t.y + a[9] * t.z + a[13];
      const z = a[2] * t.x + a[6] * t.y + a[10] * t.z + a[14];
      v[12] = x;
      v[13] = y;
      v[14] = z;
    }
    result.changeNotify();
    return result;
  }
  static translateLeft(m: Matrix4x4, t: IVector3Like, result?: Matrix4x4): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    const a = m.getArray();
    if (v !== a) {
      v[0] = a[0];
      v[1] = a[1];
      v[2] = a[2];
      v[3] = a[3];
      v[4] = a[4];
      v[5] = a[5];
      v[6] = a[6];
      v[7] = a[7];
      v[8] = a[8];
      v[9] = a[9];
      v[10] = a[10];
      v[11] = a[11];
      v[12] = a[12] + t.x;
      v[13] = a[13] + t.y;
      v[14] = a[14] + t.z;
      v[15] = a[15];
    } else {
      v[12] += t.x;
      v[13] += t.y;
      v[14] += t.z;
    }
    result.changeNotify();
    return result;
  }
  static scaleRight(m: Matrix4x4, s: IVector3Like, result?: Matrix4x4): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    const a = m.getArray();
    if (v !== a) {
      v[0] = a[0] * s.x;
      v[1] = a[1] * s.x;
      v[2] = a[2] * s.x;
      v[3] = a[3] * s.x;
      v[4] = a[4] * s.y;
      v[5] = a[5] * s.y;
      v[6] = a[6] * s.y;
      v[7] = a[7] * s.y;
      v[8] = a[8] * s.z;
      v[9] = a[9] * s.z;
      v[10] = a[10] * s.z;
      v[11] = a[11] * s.z;
      v[12] = a[12];
      v[13] = a[13];
      v[14] = a[14];
      v[15] = a[15];
    } else {
      v[0] *= s.x;
      v[1] *= s.x;
      v[2] *= s.x;
      v[3] *= s.x;
      v[4] *= s.y;
      v[5] *= s.y;
      v[6] *= s.y;
      v[7] *= s.y;
      v[8] *= s.z;
      v[9] *= s.z;
      v[10] *= s.z;
      v[11] *= s.z;
    }

    result.changeNotify();
    return result;
  }
  static scaleLeft(m: Matrix4x4, s: IVector3Like, result?: Matrix4x4): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    const a = m.getArray();
    if (v !== a) {
      v[0] = a[0] * s.x;
      v[1] = a[1] * s.y;
      v[2] = a[2] * s.z;
      v[3] = a[3];
      v[4] = a[4] * s.x;
      v[5] = a[5] * s.y;
      v[6] = a[6] * s.z;
      v[7] = a[7];
      v[8] = a[8] * s.x;
      v[9] = a[9] * s.y;
      v[10] = a[10] * s.z;
      v[11] = a[11];
      v[12] = a[12] * s.x;
      v[13] = a[13] * s.y;
      v[14] = a[14] * s.z;
      v[15] = a[15];
    } else {
      v[0] *= s.x;
      v[1] *= s.y;
      v[2] *= s.z;
      v[4] *= s.x;
      v[5] *= s.y;
      v[6] *= s.z;
      v[8] *= s.x;
      v[9] *= s.y;
      v[10] *= s.z;
      v[12] *= s.x;
      v[13] *= s.y;
      v[14] *= s.z;
    }

    result.changeNotify();
    return result;
  }
  static rotateRight(
    m: Matrix4x4,
    r: Matrix3x3 | Matrix4x4 | Quaternion,
    result?: Matrix4x4,
  ): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    const a = m.getArray();
    const b = r instanceof Quaternion ? new Matrix3x3(r) : r;
    const a00 = a[0];
    const a01 = a[1];
    const a02 = a[2];
    const a03 = a[3];
    const a10 = a[4];
    const a11 = a[5];
    const a12 = a[6];
    const a13 = a[7];
    const a20 = a[8];
    const a21 = a[9];
    const a22 = a[10];
    const a23 = a[11];
    const a30 = a[12];
    const a31 = a[13];
    const a32 = a[14];
    const a33 = a[15];
    const b00 = b.m00;
    const b01 = b.m10;
    const b02 = b.m20;
    const b10 = b.m01;
    const b11 = b.m11;
    const b12 = b.m21;
    const b20 = b.m02;
    const b21 = b.m12;
    const b22 = b.m22;
    v[0] = a00 * b00 + a10 * b01 + a20 * b02;
    v[1] = a01 * b00 + a11 * b01 + a21 * b02;
    v[2] = a02 * b00 + a12 * b01 + a22 * b02;
    v[3] = a03 * b00 + a13 * b01 + a23 * b02;
    v[4] = a00 * b10 + a10 * b11 + a20 * b12;
    v[5] = a01 * b10 + a11 * b11 + a21 * b12;
    v[6] = a02 * b10 + a12 * b11 + a22 * b12;
    v[7] = a03 * b10 + a13 * b11 + a23 * b12;
    v[8] = a00 * b20 + a10 * b21 + a20 * b22;
    v[9] = a01 * b20 + a11 * b21 + a21 * b22;
    v[10] = a02 * b20 + a12 * b21 + a22 * b22;
    v[11] = a03 * b20 + a13 * b21 + a23 * b22;
    v[12] = a30;
    v[13] = a31;
    v[14] = a32;
    v[15] = a33;

    result.changeNotify();
    return result;
  }
  static rotateLeft(
    m: Matrix4x4,
    r: Matrix3x3 | Matrix4x4 | Quaternion,
    result?: Matrix4x4,
  ): Matrix4x4 {
    result = result || new Matrix4x4();
    const v = result.getArray();
    const a = r instanceof Quaternion ? new Matrix3x3(r) : r;
    const b = m.getArray();
    const a00 = a.m00;
    const a01 = a.m10;
    const a02 = a.m20;
    const a10 = a.m01;
    const a11 = a.m11;
    const a12 = a.m21;
    const a20 = a.m02;
    const a21 = a.m12;
    const a22 = a.m22;
    const b00 = b[0];
    const b01 = b[1];
    const b02 = b[2];
    const b03 = b[3];
    const b10 = b[4];
    const b11 = b[5];
    const b12 = b[6];
    const b13 = b[7];
    const b20 = b[8];
    const b21 = b[9];
    const b22 = b[10];
    const b23 = b[11];
    const b30 = b[12];
    const b31 = b[13];
    const b32 = b[14];
    const b33 = b[15];

    v[0] = a00 * b00 + a10 * b01 + a20 * b02;
    v[1] = a01 * b00 + a11 * b01 + a21 * b02;
    v[2] = a02 * b00 + a12 * b01 + a22 * b02;
    v[3] = b03;
    v[4] = a00 * b10 + a10 * b11 + a20 * b12;
    v[5] = a01 * b10 + a11 * b11 + a21 * b12;
    v[6] = a02 * b10 + a12 * b11 + a22 * b12;
    v[7] = b13;
    v[8] = a00 * b20 + a10 * b21 + a20 * b22;
    v[9] = a01 * b20 + a11 * b21 + a21 * b22;
    v[10] = a02 * b20 + a12 * b21 + a22 * b22;
    v[11] = b23;
    v[12] = a00 * b30 + a10 * b31 + a20 * b32;
    v[13] = a01 * b30 + a11 * b31 + a21 * b32;
    v[14] = a02 * b30 + a12 * b31 + a22 * b32;
    v[15] = b33;

    result.changeNotify();
    return result;
  }
  subBy(other: Matrix4x4) {
    return Matrix4x4.sub(this, other, this);
  }
  addBy(other: Matrix4x4) {
    return Matrix4x4.add(this, other, this);
  }
  mulBy(other: Matrix4x4) {
    return Matrix4x4.mul(this, other, this);
  }
  divBy(other: Matrix4x4) {
    return Matrix4x4.div(this, other, this);
  }
  scaleBy(f: number) {
    return Matrix4x4.scale(this, f, this);
  }
  identity() {
    return Matrix4x4.identity(this);
  }
  perspective(fovY: number, aspect: number, znear: number, zfar: number) {
    return Matrix4x4.perspective(fovY, aspect, znear, zfar, this);
  }
  frustum(left: number, right: number, bottom: number, top: number, znear: number, zfar: number) {
    return Matrix4x4.frustum(left, right, bottom, top, znear, zfar, this);
  }
  ortho(left: number, right: number, bottom: number, top: number, znear: number, zfar: number) {
    return Matrix4x4.ortho(left, right, bottom, top, znear, zfar, this);
  }
  isOrtho(): boolean {
    // assum this is a projection matrix
    return this._v[15] === 1;
  }
  isPerspective(): boolean {
    // assum this is a projection matrix
    return this._v[15] === 0;
  }
  getNearPlaneWidth(): number {
    if (this.isPerspective()) {
      return 2 * this.getNearPlane() / this._v[0];
    } else {
      return 2 / this._v[0];
    }
  }
  getNearPlaneHeight(): number {
    if (this.isPerspective()) {
      return 2 * this.getNearPlane() / this._v[5];
    } else {
      return 2 / this._v[5];
    }
  }
  getNearPlane(): number {
    // assum this is a projection matrix
    if (this.isPerspective()) {
      return this._v[14] / (this._v[10] - 1);
    } else {
      return (this._v[14] + 1) / this._v[10];
    }
  }
  getFarPlaneWidth(): number {
    if (this.isPerspective()) {
      return this.getNearPlaneWidth() * this.getFarPlane() / this.getNearPlane();
    } else {
      return this.getNearPlaneWidth();
    }
  }
  getFarPlaneHeight(): number {
    if (this.isPerspective()) {
      return this.getNearPlaneHeight() * this.getFarPlane() / this.getNearPlane();
    } else {
      return this.getNearPlaneHeight();
    }
  }
  getFarPlane(): number {
    // assum this is a projection matrix
    if (this.isPerspective()) {
      return this._v[14] / (this._v[10] + 1);
    } else {
      return (this._v[14] - 1) / this._v[10];
    }
  }
  getFov(): number {
    // assum this is a projection matrix
    return this.isOrtho() ? 0 : Math.atan(1 / this._v[5]) * 2;
  }
  getTanHalfFov(): number {
    // assum this is a projection matrix
    return this.isOrtho() ? 0 : 1 / this._v[5];
  }
  getAspect(): number {
    // assum this is a projection matrix
    return this._v[5] / this._v[0];
  }
  setNearFar(znear: number, zfar: number): this {
    if (this.isPerspective()) {
      this.perspective(this.getFov(), this.getAspect(), znear, zfar);
    } else {
      this._v[10] = 2 / (znear - zfar);
      this._v[14] = (znear + zfar) / (znear - zfar);
      this.changeNotify();
    }
    return this;
  }
  translation(t: IVector3Like) {
    return Matrix4x4.translation(t, this);
  }
  scaling(s: IVector3Like) {
    return Matrix4x4.scaling(s, this);
  }
  inplaceInverse() {
    return Matrix4x4.inverse(this, this);
  }
  inplaceInverseAffine() {
    return Matrix4x4.inverseAffine(this, this);
  }
  transpose() {
    return Matrix4x4.transpose(this, this);
  }
  multiplyRight(other: Matrix4x4) {
    return Matrix4x4.multiply(this, other, this);
  }
  multiplyRightAffine(other: Matrix4x4) {
    return Matrix4x4.multiplyAffine(this, other, this);
  }
  multiplyLeft(other: Matrix4x4) {
    return Matrix4x4.multiply(other, this, this);
  }
  multiplyLeftAffine(other: Matrix4x4) {
    return Matrix4x4.multiplyAffine(other, this, this);
  }
  rotationX(angle: number) {
    return Matrix4x4.rotationX(angle, this);
  }
  rotationY(angle: number) {
    return Matrix4x4.rotationY(angle, this);
  }
  rotationZ(angle: number) {
    return Matrix4x4.rotationZ(angle, this);
  }
  rotation(axis: IVector3Like, angle: number) {
    return Matrix4x4.rotation(axis, angle, this);
  }
  translateRight(t: IVector3Like) {
    return Matrix4x4.translateRight(this, t, this);
  }
  translateLeft(t: IVector3Like) {
    return Matrix4x4.translateLeft(this, t, this);
  }
  scaleRight(s: IVector3Like) {
    return Matrix4x4.scaleRight(this, s, this);
  }
  scaleLeft(s: IVector3Like) {
    return Matrix4x4.scaleLeft(this, s, this);
  }
  rotateRight(r: Matrix3x3 | Matrix4x4 | Quaternion) {
    return Matrix4x4.rotateRight(this, r, this);
  }
  rotateLeft(r: Matrix3x3 | Matrix4x4 | Quaternion) {
    return Matrix4x4.rotateLeft(this, r, this);
  }
  lookAt(eye: IVector3Like, target: IVector3Like, up: IVector3Like) {
    return Matrix4x4.lookAt(eye, target, up, this);
  }
  transformPoint(point: IVector3Like, result?: Vector4): Vector4 {
    result = result || new Vector4();
    const v = this.getArray();
    const px = point.x,
      py = point.y,
      pz = point.z;
    return result.set(
      v[0] * px + v[4] * py + v[8] * pz + v[12],
      v[1] * px + v[5] * py + v[9] * pz + v[13],
      v[2] * px + v[6] * py + v[10] * pz + v[14],
      v[3] * px + v[7] * py + v[11] * pz + v[15],
    );
  }
  transformPointAffine(point: IVector3Like, result?: Vector3): Vector3 {
    result = result || new Vector3();
    const v = this.getArray();
    const px = point.x;
    const py = point.y;
    const pz = point.z;
    return result.set(
      v[0] * px + v[4] * py + v[8] * pz + v[12],
      v[1] * px + v[5] * py + v[9] * pz + v[13],
      v[2] * px + v[6] * py + v[10] * pz + v[14],
    );
  }
  transformVector(vec: IVector3Like, result?: Vector4): Vector4 {
    result = result || new Vector4();
    const v = this.getArray();
    const vx = vec.x,
      vy = vec.y,
      vz = vec.z;
    return result.set(
      v[0] * vx + v[4] * vy + v[8] * vz,
      v[1] * vx + v[5] * vy + v[9] * vz,
      v[2] * vx + v[6] * vy + v[10] * vz,
      v[3] * vx + v[7] * vy + v[11] * vz,
    );
  }
  transformVectorAffine(vec: IVector3Like, result?: Vector3): Vector3 {
    result = result || new Vector3();
    const v = this.getArray();
    const vx = vec.x,
      vy = vec.y,
      vz = vec.z;
    return result.set(
      v[0] * vx + v[4] * vy + v[8] * vz,
      v[1] * vx + v[5] * vy + v[9] * vz,
      v[2] * vx + v[6] * vy + v[10] * vz,
    );
  }
  transform(vec: IVector4Like, result?: Vector4): Vector4 {
    result = result || new Vector4();
    const v = this.getArray();
    const vx = vec.x,
      vy = vec.y,
      vz = vec.z,
      vw = vec.w;
    return result.set(
      v[0] * vx + v[4] * vy + v[8] * vz + v[12] * vw,
      v[1] * vx + v[5] * vy + v[9] * vz + v[13] * vw,
      v[2] * vx + v[6] * vy + v[10] * vz + v[14] * vw,
      v[3] * vx + v[7] * vy + v[11] * vz + v[15] * vw,
    );
  }
  transformAffine(vec: IVector4Like, result?: Vector4): Vector4 {
    result = result || new Vector4();
    const v = this.getArray();
    const vx = vec.x,
      vy = vec.y,
      vz = vec.z,
      vw = vec.w;
    return result.set(
      v[0] * vx + v[4] * vy + v[8] * vz + v[12] * vw,
      v[1] * vx + v[5] * vy + v[9] * vz + v[13] * vw,
      v[2] * vx + v[6] * vy + v[10] * vz + v[14] * vw,
      vec.w,
    );
  }
  det() {
    const v = this._v;
    const m00 = v[0],
      m01 = v[1],
      m02 = v[2],
      m03 = v[3];
    const m10 = v[4],
      m11 = v[5],
      m12 = v[6],
      m13 = v[7];
    const m20 = v[8],
      m21 = v[9],
      m22 = v[10],
      m23 = v[11];
    const m30 = v[12],
      m31 = v[13],
      m32 = v[14],
      m33 = v[15];
    const det_22_33 = m22 * m33 - m32 * m23;
    const det_21_33 = m21 * m33 - m31 * m23;
    const det_21_32 = m21 * m32 - m31 * m22;
    const det_20_33 = m20 * m33 - m30 * m23;
    const det_20_32 = m20 * m32 - m22 * m30;
    const det_20_31 = m20 * m31 - m30 * m21;
    const cofact_00 = +(m11 * det_22_33 - m12 * det_21_33 + m13 * det_21_32);
    const cofact_01 = -(m10 * det_22_33 - m12 * det_20_33 + m13 * det_20_32);
    const cofact_02 = +(m10 * det_21_33 - m11 * det_20_33 + m13 * det_20_31);
    const cofact_03 = -(m10 * det_21_32 - m11 * det_20_32 + m12 * det_20_31);
    return m00 * cofact_00 + m01 * cofact_01 + m02 * cofact_02 + m03 * cofact_03;
  }
  det2() {
    const v = this._v;
    const m00 = v[0],
      m01 = v[1],
      m02 = v[2],
      m03 = v[3];
    const m10 = v[4],
      m11 = v[5],
      m12 = v[6],
      m13 = v[7];
    const m20 = v[8],
      m21 = v[9],
      m22 = v[10],
      m23 = v[11];
    const m30 = v[12],
      m31 = v[13],
      m32 = v[14],
      m33 = v[15];
    return (
      (m00 * m11 - m01 * m10) * (m22 * m33 - m23 * m32) -
      (m00 * m12 - m02 * m10) * (m21 * m33 - m23 * m31) +
      (m00 * m13 - m03 * m10) * (m21 * m32 - m22 * m31) +
      (m01 * m12 - m02 * m11) * (m20 * m33 - m23 * m30) -
      (m01 * m13 - m03 * m11) * (m20 * m32 - m22 * m30) +
      (m02 * m13 - m03 * m12) * (m20 * m31 - m21 * m30)
    );
  }
  decompose(scale?: Vector3, rotation?: Quaternion | Matrix3x3 | Matrix4x4, translation?: Vector3) {
    const v = this._v;
    if (translation) {
      translation.set(this._v[12], this._v[13], this._v[14]);
    }
    const sign = this.det() <= 0 ? -1 : 1;
    const sx = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    const sy = Math.sqrt(v[4] * v[4] + v[5] * v[5] + v[6] * v[6]) * sign;
    const sz = Math.sqrt(v[8] * v[8] + v[9] * v[9] + v[10] * v[10]);
    if (scale) {
      scale.set(sx, sy, sz);
    }
    if (rotation instanceof Quaternion) {
      const rotationMatrix = new Matrix3x3(this);
      const data = rotationMatrix.getArray();
      data[0] /= sx;
      data[1] /= sx;
      data[2] /= sx;
      data[3] /= sy;
      data[4] /= sy;
      data[5] /= sy;
      data[6] /= sz;
      data[7] /= sz;
      data[8] /= sz;
      rotation.fromRotationMatrix(rotationMatrix);
    } else if (rotation instanceof Matrix3x3) {
      const data = rotation.getArray();
      data[0] = v[0] / sx;
      data[1] = v[1] / sx;
      data[2] = v[2] / sx;
      data[3] = v[4] / sy;
      data[4] = v[5] / sy;
      data[5] = v[6] / sy;
      data[6] = v[8] / sz;
      data[7] = v[9] / sz;
      data[8] = v[10] / sz;
    } else if (rotation instanceof Matrix4x4) {
      const data = rotation.getArray();
      data[0] = v[0] / sx;
      data[1] = v[1] / sx;
      data[2] = v[2] / sx;
      data[3] = 0;
      data[4] = v[4] / sy;
      data[5] = v[5] / sy;
      data[6] = v[6] / sy;
      data[7] = 0;
      data[8] = v[8] / sz;
      data[9] = v[9] / sz;
      data[10] = v[10] / sz;
      data[11] = 0;
      data[12] = 0;
      data[13] = 0;
      data[14] = 0;
      data[15] = 1;
    }
    return this;
  }
  decomposeLookAt(eye?: Vector3, target?: Vector3, up?: Vector3) {
    eye && eye.set(this._v[12], this._v[13], this._v[14]);
    up && up.set(this._v[4], this._v[5], this._v[6]);
    target &&
      target.set(this._v[12] - this._v[8], this._v[13] - this._v[9], this._v[14] - this._v[10]);
    return this;
  }
  toDualQuaternion(): { real: Quaternion, dual: Quaternion, scale: Vector3 } {
    const t = new Vector3();
    const r = new Quaternion();
    const s = new Vector3();
    this.decompose(s, r, t);
    const translation = new Quaternion(this.m03 * 0.5, this.m13 * 0.5, this.m23 * 0.5, 0);
    const dual = Quaternion.multiply(translation, r);
    return { real: r, dual: dual, scale: s };
  }
  testRotationPart(epsl?: number) {
    const v = this._v;
    if (epsl === undefined) epsl = 0.0001;
    for (let i = 0; i < 3; i++) {
      const t = v[i * 4] * v[i * 4] + v[i * 4 + 1] * v[i * 4 + 1] + v[i * 4 + 2] * v[i * 4 + 2];
      if (!numberEquals(t, 1, epsl)) {
        return false;
      }
      const q = v[i] * v[i] + v[4 + i] * v[4 + i] + v[8 + i] * v[8 + i];
      if (!numberEquals(q, 1, epsl)) {
        return false;
      }
    }
    return true;
  }
}
