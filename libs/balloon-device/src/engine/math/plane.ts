import { VectorBase, Vector3, IVector3Like, Vector4, Matrix4x4 } from './vector';

export class Plane extends VectorBase {
  /** @internal */
  private _px: number;
  /** @internal */
  private _py: number;
  /** @internal */
  private _pz: number;
  /** @internal */
  private _nx: number;
  /** @internal */
  private _ny: number;
  /** @internal */
  private _nz: number;
  /** @internal */
  private _npDirty: boolean;
  constructor();
  constructor(a: number, b: number, c: number, d: number);
  constructor(other: Plane);
  constructor(origin: IVector3Like, normal: IVector3Like);
  constructor(p0: IVector3Like, p1: IVector3Like, p2: IVector3Like);
  constructor(arg0?: unknown, arg1?: unknown, arg2?: unknown, arg3?: unknown) {
    super(4);
    switch (arguments.length) {
      case 0: {
        this._v[0] = 0;
        this._v[1] = 1;
        this._v[2] = 0;
        this._v[3] = 0;
        this._npDirty = true;
        break;
      }
      case 1: {
        this.assign((arg0 as Plane).getArray());
        break;
      }
      case 2: {
        this.initWithOriginNormal(arg0 as IVector3Like, arg1 as IVector3Like);
        break;
      }
      case 3: {
        this.initWithPoints(arg0 as IVector3Like, arg1 as IVector3Like, arg2 as IVector3Like);
        break;
      }
      case 4: {
        this.set(arg0 as number, arg1 as number, arg2 as number, arg3 as number);
        break;
      }
      default: {
        console.log('ERROR: Plane constructor must have 0/2/3/4 arguments');
      }
    }
  }
  get a() {
    return this._v[0];
  }
  set a(val: number) {
    this._v[0] = val;
    this._npDirty = true;
    this.changeNotify();
  }
  get b() {
    return this._v[1];
  }
  set b(val: number) {
    this._v[1] = val;
    this._npDirty = true;
    this.changeNotify();
  }
  get c() {
    return this._v[2];
  }
  set c(val: number) {
    this._v[2] = val;
    this._npDirty = true;
    this.changeNotify();
  }
  get d() {
    return this._v[3];
  }
  set d(val: number) {
    this._v[3] = val;
    this._npDirty = true;
    this.changeNotify();
  }
  get px() {
    if (this._npDirty) {
      this._npDirty = false;
      this._calcNP();
    }
    return this._px;
  }
  get py() {
    if (this._npDirty) {
      this._npDirty = false;
      this._calcNP();
    }
    return this._py;
  }
  get pz() {
    if (this._npDirty) {
      this._npDirty = false;
      this._calcNP();
    }
    return this._pz;
  }
  get nx() {
    if (this._npDirty) {
      this._npDirty = false;
      this._calcNP();
    }
    return this._nx;
  }
  get ny() {
    if (this._npDirty) {
      this._npDirty = false;
      this._calcNP();
    }
    return this._ny;
  }
  get nz() {
    if (this._npDirty) {
      this._npDirty = false;
      this._calcNP();
    }
    return this._nz;
  }
  assign(other: ArrayLike<number>) {
    this._npDirty = true;
    return super.assign(other);
  }
  set(a: number, b: number, c: number, d: number) {
    this._v[0] = a;
    this._v[1] = b;
    this._v[2] = c;
    this._v[3] = d;
    this._npDirty = true;
    this.changeNotify();
    return this;
  }
  initWithOriginNormal(origin: IVector3Like, normal: IVector3Like) {
    // assume normal is normalized
    return this.set(normal.x, normal.y, normal.z, -Vector3.dot(origin, normal));
  }
  initWithPoints(p0: IVector3Like, p1: IVector3Like, p2: IVector3Like) {
    const normal = Vector3.cross(Vector3.sub(p1, p0), Vector3.sub(p2, p0)).inplaceNormalize();
    return this.initWithOriginNormal(p0, normal);
  }
  distanceToPoint(p: IVector3Like): number {
    return p.x * this._v[0] + p.y * this._v[1] + p.z * this._v[2] + this._v[3];
  }
  nearestPointToPoint(p: IVector3Like, result?: Vector3): Vector3 {
    const d = this.distanceToPoint(p);
    return (result || new Vector3()).set(
      p.x - this._v[0] * d,
      p.y - this._v[1] * d,
      p.z - this._v[2] * d,
    );
  }
  getNormal(result?: Vector3): Vector3 {
    return (result || new Vector3()).set(this._v[0], this._v[1], this._v[2]);
  }
  inplaceFlip() {
    return Plane.flip(this, this);
  }
  inplaceNormalize() {
    return Plane.normalize(this, this);
  }
  static flip(plane: Plane, result?: Plane): Plane {
    const v = plane._v;
    return (result || new Plane()).set(-v[0], -v[1], -v[2], -v[3]);
  }
  static normalize(plane: Plane, result?: Plane): Plane {
    const v = plane._v;
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return (result || new Plane()).set(v[0] / len, v[1] / len, v[2] / len, v[3] / len);
  }
  static transform(plane: Plane, matrix: Matrix4x4, result?: Plane): Plane {
    const v = plane._v;
    const adjMatrix = Matrix4x4.transpose(Matrix4x4.inverseAffine(matrix));
    const p = adjMatrix.transform(new Vector4(v[0], v[1], v[2], v[3]));
    const ret: Plane = result || plane;
    ret.set(p.x, p.y, p.z, p.w);
    return ret.inplaceNormalize();
  }
  /** @internal */
  private _calcNP() {
    this._px = this._v[0] > 0 ? 1 : -1;
    this._py = this._v[1] > 0 ? 1 : -1;
    this._pz = this._v[2] > 0 ? 1 : -1;
    this._nx = -this._px;
    this._ny = -this._py;
    this._nz = -this._pz;
  }
}
