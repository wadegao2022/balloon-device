import { Ray } from '../../math';
import { Visitor, visitor } from '../../../shared';
import { GraphNode } from '../graph_node';
import { OctreeNode } from '../octree';
import { Mesh } from '../mesh';
import { Terrain } from '../terrain';

export class RaycastVisitor extends Visitor {
  /** @internal */
  private _ray: Ray;
  /** @internal */
  private _rayLocal: Ray;
  /** @internal */
  private _intersected: GraphNode;
  /** @internal */
  private _intersectedDist: number;
  constructor(ray: Ray) {
    super();
    this._ray = ray;
    this._rayLocal = new Ray();
    this._intersected = null;
    this._intersectedDist = Infinity;
  }

  get intersected(): GraphNode {
    return this._intersected;
  }

  @visitor(Terrain)
  visitTerrain(node: Terrain) {
    if (node.computedShowState !== GraphNode.SHOW_HIDE && node.computedPickMode !== GraphNode.PICK_DISABLED) {
      this._ray.transform(node.invWorldMatrix, this._rayLocal);
      const d = this._rayLocal.bboxIntersectionTestEx(node.getBoundingVolume().toAABB());
      if (d !== null && d < this._intersectedDist) {
        this._intersectedDist = d;
        this._intersected = node;
      }
    }
  }
  @visitor(Mesh)
  visitMesh(node: Mesh) {
    if (node.computedShowState !== GraphNode.SHOW_HIDE && node.computedPickMode !== GraphNode.PICK_DISABLED) {
      this._ray.transform(node.invWorldMatrix, this._rayLocal);
      const d = this._rayLocal.bboxIntersectionTestEx(node.getBoundingVolume().toAABB());
      if (d !== null && d < this._intersectedDist) {
        this._intersectedDist = d;
        this._intersected = node;
      }
    }
  }
  @visitor(OctreeNode)
  visitOctreeNode(node: OctreeNode) {
    if (node.getLevel() === 0 || this._ray.bboxIntersectionTest(node.getBoxLoosed()) !== null) {
      const nodes = node.getNodes();
      for (let i = 0; i < nodes.length; i++) {
        this.visit(nodes[i]);
      }
      return true;
    }
    return false;
  }
}
