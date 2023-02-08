import { Vector3, Quaternion, Matrix4x4 } from './vector';
import { REventTarget, REvent, REventPathBuilder } from '../../shared';
import { BoundingVolume } from '../scene/bounding_volume';
import type { Scene } from '../scene/scene';

export class XFormChangeEvent extends REvent {
  static readonly NAME = 'xform_change';
  xform: XForm<any>;
  constructor(xform: XForm<any>) {
    super(XFormChangeEvent.NAME, true, false);
    this.xform = xform;
  }
}

export class XForm<T extends XForm<T> = XForm<any>> extends REventTarget {
  /** @internal */
  protected readonly _scene: Scene;
  /** @internal */
  protected _parent: T;
  /** @internal */
  protected _children: T[];
  /** @internal */
  protected _position: Vector3;
  /** @internal */
  protected _scaling: Vector3;
  /** @internal */
  protected _rotation: Quaternion;
  /** @internal */
  protected _localMatrix: Matrix4x4;
  /** @internal */
  protected _worldMatrix: Matrix4x4;
  /** @internal */
  protected _invWorldMatrix: Matrix4x4;
  /** @internal */
  protected _tmpLocalMatrix: Matrix4x4;
  /** @internal */
  protected _tmpWorldMatrix: Matrix4x4;
  /** @internal */
  protected _transformTag: number;
  /** @internal */
  protected _bv: BoundingVolume;
  /** @internal */
  protected _bvDirty: boolean;
  /** @internal */
  protected _bvWorld: BoundingVolume;
  /** @internal */
  private _changeEvent: XFormChangeEvent;
  constructor(scene: Scene, parent?: T, eventPathBuilder?: REventPathBuilder) {
    super(eventPathBuilder);
    this._scene = scene;
    this._parent = parent || null;
    this._children = [];
    this._position = Vector3.zero();
    this._position.setChangeCallback(() => this._transformCallback(true, true));
    this._scaling = Vector3.one();
    this._scaling.setChangeCallback(() => this._transformCallback(true, true));
    this._rotation = Quaternion.identity();
    this._rotation.setChangeCallback(() => this._transformCallback(true, true));
    this._worldMatrix = null;
    this._invWorldMatrix = null;
    this._localMatrix = null;
    this._transformTag = 0;
    this._tmpLocalMatrix = Matrix4x4.identity();
    this._tmpWorldMatrix = Matrix4x4.identity();
    this._bv = null;
    this._bvWorld = null;
    this._bvDirty = true;
    this._changeEvent = new XFormChangeEvent(this);
  }
  get scene(): Scene {
    return this._scene;
  }
  get parent() {
    return this._parent;
  }
  set parent(p: T) {
    p = p || null;
    if (p !== this._parent) {
      this._setParent(p);
    }
  }
  get children(): T[] {
    return this._children;
  }
  get position() {
    return this._position;
  }
  set position(t: Vector3) {
    if (t && this._position !== t) {
      this._position.assign(t.getArray());
    }
  }
  get scaling(): Vector3 {
    return this._scaling;
  }
  set scaling(s: Vector3 | number) {
    const v = typeof s === 'number' ? new Vector3(s, s, s) : s;
    if (!this._scaling.equalsTo(v)) {
      this._scaling.assign(v.getArray());
    }
  }
  get rotation() {
    return this._rotation;
  }
  set rotation(r: Quaternion) {
    if (r && r !== this._rotation) {
      this._rotation.assign(r.getArray());
    }
  }
  get localMatrix() {
    if (!this._localMatrix) {
      this._localMatrix = this._tmpLocalMatrix;
      this._localMatrix
        .scaling(this._scaling)
        .rotateLeft(new Matrix4x4(this._rotation))
        .translateLeft(this._position);
    }
    return this._localMatrix;
  }
  get worldMatrix() {
    if (!this._worldMatrix) {
      this._worldMatrix = this._tmpWorldMatrix;
      if (this._parent) {
        this._worldMatrix.assign(this._parent.worldMatrix.getArray()).multiplyRightAffine(this.localMatrix);
      } else {
        this._worldMatrix.assign(this.localMatrix.getArray());
      }
    }
    return this._worldMatrix;
  }
  get invWorldMatrix() {
    if (!this._invWorldMatrix) {
      this._invWorldMatrix = Matrix4x4.inverseAffine(this.worldMatrix);
    }
    return this._invWorldMatrix;
  }
  lookAt(eye: Vector3, target: Vector3, up: Vector3) {
    Matrix4x4.lookAt(eye, target, up).decompose(this.scaling, this.rotation, this.position);
    return this;
  }
  notifyChanged(invalidLocal: boolean, dispatch: boolean) {
    this._transformCallback(invalidLocal, dispatch);
  }
  computeBoundingVolume(bv: BoundingVolume): BoundingVolume {
    return bv;
  }
  getBoundingVolume(): BoundingVolume {
    if (this._bvDirty) {
      this._bv = this.computeBoundingVolume(this._bv) || null;
      this._bvDirty = false;
    }
    return this._bv;
  }
  setBoundingVolume(bv: BoundingVolume) {
    if (bv !== this._bv) {
      this._bv = bv;
      this.invalidateBoundingVolume();
    }
  }
  getWorldBoundingVolume(): BoundingVolume {
    if (!this._bvWorld) {
      this._bvWorld = this.getBoundingVolume()?.transform(this.worldMatrix) ?? null;
    }
    return this._bvWorld;
  }
  invalidateBoundingVolume() {
    this._bvDirty = true;
    this.invalidateWorldBoundingVolume();
  }
  invalidateWorldBoundingVolume() {
    this._bvWorld = null;
  }
  /** @internal */
  getTag(): number {
    return this._transformTag;
  }
  /** @internal */
  protected _setParent(p: T) {
    if (this._parent) {
      this._parent._children.splice(this._parent._children.indexOf(this as unknown as T), 1);
    }
    this._parent = p;
    if (this._parent) {
      this._parent._children.push(this as unknown as T);
    }
    this._transformCallback(false, true);
  }
  /** @internal */
  private _transformCallback(invalidLocal: boolean, dispatch: boolean) {
    if (invalidLocal) {
      this._localMatrix = null;
    }
    this._invalidateWorldMatrix();
    this.invalidateWorldBoundingVolume();
    if (dispatch) {
      this._changeEvent.reset();
      this.dispatchEvent(this._changeEvent);
    }
    for (const child of this._children) {
      child._transformCallback(false, dispatch);
    }
  }
  /** @internal */
  private _invalidateWorldMatrix() {
    this._worldMatrix = null;
    this._invWorldMatrix = null;
    this._transformTag++;
    for (const child of this._children) {
      child._invalidateWorldMatrix();
    }
  }
}
