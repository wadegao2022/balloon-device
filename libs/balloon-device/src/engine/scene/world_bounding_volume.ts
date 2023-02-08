import type {BoundingVolume} from './bounding_volume';
import type {SceneNode} from './scene_node';

export class WorldBoundingVolume {
  /** @internal */
  private static _tagCounter = 1;
  /** @internal */
  private _node: SceneNode;
  /** @internal */
  private _local: BoundingVolume;
  /** @internal */
  private _world: BoundingVolume;
  /** @internal */
  private _transformTag: number;
  /** @internal */
  private _bvTag: number;
  /** @internal */
  private _tag: number;
  constructor(local: BoundingVolume, node: SceneNode) {
    this._world = this._local = local || null;
    this._node = node || null;
    this._transformTag = 0;
    this._bvTag = this._local ? this._local.getTag() : 0;
    this._tag = 0;
  }
  /*
  getLocal(): BoundingVolume {
    return this._local;
  }
  setLocal(local: BoundingVolume) {
    if (this._local !== local) {
      this._local = local || null;
      this._bvTag = 0;
    }
  }
  getBoundingVolume(): BoundingVolume {
    this.sync();
    return this._world;
  }
  tag() {
    this._tag = WorldBoundingVolume._fetchTag();
  }
  getTag() {
    this.sync();
    return this._tag;
  }
  sync() {
    if (this._local && this._node) {
      const worldTag = this._node.getTag();
      const bvTag = this._local.getTag();
      if (this._transformTag < worldTag || this._bvTag < bvTag) {
        this._world = this._local.transform(this._node.worldMatrix);
        this._transformTag = worldTag;
        this._bvTag = bvTag;
        this.tag();
      }
    } else {
      this._world = null;
    }
  }
  */
  /** @internal */
  private static _fetchTag() {
    return this._tagCounter++;
  }
}
