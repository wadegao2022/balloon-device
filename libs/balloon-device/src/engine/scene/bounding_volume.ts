import {Frustum, AABB, Plane, ClipState, Vector3, Matrix4x4} from '../math';
import {AABBTree} from './aabbtree';

export function boundingvolume() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (constructor: any) {
    constructor.__tagcounter = 1;
    constructor._fetchTag = function () {
      return constructor.__tagcounter++;
    };
    constructor.prototype._tag = constructor._fetchTag();
    constructor.prototype.tag = function () {
      this._tag = constructor._fetchTag();
    };
    constructor.prototype.getTag = function () {
      return this._tag;
    };
  };
}

export interface BoundingVolume {
  tag(): void;
  getTag(): number;
  clone(): BoundingVolume;
  transform(matrix: Matrix4x4): BoundingVolume;
  behindPlane(plane: Plane): boolean;
  outsideFrustum(frustum: Frustum | Matrix4x4): boolean;
  toAABB(): AABB;
}

export interface BoundingBox extends BoundingVolume {}

@boundingvolume()
export class BoundingBox extends AABB {
  constructor();
  constructor(box: AABB);
  constructor(minPoint: Vector3, maxPoint: Vector3);
  constructor(arg0?: Vector3 | AABB, arg1?: Vector3) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    super(arg0 as any, arg1);
    this.minPoint.setChangeCallback(() => this.tag());
    this.maxPoint.setChangeCallback(() => this.tag());
  }
  clone(): BoundingVolume {
    return new BoundingBox(this);
  }
  transform(matrix: Matrix4x4): BoundingVolume {
    return new BoundingBox(AABB.transform(this, matrix));
  }
  outsideFrustum(frustum: Frustum | Matrix4x4): boolean {
    return (
      (frustum instanceof Frustum
        ? this.getClipStateWithFrustum(frustum)
        : this.getClipState(frustum)) === ClipState.NOT_CLIPPED
    );
  }
  toAABB(): AABB {
    return this;
  }
}

export interface BoundingBoxTree extends BoundingVolume {}

@boundingvolume()
export class BoundingBoxTree extends AABBTree {
  constructor();
  constructor(aabbtree: AABBTree);
  constructor(arg?: AABBTree) {
    super(arg);
  }
  clone(): BoundingVolume {
    return new BoundingBoxTree(this);
  }
  transform(matrix: Matrix4x4): BoundingVolume {
    const newBV = new BoundingBoxTree(this);
    newBV.transform(matrix);
    return newBV;
  }
  outsideFrustum(frustum: Frustum | Matrix4x4): boolean {
    const aabb = this.getTopLevelAABB();
    if (aabb) {
      return (
        (frustum instanceof Frustum
          ? aabb.getClipStateWithFrustum(frustum)
          : aabb.getClipState(frustum)) === ClipState.NOT_CLIPPED
      );
    } else {
      return false;
    }
  }
  toAABB(): AABB {
    return this.getTopLevelAABB();
  }
}
/*
export class BoundingFrustum implements BoundingVolume {
    protected _frustum: Frustum;
    constructor ();
    constructor (other: BoundingFrustum|Frustum|Matrix4x4);
    constructor (arg0?: BoundingFrustum|Frustum|Matrix4x4) {
        if (arg0 instanceof BoundingFrustum) {
            this._frustum = arg0._frustum ? new Frustum (arg0._frustum) : null;
        } else if (arg0 instanceof Frustum) {
            this._frustum = new Frustum (arg0);
        } else if (arg0 instanceof Matrix4x4) {
            this._frustum = new Frustum (arg0);
        } else {
            this._frustum = null;
        }
    }
    clone (): BoundingVolume {
        return new BoundingFrustum (this);
    }
    transform (matrix: Matrix4x4)
}
*/
