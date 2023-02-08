import { Plane } from './plane';
import { Matrix4x4, Vector3 } from './vector';
import { BoxSide } from './clip_test';
import { BoundingBoxData } from './box_data';

export class Frustum {
  static readonly CORNER_LEFT_TOP_NEAR = 0;
  static readonly CORNER_LEFT_TOP_FAR = 1;
  static readonly CORNER_RIGHT_TOP_FAR = 2;
  static readonly CORNER_RIGHT_TOP_NEAR = 3;
  static readonly CORNER_LEFT_BOTTOM_NEAR = 4;
  static readonly CORNER_LEFT_BOTTOM_FAR = 5;
  static readonly CORNER_RIGHT_BOTTOM_FAR = 6;
  static readonly CORNER_RIGHT_BOTTOM_NEAR = 7;
  /** @internal */
  private _worldMatrix: Matrix4x4;
  /** @internal */
  private _viewProjMatrix: Matrix4x4;
  /** @internal */
  private _planes: Plane[];
  /** @internal */
  private _corners: Vector3[];
  /** @internal */
  private _matrixDirty: boolean;
  constructor();
  constructor(viewProjMatrix: Matrix4x4, worldMatrix?: Matrix4x4);
  constructor(other: Frustum);
  constructor(arg0?: Matrix4x4 | Frustum, arg1?: Matrix4x4) {
    this._planes = null;
    this._corners = null;
    if (arg0 instanceof Frustum) {
      this.setMatrix(arg0.viewProjectionMatrix, arg0.worldMatrix);
    } else {
      this.setMatrix(arg0, arg1);
    }
    this._viewProjMatrix.setChangeCallback(() => this._invalidate());
    this._worldMatrix.setChangeCallback(() => this._invalidate());
  }
  get worldMatrix() {
    return this._worldMatrix;
  }
  set worldMatrix(m: Matrix4x4) {
    this.setWorldMatrix(m);
  }
  setWorldMatrix(m: Matrix4x4) {
    this._worldMatrix = (this._worldMatrix || new Matrix4x4()).assign((m || Matrix4x4.identity()).getArray());
    this._invalidate();
    return this;
  }
  get viewProjectionMatrix() {
    return this._viewProjMatrix;
  }
  set viewProjectionMatrix(m: Matrix4x4) {
    this.setViewProjectionMatrix(m);
  }
  setViewProjectionMatrix(m: Matrix4x4) {
    this._viewProjMatrix = (this._viewProjMatrix || new Matrix4x4()).assign(
      (m || Matrix4x4.identity()).getArray(),
    );
    this._invalidate();
    return this;
  }
  setMatrix(viewProjMatrix: Matrix4x4, worldMatrix: Matrix4x4) {
    this.setViewProjectionMatrix(viewProjMatrix);
    this.setWorldMatrix(worldMatrix);
    return this;
  }
  transform(m: Matrix4x4) {
    if (m) {
      this._worldMatrix.multiplyLeft(m);
      this._matrixDirty = true;
    }
    return this;
  }
  get planes() {
    if (this._matrixDirty) {
      this._matrixDirty = false;
      this._initWithMatrix();
    }
    return this._planes;
  }
  get corners() {
    if (this._matrixDirty) {
      this._matrixDirty = false;
      this._initWithMatrix();
    }
    return this._corners;
  }
  getCorner(pos: number) {
    return this.corners[pos];
  }
  /** @internal */
  private _invalidate() {
    this._matrixDirty = true;
  }
  /** @internal */
  private _initWithMatrix() {
    const matrix = Matrix4x4.multiply(this._viewProjMatrix, this._worldMatrix);
    this._planes = this._planes || Array.from({ length: 6 }).map(() => new Plane());
    this._planes[BoxSide.LEFT]
      .set(
        matrix.m30 + matrix.m00,
        matrix.m31 + matrix.m01,
        matrix.m32 + matrix.m02,
        matrix.m33 + matrix.m03,
      )
      .inplaceNormalize();
    this._planes[BoxSide.RIGHT]
      .set(
        matrix.m30 - matrix.m00,
        matrix.m31 - matrix.m01,
        matrix.m32 - matrix.m02,
        matrix.m33 - matrix.m03,
      )
      .inplaceNormalize();
    this._planes[BoxSide.BOTTOM]
      .set(
        matrix.m30 + matrix.m10,
        matrix.m31 + matrix.m11,
        matrix.m32 + matrix.m12,
        matrix.m33 + matrix.m13,
      )
      .inplaceNormalize();
    this._planes[BoxSide.TOP]
      .set(
        matrix.m30 - matrix.m10,
        matrix.m31 - matrix.m11,
        matrix.m32 - matrix.m12,
        matrix.m33 - matrix.m13,
      )
      .inplaceNormalize();
    this._planes[BoxSide.FRONT]
      .set(
        matrix.m30 + matrix.m20,
        matrix.m31 + matrix.m21,
        matrix.m32 + matrix.m22,
        matrix.m33 + matrix.m23,
      )
      .inplaceNormalize();
    this._planes[BoxSide.BACK]
      .set(
        matrix.m30 - matrix.m20,
        matrix.m31 - matrix.m21,
        matrix.m32 - matrix.m22,
        matrix.m33 - matrix.m23,
      )
      .inplaceNormalize();
    const invMatrix = Matrix4x4.inverse(matrix);
    const ndcVertices: Vector3[] = BoundingBoxData.ndcVertices.map(
      (v) => new Vector3(v[0], v[1], v[2]),
    );
    this._corners = this._corners || [];
    for (let i = 0; i < 8; i++) {
      const v = invMatrix.transformPoint(ndcVertices[i]);
      this._corners[i] = v.scaleBy(1 / v.w).xyz();
    }
    return this;
  }
  containsPoint(pt: Vector3): boolean {
    for (const p of this.planes) {
      if (p.distanceToPoint(pt) < 0) {
        return false;
      }
    }
    return true;
  }
}
