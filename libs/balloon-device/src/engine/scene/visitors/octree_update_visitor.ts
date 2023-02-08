import type {Octree} from '../octree';
import {Visitor, visitor} from '../../../shared';
import {GraphNode} from '../graph_node';

export class OctreeUpdateVisitor extends Visitor {
  /** @internal */
  private _octree: Octree;
  constructor(octree: Octree) {
    super();
    this._octree = octree;
  }
  @visitor(GraphNode)
  visitGraphNode(node: GraphNode) {
    this._octree.placeNode(node);
  }
}
