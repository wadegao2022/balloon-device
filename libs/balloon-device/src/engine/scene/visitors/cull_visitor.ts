import { ClipState, AABB } from '../../math';
import { Visitor, visitor } from '../../../shared';
import { GraphNode } from '../graph_node';
import { OctreeNode } from '../octree';
import { Mesh } from '../mesh';
import { Terrain } from '../terrain';
import { RenderQueue } from '../render_queue';
import { RENDER_PASS_TYPE_SHADOWMAP } from '../values';
import type { Camera } from '../camera';
import type { RenderPass } from '../renderers';
import type { Drawable } from '../drawable';

export class CullVisitor extends Visitor {
  /** @internal */
  private _camera: Camera;
  /** @internal */
  private _skipClipTest: boolean;
  /** @internal */
  private _renderQueue: RenderQueue;
  /** @internal */
  private _renderPass: RenderPass;
  /** @internal */
  private _postCullHook: (camera: Camera, drawable: Drawable, castShadow: boolean, clipState: ClipState, box: AABB) => boolean;
  constructor(renderPass: RenderPass, camera?: Camera) {
    super();
    this._camera = camera || null;
    this._renderQueue = new RenderQueue(renderPass);
    this._skipClipTest = false;
    this._renderPass = renderPass;
    this._postCullHook = null;
  }
  get camera() {
    return this._camera;
  }
  set camera(camera: Camera) {
    this._camera = camera || null;
  }
  get renderPass(): RenderPass {
    return this._renderPass;
  }
  get renderQueue() {
    return this._renderQueue;
  }
  get frustum() {
    return this._camera?.frustum || null;
  }
  get postCullHook(): (camera: Camera, drawable: Drawable, castShadow: boolean, clipState: ClipState, box: AABB) => boolean {
    return this._postCullHook;
  }
  set postCullHook(hook: (camera: Camera, drawable: Drawable, castShadow: boolean, clipState: ClipState, box: AABB) => boolean) {
    this._postCullHook = hook;
  }
  push(camera: Camera, drawable: Drawable, renderOrder: number, castShadow: boolean, clipState: ClipState, box: AABB) {
    if (!this._postCullHook || this._postCullHook(camera, drawable, castShadow, clipState, box)) {
      this.renderQueue.push(camera, drawable, renderOrder);
    }
  }
  @visitor(Terrain)
  visitTerrain(node: Terrain) {
    if (node.computedShowState !== GraphNode.SHOW_HIDE && (node.castShadow || this._renderPass.getRenderPassType() !== RENDER_PASS_TYPE_SHADOWMAP)) {
      const clipState = this.getClipState(node);
      if (clipState !== ClipState.NOT_CLIPPED) {
        if (node.cull(this)) {
          this.push(this._camera, node, node.computedRenderOrder, node.castShadow, clipState, node.getWorldBoundingVolume()?.toAABB());
        }
      }
    }
  }
  @visitor(Mesh)
  visitMesh(node: Mesh) {
    if (node.computedShowState !== GraphNode.SHOW_HIDE && (node.castShadow || this._renderPass.getRenderPassType() !== RENDER_PASS_TYPE_SHADOWMAP)) {
      const clipState = this.getClipState(node);
      if (clipState !== ClipState.NOT_CLIPPED) {
        this.push(this._camera, node, node.computedRenderOrder, node.castShadow, clipState, node.getWorldBoundingVolume()?.toAABB());
      }
    }
  }
  @visitor(OctreeNode)
  visitOctreeNode(node: OctreeNode) {
    const clipState =
      node.getLevel() > 0
        ? node.getBoxLoosed().getClipStateWithFrustum(this.frustum)
        : ClipState.CLIPPED;
    if (clipState !== ClipState.NOT_CLIPPED) {
      const saveSkipFlag = this._skipClipTest;
      this._skipClipTest = clipState === ClipState.A_INSIDE_B;
      const nodes = node.getNodes();
      for (let i = 0; i < nodes.length; i++) {
        this.visit(nodes[i]);
      }
      this._skipClipTest = saveSkipFlag;
      return true;
    }
    return false;
  }
  /** @internal */
  protected getClipState(node: GraphNode): ClipState {
    let clipState: ClipState;
    if (this._skipClipTest) {
      clipState = ClipState.A_INSIDE_B;
    } else if (node.computedClipMode === GraphNode.CLIP_DISABLED) {
      clipState = ClipState.CLIPPED;
    } else {
      const bv = node.getWorldBoundingVolume();
      clipState = bv ? bv.toAABB().getClipStateWithFrustum(this.frustum) : ClipState.CLIPPED;
    }
    return clipState;
  }
}
