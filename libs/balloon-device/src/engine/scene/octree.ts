import { Visitor, assert } from '../../shared';
import { Vector3, AABB } from '../math';
import type { SceneNode } from './scene_node';
import { GraphNode } from './graph_node';
import type { Scene } from './scene';

export enum OctreePlacement {
  PPP = 0,
  PPN = 1,
  PNP = 2,
  PNN = 3,
  NPP = 4,
  NPN = 5,
  NNP = 6,
  NNN = 7,
}
export class OctreeNode {
  /** @internal */
  private _chunk: OctreeNodeChunk;
  /** @internal */
  private _position: number;
  /** @internal */
  private _references: number;
  /** @internal */
  private _nodes: GraphNode[];
  /** @internal */
  private _box: AABB;
  /** @internal */
  private _boxLoosed: AABB;
  constructor() {
    this._chunk = null;
    this._position = 0;
    this._references = 0;
    this._nodes = [];
    this._box = null;
    this._boxLoosed = null;
  }
  getNodes(): GraphNode[] {
    return this._nodes;
  }
  getLevel() {
    return this._chunk.getLevel();
  }
  addNode(node: GraphNode) {
    if (node && this._nodes.indexOf(node) < 0) {
      this._nodes.push(node);
    }
  }
  removeNode(node: GraphNode) {
    const index = this._nodes.indexOf(node);
    if (index >= 0) {
      this._nodes.splice(index, 1);
    }
  }
  clearNodes() {
    this._nodes = [];
  }
  setChunk(chunk: OctreeNodeChunk) {
    assert(!!chunk, 'Invalid chunk', true);
    this._chunk = chunk;
  }
  getChunk(): OctreeNodeChunk {
    return this._chunk;
  }
  setPosition(index: number) {
    this._position = index;
  }
  getPosition(): number {
    return this._position;
  }
  invalidateBox(): void {
    this._box = null;
    this.getParent()?.invalidateBox();
  }
  getBox() {
    if (this._box === null) {
      const box = new AABB();
      box.beginExtend();
      for (let i = 0; i < 8; i++) {
        const child = this.getChild(i);
        if (child) {
          const childBox = child.getBox();
          if (childBox) {
            box.extend(childBox.minPoint);
            box.extend(childBox.maxPoint);
          }
        }
      }
      for (const node of this._nodes) {
        if (!node.isLight()) {
          const bv = node.getWorldBoundingVolume()?.toAABB();
          if (bv) {
            box.extend(bv.minPoint);
            box.extend(bv.maxPoint);
          }
        }
      }
      if (box.isValid()) {
        this._box = box;
      }
    }
    return this._box;
  }
  getBoxLoosed(): AABB {
    if (this._boxLoosed === null) {
      assert(!!this._chunk, 'Invalid chunk', true);
      const d = this._chunk.getDimension();
      const nodeSize = this._chunk.getNodeSize();
      const halfWorldSize = this._chunk.getWorldSize() * 0.5;
      const px = this._position % d;
      const py = Math.floor(this._position / d) % d;
      const pz = Math.floor(Math.floor(this._position / d) / d);
      const minPoint = new Vector3(px - 0.5, py - 0.5, pz - 0.5)
        .scaleBy(nodeSize)
        .subBy(new Vector3(halfWorldSize, halfWorldSize, halfWorldSize));
      const maxPoint = new Vector3(
        minPoint.x + nodeSize * 2,
        minPoint.y + nodeSize * 2,
        minPoint.z + nodeSize * 2,
      );
      this._boxLoosed = new AABB(minPoint, maxPoint);
    }
    return this._boxLoosed;
  }
  getMinPoint(): Vector3 {
    assert(!!this._chunk, 'Invalid chunk', true);
    const d = this._chunk.getDimension();
    const nodeSize = this._chunk.getNodeSize();
    const halfWorldSize = this._chunk.getWorldSize() * 0.5;
    const px = this._position % d;
    const py = Math.floor(this._position / d) % d;
    const pz = Math.floor(Math.floor(this._position / d) / d);
    return new Vector3(px, py, pz)
      .scaleBy(nodeSize)
      .subBy(new Vector3(halfWorldSize, halfWorldSize, halfWorldSize));
  }
  getMaxPoint(): Vector3 {
    assert(!!this._chunk, 'Invalid chunk', true);
    const d = this._chunk.getDimension();
    const nodeSize = this._chunk.getNodeSize();
    const halfWorldSize = this._chunk.getWorldSize() * 0.5;
    const px = (this._position % d) + 1;
    const py = (Math.floor(this._position / d) % d) + 1;
    const pz = Math.floor(Math.floor(this._position / d) / d) + 1;
    return new Vector3(px, py, pz)
      .scaleBy(nodeSize)
      .subBy(new Vector3(halfWorldSize, halfWorldSize, halfWorldSize));
  }
  getMinPointLoosed(): Vector3 {
    const halfNodeSize = this._chunk.getNodeSize() * 0.5;
    return this.getMinPoint().subBy(new Vector3(halfNodeSize, halfNodeSize, halfNodeSize));
  }
  getMaxPointLoosed(): Vector3 {
    const halfNodeSize = this._chunk.getNodeSize() * 0.5;
    return this.getMaxPoint().addBy(new Vector3(halfNodeSize, halfNodeSize, halfNodeSize));
  }
  getReference(): number {
    return this._references;
  }
  getChild(placement: OctreePlacement): OctreeNode {
    assert(!!this._chunk, 'Invalid chunk', true);
    const next = this._chunk.getNext();
    return next ? next.getNode(this._chunk.getChildIndex(this._position, placement)) : null;
  }
  getOrCreateChild(placement: OctreePlacement): OctreeNode {
    assert(!!this._chunk, 'Invalid chunk', true);
    const next = this._chunk.getNext();
    return next ? next.getOrCreateNode(this._chunk.getChildIndex(this._position, placement)) : null;
  }
  getParent(): OctreeNode {
    assert(!!this._chunk, 'Invalid chunk', true);
    const prev = this._chunk.getPrev();
    return prev ? prev.getNode(this._chunk.getParentIndex(this._position)) : null;
  }
  getOrCreateParent(): OctreeNode {
    assert(!!this._chunk, 'Invalid chunk', true);
    const prev = this._chunk.getPrev();
    return prev ? prev.getOrCreateNode(this._chunk.getParentIndex(this._position)) : null;
  }
  createChildren() {
    this.getOrCreateChild(OctreePlacement.PPP);
    this.getOrCreateChild(OctreePlacement.PPN);
    this.getOrCreateChild(OctreePlacement.PNP);
    this.getOrCreateChild(OctreePlacement.PNN);
    this.getOrCreateChild(OctreePlacement.NPP);
    this.getOrCreateChild(OctreePlacement.NPN);
    this.getOrCreateChild(OctreePlacement.NNP);
    this.getOrCreateChild(OctreePlacement.NNN);
  }
  tidy(): boolean {
    this._references = 8;
    for (let i = 0; i < 8; i++) {
      const node = this.getChild(i);
      if (!node || node.tidy()) {
        --this._references;
      }
    }
    if (this._nodes.length === 0 && this._references === 0) {
      this._chunk.freeNodeByIndex(this._position);
      return true;
    }
    return false;
  }
  accept(v: Visitor) {
    v.visit(this);
  }
  traverse(v: Visitor) {
    if (v.visit(this)) {
      for (let i = 0; i < 8; i++) {
        const child = this.getChild(i);
        if (child) {
          child.traverse(v);
        }
      }
    }
  }
}

export class OctreeNodeChunk {
  /** @internal */
  private _level: number;
  /** @internal */
  private _dimension: number;
  /** @internal */
  private _nodeSize: number;
  /** @internal */
  private _looseSize: number;
  /** @internal */
  private _prev: OctreeNodeChunk;
  /** @internal */
  private _next: OctreeNodeChunk;
  /** @internal */
  private _octree: Octree;
  /** @internal */
  private _nodeMap: Map<number, OctreeNode>;
  constructor(octree: Octree) {
    this._octree = octree;
    this._level = 0;
    this._dimension = 0;
    this._nodeSize = 0;
    this._looseSize = 0;
    this._next = null;
    this._prev = null;
    this._nodeMap = new Map();
  }
  getNode(index: number): OctreeNode {
    return this._nodeMap.get(index) || null;
  }
  getOrCreateNode(index: number): OctreeNode {
    let node = this.getNode(index);
    if (!node) {
      node = new OctreeNode();
      node.setChunk(this);
      node.setPosition(index);
      this._nodeMap.set(index, node);
    }
    return node;
  }
  getOrCreateNodeChain(index: number): OctreeNode {
    const node = this.getOrCreateNode(index);
    if (this._prev) {
      this._prev.getOrCreateNodeChain(this.getParentIndex(index));
    }
    return node;
  }
  freeNodeByIndex(index: number) {
    const node = this._nodeMap.get(index);
    if (node) {
      node.clearNodes();
      this._nodeMap.delete(index);
    }
  }
  freeNode(node: OctreeNode) {
    if (node) {
      assert(node.getChunk() === this, 'Invalid chunk', true);
      this.freeNodeByIndex(node.getPosition());
    }
  }
  clearNodes() {
    for (const key of this._nodeMap.keys()) {
      this._nodeMap.get(key).clearNodes();
      this._nodeMap.delete(key);
    }
  }
  getChildIndex(index: number, placement: OctreePlacement): number {
    const dim = this._dimension;
    let px = 2 * (index % dim);
    let py = 2 * (Math.floor(index / dim) % dim);
    let pz = 2 * Math.floor(Math.floor(index / dim) / dim);
    switch (placement) {
      case OctreePlacement.PPP:
        ++px;
        ++py;
        ++pz;
        break;
      case OctreePlacement.PPN:
        ++px;
        ++py;
        break;
      case OctreePlacement.PNP:
        ++px;
        ++pz;
        break;
      case OctreePlacement.PNN:
        ++px;
        break;
      case OctreePlacement.NPP:
        ++py;
        ++pz;
        break;
      case OctreePlacement.NPN:
        ++py;
        break;
      case OctreePlacement.NNP:
        ++pz;
        break;
      case OctreePlacement.NNN:
        break;
      default:
        assert(false, 'getChildIndex: Got invalid index', true);
        return 0;
    }
    const dimension2 = 2 * dim;
    return pz * dimension2 * dimension2 + py * dimension2 + px;
  }
  getParentIndex(index: number): number {
    const dim = this._dimension;
    const px = index % dim >> 1;
    const py = Math.floor(index / dim) % dim >> 1;
    const pz = Math.floor(Math.floor(index / dim) / dim) >> 1;
    const d = dim >> 1;
    return px + py * d + pz * d * d;
  }
  getNodeSize(): number {
    return this._nodeSize;
  }
  getNodeSizeLoosed(): number {
    return this._looseSize;
  }
  getWorldSize(): number {
    return this._octree.getRootSize();
  }
  getDimension(): number {
    return this._dimension;
  }
  getLevel(): number {
    return this._level;
  }
  empty(): boolean {
    return this._nodeMap.size === 0;
  }
  getNext(): OctreeNodeChunk {
    return this._next;
  }
  getPrev(): OctreeNodeChunk {
    return this._prev;
  }
  getOctree(): Octree {
    return this._octree;
  }
  setLevel(level: number) {
    this._level = level;
  }
  setDimension(dimension: number) {
    this._dimension = dimension;
  }
  setNodeSize(size: number) {
    this._nodeSize = size;
  }
  setNodeSizeLoosed(size: number) {
    this._looseSize = size;
  }
  setNext(chunk: OctreeNodeChunk) {
    this._next = chunk;
  }
  setPrev(chunk: OctreeNodeChunk) {
    this._prev = chunk;
  }
}

export class Octree {
  /** @internal */
  private _scene: Scene;
  /** @internal */
  private _chunks: OctreeNodeChunk[];
  /** @internal */
  private _rootSize: number;
  /** @internal */
  private _leafSize: number;
  /** @internal */
  private _rootNode: OctreeNode;
  /** @internal */
  private _nodeMap: WeakMap<GraphNode, OctreeNode>;
  constructor(scene: Scene, rootSize = 4096, leafSize = 64) {
    this._scene = scene;
    this._chunks = [];
    this._rootSize = 0;
    this._leafSize = 0;
    this._rootNode = null;
    this._nodeMap = new WeakMap();
    this.initialize(rootSize, leafSize);
  }
  initialize(rootSize: number, leafSize: number) {
    assert(rootSize >= leafSize && leafSize > 0, 'Invalid rootSize or leafSize for octree', true);
    this.finalize();
    this._rootSize = rootSize;
    this._leafSize = leafSize;
    let n = 1;
    for (; rootSize >= leafSize * 2; leafSize *= 2, ++n);
    for (let i = 0; i < n; ++i, rootSize *= 0.5) {
      const chunk = new OctreeNodeChunk(this);
      chunk.setLevel(i);
      chunk.setNodeSize(rootSize);
      chunk.setNodeSizeLoosed(rootSize * 1.5);
      chunk.setDimension(1 << i);
      this._chunks.push(chunk);
      if (i > 0) {
        this._chunks[i - 1].setNext(chunk);
        chunk.setPrev(this._chunks[i - 1]);
      }
    }
  }
  finalize() {
    this._chunks = [];
    this._rootSize = 0;
    this._leafSize = 0;
    this._rootNode = null;
    this._nodeMap = new WeakMap();
  }
  getScene(): Scene {
    return this._scene;
  }
  getRootSize(): number {
    return this._rootSize;
  }
  getLeafSize(): number {
    return this._leafSize;
  }
  locateNodeChain(candidate: OctreeNode, center: Vector3, radius: number) {
    let level = this._chunks.length - 1;
    while (level && this._chunks[level].getNodeSize() < 4 * radius) {
      --level;
    }
    const dim = this._chunks[level].getDimension();
    const inv_node_size = 1 / this._chunks[level].getNodeSize();
    let px = Math.floor((center.x + this._rootSize * 0.5) * inv_node_size);
    let py = Math.floor((center.y + this._rootSize * 0.5) * inv_node_size);
    let pz = Math.floor((center.z + this._rootSize * 0.5) * inv_node_size);
    if (px >= dim || py >= dim || pz >= dim) {
      level = 0;
      px = 0;
      py = 0;
      pz = 0;
    }
    const index = px + py * dim + pz * dim * dim;
    if (
      candidate &&
      candidate.getChunk().getLevel() === level &&
      candidate.getPosition() === index
    ) {
      return candidate;
    }
    return this._chunks[level].getOrCreateNodeChain(index);
  }
  getRootNode(): OctreeNode {
    if (!this._rootNode) {
      this._rootNode = this._chunks[0].getOrCreateNode(0);
    }
    return this._rootNode;
  }
  getNumChunks(): number {
    return this._chunks.length;
  }
  getChunk(level: number): OctreeNodeChunk {
    return this._chunks[level];
  }
  placeNode(node: SceneNode) {
    if (node.isGraphNode()) {
      const curNode = this._nodeMap.get(node) || null;
      let locatedNode: OctreeNode = this.getRootNode();
      if (node.computedClipMode === GraphNode.CLIP_ENABLED) {
        const bbox = node.getWorldBoundingVolume()?.toAABB();
        if (bbox && bbox.isValid()) {
          const center = bbox.center;
          const extents = bbox.extents;
          const size = Math.max(Math.max(extents.x, extents.y), extents.z);
          locatedNode = this.locateNodeChain(curNode, center, size) || this.getRootNode();
        }
      }
      if (curNode !== locatedNode) {
        curNode?.removeNode(node);
        locatedNode?.addNode(node);
        this._nodeMap.set(node, locatedNode);
        curNode?.invalidateBox();
        locatedNode?.invalidateBox();
      }
    }
    for (const child of node.children) {
      this.placeNode(child);
    }
  }
  removeNode(node: SceneNode) {
    if (node.isGraphNode()) {
      const curNode = this._nodeMap.get(node) || null;
      if (curNode) {
        curNode.removeNode(node);
        curNode.invalidateBox();
        this._nodeMap.delete(node);
      }
    }
    for (const child of node.children) {
      this.removeNode(child);
    }
  }
}
