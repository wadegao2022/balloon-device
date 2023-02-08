import {Vector3, Vector4, Matrix4x4} from './vector';
import {BoxSide, ClipState} from './clip_test';
import {Plane} from './plane';
import {Frustum} from './frustum';

const ClipLeft = 1 << BoxSide.LEFT;
const ClipRight = 1 << BoxSide.RIGHT;
const ClipBottom = 1 << BoxSide.BOTTOM;
const ClipTop = 1 << BoxSide.TOP;
const ClipNear = 1 << BoxSide.FRONT;
const ClipFar = 1 << BoxSide.BACK;

export class AABB {
  /** @internal */
  private _minPoint: Vector3;
  /** @internal */
  private _maxPoint: Vector3;
  constructor();
  constructor(box: AABB);
  constructor(minPoint: Vector3, maxPoint: Vector3);
  constructor(arg0?: Vector3 | AABB, arg1?: Vector3) {
    if (arg0 instanceof AABB) {
      this._minPoint = new Vector3(arg0.minPoint);
      this._maxPoint = new Vector3(arg0.maxPoint);
    } else if (arg0 instanceof Vector3) {
      this._minPoint = new Vector3(arg0);
      this._maxPoint = new Vector3(arg1);
    } else {
      this._minPoint = new Vector3(0, 0, 0);
      this._maxPoint = new Vector3(0, 0, 0);
    }
  }
  get minPoint() {
    return this._minPoint;
  }
  set minPoint(p: Vector3) {
    this._minPoint.assign(p.getArray());
  }
  get maxPoint() {
    return this._maxPoint;
  }
  set maxPoint(p: Vector3) {
    this._maxPoint.assign(p.getArray());
  }
  get extents() {
    return Vector3.sub(this._maxPoint, this._minPoint).scaleBy(0.5);
  }
  get center() {
    return Vector3.add(this._maxPoint, this._minPoint).scaleBy(0.5);
  }
  get size() {
    return Vector3.sub(this._maxPoint, this._minPoint);
  }
  get diagonalLength() {
    return Vector3.sub(this._maxPoint, this._minPoint).magnitude;
  }
  computePoints(): Vector3[] {
    const { x: minx, y: miny, z: minz } = this._minPoint;
    const { x: maxx, y: maxy, z: maxz } = this._maxPoint;
    return [
      new Vector3(minx, miny, minz),
      new Vector3(minx, maxy, minz),
      new Vector3(maxx, miny, minz),
      new Vector3(maxx, maxy, minz),
      new Vector3(minx, miny, maxz),
      new Vector3(minx, maxy, maxz),
      new Vector3(maxx, miny, maxz),
      new Vector3(maxx, maxy, maxz),
    ];
  }
  inplaceTransform(matrix: Matrix4x4) {
    return AABB.transform(this, matrix, this);
  }
  beginExtend() {
    this._minPoint.set(
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    );
    this._maxPoint.set(
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    );
  }
  extend(v: Vector3|Vector4) {
    this._minPoint.inplaceMin(v);
    this._maxPoint.inplaceMax(v);
  }
  extend3(x: number, y: number, z: number) {
    if (x < this._minPoint.x) this._minPoint.x = x;
    if (x > this._maxPoint.x) this._maxPoint.x = x;
    if (y < this._minPoint.y) this._minPoint.y = y;
    if (y > this._maxPoint.y) this._maxPoint.y = y;
    if (z < this._minPoint.z) this._minPoint.z = z;
    if (z > this._maxPoint.z) this._maxPoint.z = z;
  }
  union(other: AABB) {
    if (other && other.isValid()) {
      this.extend(other._minPoint);
      this.extend(other._maxPoint);
    }
    return this;
  }
  isValid() {
    return (
      this._minPoint.x <= this._maxPoint.x &&
      this._minPoint.y <= this._maxPoint.y &&
      this._minPoint.z <= this._maxPoint.z
    );
  }
  equalsTo(other: AABB, epsl?: number) {
    return (
      this._minPoint.equalsTo(other._minPoint, epsl) &&
      this._maxPoint.equalsTo(other._maxPoint, epsl)
    );
  }
  intersectedWithBox(other: AABB): boolean {
    return !(
      this._maxPoint.x <= other._minPoint.x ||
      this._minPoint.x >= other._maxPoint.x ||
      this._maxPoint.y <= other._minPoint.y ||
      this._minPoint.y >= other._maxPoint.y ||
      this._maxPoint.z <= other._minPoint.z ||
      this._minPoint.z >= other._maxPoint.z
    );
  }
  containsPoint(pt: Vector3): boolean {
    return (
      this._minPoint.x <= pt.x &&
      this._maxPoint.x >= pt.x &&
      this._minPoint.y <= pt.y &&
      this._maxPoint.y >= pt.y &&
      this._minPoint.z <= pt.z &&
      this._maxPoint.z >= pt.z
    );
  }
  containsBox(other: AABB): boolean {
    return (
      this._minPoint.x <= other._minPoint.x &&
      this._maxPoint.x >= other._maxPoint.x &&
      this._minPoint.y <= other._minPoint.y &&
      this._maxPoint.y >= other._maxPoint.y &&
      this._minPoint.z <= other._minPoint.z &&
      this._maxPoint.z >= other._maxPoint.z
    );
  }
  getClipStateMask(viewProjMatrix: Matrix4x4, mask: number): ClipState {
    let andFlags = 0xffff;
    let orFlags = 0;
    const v0 = new Vector3();
    const v1 = new Vector4();
    const clipLeft = mask & ClipLeft;
    const clipRight = mask & ClipRight;
    const clipTop = mask & ClipTop;
    const clipBottom = mask & ClipBottom;
    const clipNear = mask & ClipNear;
    const clipFar = mask & ClipFar;
    const minPoint = this._minPoint;
    const maxPoint = this._maxPoint;
    for (let i = 0; i < 8; i++) {
      let clip = 0;
      v0.set(
        i & 1 ? minPoint.x : maxPoint.x,
        i & 2 ? minPoint.y : maxPoint.y,
        i & 3 ? minPoint.z : maxPoint.z,
      );
      viewProjMatrix.transformPoint(v0, v1);
      if (clipLeft && v1.x < -v1.w) {
        clip |= ClipLeft;
      } else if (clipRight && v1.x > v1.w) {
        clip |= ClipRight;
      }
      if (clipBottom && v1.y < -v1.w) {
        clip |= ClipBottom;
      } else if (clipTop && v1.y > v1.w) {
        clip |= ClipTop;
      }
      if (clipFar && v1.z < -v1.w) {
        clip |= ClipFar;
      } else if (clipNear && v1.z > v1.w) {
        clip |= ClipNear;
      }
      andFlags &= clip;
      orFlags |= clip;
    }
    if (orFlags === 0) {
      return ClipState.A_INSIDE_B;
    } else if (andFlags !== 0) {
      return ClipState.NOT_CLIPPED;
    } else {
      return ClipState.CLIPPED;
    }
  }
  getClipState(viewProjMatrix: Matrix4x4): ClipState {
    let andFlags = 0xffff;
    let orFlags = 0;
    const v0 = new Vector3();
    const v1 = new Vector4();
    const minPoint = this._minPoint;
    const maxPoint = this._maxPoint;
    for (let i = 0; i < 8; i++) {
      let clip = 0;
      v0.set(
        i & 1 ? minPoint.x : maxPoint.x,
        i & 2 ? minPoint.y : maxPoint.y,
        i & 3 ? minPoint.z : maxPoint.z,
      );
      viewProjMatrix.transformPoint(v0, v1);
      if (v1.x < -v1.w) {
        clip |= ClipLeft;
      } else if (v1.x > v1.w) {
        clip |= ClipRight;
      }
      if (v1.y < -v1.w) {
        clip |= ClipBottom;
      } else if (v1.y > v1.w) {
        clip |= ClipTop;
      }
      if (v1.z < -v1.w) {
        clip |= ClipFar;
      } else if (v1.z > v1.w) {
        clip |= ClipNear;
      }
      andFlags &= clip;
      orFlags |= clip;
    }
    if (orFlags === 0) {
      return ClipState.A_INSIDE_B;
    } else if (andFlags !== 0) {
      return ClipState.NOT_CLIPPED;
    } else {
      return ClipState.CLIPPED;
    }
  }
  behindPlane(p: Plane): boolean {
    const cx = (this._maxPoint.x + this._minPoint.x) * 0.5;
    const cy = (this._maxPoint.y + this._minPoint.y) * 0.5;
    const cz = (this._maxPoint.z + this._minPoint.z) * 0.5;
    const ex = this._maxPoint.x - cx;
    const ey = this._maxPoint.y - cy;
    const ez = this._maxPoint.z - cz;
    return p.a * (cx + p.px * ex) + p.b * (cy + p.py * ey) + p.c * (cz + p.pz * ez) + p.d < 0;
  }
  getClipStateWithFrustum(frustum: Frustum): ClipState {
    let badIntersect = false;
    const cx = (this._maxPoint.x + this._minPoint.x) * 0.5;
    const cy = (this._maxPoint.y + this._minPoint.y) * 0.5;
    const cz = (this._maxPoint.z + this._minPoint.z) * 0.5;
    const ex = this._maxPoint.x - cx;
    const ey = this._maxPoint.y - cy;
    const ez = this._maxPoint.z - cz;
    for (let i = 0; i < 6; i++) {
      const p = frustum.planes[i];
      if (p.a * (cx + p.px * ex) + p.b * (cy + p.py * ey) + p.c * (cz + p.pz * ez) + p.d < 0) {
        return ClipState.NOT_CLIPPED;
      }
      if (p.a * (cx + p.nx * ex) + p.b * (cy + p.ny * ey) + p.c * (cz + p.nz * ez) + p.d < 0) {
        badIntersect = true;
      }
    }
    return badIntersect ? ClipState.CLIPPED : ClipState.A_INSIDE_B;
  }
  getClipStateWithFrustumMask(frustum: Frustum, mask: number): ClipState {
    let badIntersect = false;
    const cx = (this._maxPoint.x + this._minPoint.x) * 0.5;
    const cy = (this._maxPoint.y + this._minPoint.y) * 0.5;
    const cz = (this._maxPoint.z + this._minPoint.z) * 0.5;
    const ex = this._maxPoint.x - cx;
    const ey = this._maxPoint.y - cy;
    const ez = this._maxPoint.z - cz;
    for (let i = 0; i < 6; i++) {
      if (mask & (1 << i)) {
        const p = frustum.planes[i];
        if (p.a * (cx + p.px * ex) + p.b * (cy + p.py * ey) + p.c * (cz + p.pz * ez) + p.d < 0) {
          return ClipState.NOT_CLIPPED;
        }
        if (p.a * (cx + p.nx * ex) + p.b * (cy + p.ny * ey) + p.c * (cz + p.nz * ez) + p.d < 0) {
          badIntersect = true;
        }
      }
    }
    return badIntersect ? ClipState.CLIPPED : ClipState.A_INSIDE_B;
  }
  static transform(bbox: AABB, matrix: Matrix4x4, result?: AABB): AABB {
    const ret = result || new AABB();
    const minp = [0, 0, 0];
    const maxp = [0, 0, 0];
    const m = matrix.getArray();
    const v1 = bbox.minPoint.getArray();
    const v2 = bbox.maxPoint.getArray();
    let r: number;
    for (let col = 0; col < 3; ++col) {
      r = col;
      minp[col] = maxp[col] = m[12 + col];
      for (let row = 0; row < 3; ++row) {
        const e = m[r] * v1[row];
        const f = m[r] * v2[row];
        if (e < f) {
          minp[col] += e;
          maxp[col] += f;
        } else {
          minp[col] += f;
          maxp[col] += e;
        }
        r += 4;
      }
    }
    ret.minPoint.assign(minp);
    ret.maxPoint.assign(maxp);
    return ret;
  }
}
