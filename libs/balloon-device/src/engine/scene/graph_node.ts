import { XForm, Frustum, Matrix4x4 } from '../math';
import { SceneNode } from './scene_node';
import { WorldBoundingVolume } from './world_bounding_volume';
import { Texture2D } from '../device';
import type { ListIterator } from '../../shared';
import type { BatchDrawable, Drawable } from './drawable';
import type { Scene } from './scene';
import type { Camera } from './camera';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class GraphNode extends SceneNode {
  static readonly ORDER_INHERITED = -1;
  static readonly ORDER_BACKGROUND = 0;
  static readonly ORDER_DEFAULT = 32;
  static readonly CLIP_INHERITED = -1;
  static readonly CLIP_DISABLED = 0;
  static readonly CLIP_ENABLED = 1;
  static readonly SHOW_INHERITED = -1;
  static readonly SHOW_HIDE = 0;
  static readonly SHOW_DEFAULT = 1;
  static readonly PICK_INHERITED = -1;
  static readonly PICK_DISABLED = 0;
  static readonly PICK_ENABLED = 1;
  static readonly BBOXDRAW_INHERITED = -1;
  static readonly BBOXDRAW_DISABLED = 0;
  static readonly BBOXDRAW_LOCAL = 1;
  static readonly BBOXDRAW_WORLD = 2;
  /** @internal */
  protected _clipMode: number;
  /** @internal */
  protected _renderOrder: number;
  /** @internal */
  protected _worldBoundingVolume: WorldBoundingVolume;
  /** @internal */
  protected _boxDrawMode: number;
  /** @internal */
  protected _visible: number;
  /** @internal */
  protected _pickMode: number;
  /** @internal */
  protected _lastRenderTimestamp: number;
  /** @internal */
  protected _lruIterator: ListIterator<Drawable>;
  constructor(scene: Scene, parent?: SceneNode) {
    super(scene, parent);
    this._clipMode = GraphNode.CLIP_ENABLED;
    this._worldBoundingVolume = null;
    this._boxDrawMode = GraphNode.BBOXDRAW_DISABLED;
    this._renderOrder = GraphNode.ORDER_DEFAULT;
    this._visible = GraphNode.SHOW_DEFAULT;
    this._pickMode = GraphNode.PICK_DISABLED;
    this._lastRenderTimestamp = 0;
    this._lruIterator = null;
  }
  get computedRenderOrder() {
    if (this._renderOrder === GraphNode.ORDER_INHERITED) {
      let parent = this.parent;
      while (parent && !parent.isGraphNode()) {
        parent = parent.parent;
      }
      return (parent as GraphNode)?.computedRenderOrder ?? GraphNode.ORDER_DEFAULT;
    }
    return this._renderOrder;
  }
  get renderOrder() {
    return this._renderOrder;
  }
  set renderOrder(val: number) {
    this._renderOrder = val;
  }
  get computedClipMode(): number {
    if (this._clipMode === GraphNode.CLIP_INHERITED) {
      let parent = this.parent;
      while (parent && !parent.isGraphNode()) {
        parent = parent.parent;
      }
      return (parent as GraphNode)?.computedClipMode ?? GraphNode.CLIP_ENABLED;
    }
    return this._clipMode;
  }
  get clipMode(): number {
    return this._clipMode;
  }
  set clipMode(val: number) {
    this._clipMode = val;
  }
  get computedShowState(): number {
    if (this._visible === GraphNode.SHOW_INHERITED) {
      let parent = this.parent;
      while (parent && !parent.isGraphNode()) {
        parent = parent.parent;
      }
      return (parent as GraphNode)?.computedShowState ?? GraphNode.SHOW_DEFAULT;
    }
    return this._visible;
  }
  get showState() {
    return this._visible;
  }
  set showState(val: number) {
    this._visible = val;
  }
  get computedPickMode(): number {
    if (this._pickMode === GraphNode.PICK_INHERITED) {
      let parent = this.parent;
      while (parent && !parent.isGraphNode()) {
        parent = parent.parent;
      }
      return (parent as GraphNode)?.computedPickMode ?? GraphNode.PICK_DISABLED;
    }
    return this._pickMode;
  }
  get pickMode(): number {
    return this._pickMode;
  }
  set pickMode(val: number) {
    this._pickMode = val;
  }
  get computedBoundingBoxDrawMode(): number {
    if (this._boxDrawMode === GraphNode.BBOXDRAW_INHERITED) {
      let parent = this.parent;
      while (parent && !parent.isGraphNode()) {
        parent = parent.parent;
      }
      return (parent as GraphNode)?.computedBoundingBoxDrawMode ?? GraphNode.BBOXDRAW_DISABLED;
    }
    return this._boxDrawMode;
  }
  get boundingBoxDrawMode(): number {
    return this._boxDrawMode;
  }
  set boundingBoxDrawMode(mode: number) {
    this._boxDrawMode = mode;
  }
  isGraphNode(): this is GraphNode {
    return true;
  }
  outsideFrustum(frustum: Frustum | Matrix4x4) {
    const bv = this.getBoundingVolume();
    return bv && bv.outsideFrustum(frustum);
  }
  getXForm(): XForm {
    return this;
  }
  getBoneMatrices(): Texture2D {
    return null;
  }
  getInvBindMatrix(): Matrix4x4 {
    return null;
  }
  getSortDistance(camera: Camera): number {
    const cameraWorldMatrix = camera.worldMatrix;
    const objectWorldMatrix = this.worldMatrix;
    const dx = cameraWorldMatrix.m03 - objectWorldMatrix.m03;
    const dy = cameraWorldMatrix.m13 - objectWorldMatrix.m13;
    const dz = cameraWorldMatrix.m23 - objectWorldMatrix.m23;
    return dx * dx + dy * dy * dz * dz;
  }
  setLastRenderTimestamp(ts: number): void {
    this._lastRenderTimestamp = ts;
  }
  getLastRenderTimeStamp(): number {
    return this._lastRenderTimestamp;
  }
  setLRUIterator(iter: ListIterator<Drawable>) {
    this._lruIterator = iter;
  }
  getLRUIterator(): ListIterator<Drawable> {
    return this._lruIterator;
  }
  isBatchable(): this is BatchDrawable {
    return false;
  }
}
