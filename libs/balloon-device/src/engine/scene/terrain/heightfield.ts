import { Vector3, Vector4 } from "../../math";
import { BoundingBox } from "../bounding_volume";

/*
function intersectRayTriangle (start: Vector3, normal: Vector3, v1: Vector3, v2: Vector3, v3: Vector3, cull: boolean): number {
  const edge1 = Vector3.sub(v2, v1);
  const edge2 = Vector3.sub(v3, v1);
  const pvec = Vector3.cross(normal, edge2);
  const det = Vector3.dot(edge1, pvec);
  if (!cull) {
    if (numberEquals(det, 0, 0.00001)) {
      return null;
    }
    const inv_det = 1 / det;
    const tvec = Vector3.sub(start, v1);
    const u = inv_det * Vector3.dot(tvec, pvec);
    if (u < 0 || u > 1) {
      return null;
    }
    const qvec = Vector3.cross(tvec, edge1);
    const v = inv_det * Vector3.dot(normal, qvec);
    if (v < 0 || u + v > 1) {
      return null;
    }
    return Vector3.dot(edge2, qvec) * inv_det;
  } else {
    if (det < 0) {
      return null;
    }
    const tvec = Vector3.sub(start, v1);
    const u = Vector3.dot(tvec, pvec);
    if (u < 0 || u > det) {
      return null;
    }
    const qvec = Vector3.cross(tvec, edge1);
    const v = Vector3.dot(normal, qvec);
    if (v < 0 || u + v > det) {
      return null;
    }
    return Vector3.dot(edge2, qvec) / det;
  }
}
*/

export interface HeightfieldBBoxTreeNode {
  bbox: BoundingBox;
  rc: { x: number, y: number, w: number, h: number };
  left: HeightfieldBBoxTreeNode;
  right: HeightfieldBBoxTreeNode;
}

export class HeightfieldBBoxTree {
  private _resX: number;
  private _resY: number;
  private _heights: Float32Array;
  private _rootNode: HeightfieldBBoxTreeNode;
  private _patchSize: number;
  constructor(res_x: number, res_y: number, vertices: Vector4[], patchSize: number) {
    this._rootNode = null;
    this._heights = null;
    this._patchSize = patchSize;
    this.create(res_x, res_y, vertices);
  }
  create(res_x: number, res_y: number, vertices: Vector4[]): boolean {
    this._resX = res_x;
    this._resY = res_y;
    this._rootNode = this.allocNode();
    this._heights = new Float32Array(res_x * res_y);
    for (let i = 0; i < this._heights.length; i++) {
      this._heights[i] = vertices[i].y;
    }
    this.createChildNode(this._rootNode, 0, 0, res_x, res_y, vertices);
    return true;
  }
  getHeight(x: number, y: number): number {
    return this._heights[(this._resY - 1 - y) * this._resX + x];
  }
  getRealHeight(x: number, y: number): number {
    x -= this._rootNode.bbox.minPoint.x;
    y -= this._rootNode.bbox.minPoint.z;
    const tileSizeX = (this._rootNode.bbox.maxPoint.x - this._rootNode.bbox.minPoint.x) / (this._resX - 1);
    const tileSizeY = (this._rootNode.bbox.maxPoint.z - this._rootNode.bbox.minPoint.z) / (this._resY - 1);
    const x_unscale = x / tileSizeX;
    const y_unscale = y / tileSizeY;
    let l = Math.floor(x_unscale);
    let t = Math.floor(y_unscale);
    let r = l + 1;
    let b = t + 1;
    if (l < 0) {
      l = 0;
    }
    if (t < 0) {
      t = 0;
    }
    if (r >= this._resX) {
      r = this._resX - 1;
    }
    if (b >= this._resY) {
      b = this._resY - 1;
    }
    if (l === r) {
      if (t === b) {
        return this.getHeight(l, t);
      } else {
        const ht = this.getHeight(l, t);
        const hb = this.getHeight(l, b);
        return ht + (hb - ht) * (y_unscale - t);
      }
    } else {
      const hlt = this.getHeight(l, t);
      const hrt = this.getHeight(r, t);
      const ht = hlt + (hrt - hlt) * (x_unscale - l);
      if (t === b) {
        return ht;
      } else {
        const hlb = this.getHeight(l, b);
        const hrb = this.getHeight(r, b);
        const hb = hlb + (hrb - hlb) * (x_unscale - l);
        return ht + (hb - ht) * (y_unscale - t);
      }
    }
  }
  getRootNode(): HeightfieldBBoxTreeNode {
    return this._rootNode;
  }
  getHeights(): Float32Array {
    return this._heights;
  }
  allocNode(): HeightfieldBBoxTreeNode {
    return {
      bbox: new BoundingBox(),
      rc: { x: 0, y: 0, w: 0, h: 0 },
      left: null,
      right: null,
    };
  }
  computeNodeBoundingBox(node: HeightfieldBBoxTreeNode, bbox: BoundingBox, vertices: Vector4[]) {
    bbox.beginExtend();
    for (let i = 0; i < node.rc.w; i++) {
      for (let j = 0; j < node.rc.h; j++) {
        const index = node.rc.x + i + (node.rc.y + j) * this._resX;
        bbox.extend(vertices[index])
      }
    }
  }
  createChildNode(node: HeightfieldBBoxTreeNode, x: number, y: number, w: number, h: number, vertices: Vector4[]): boolean {
    node.rc.x = x;
    node.rc.y = y;
    node.rc.w = w;
    node.rc.h = h;
    if (w <= this._patchSize && h <= this._patchSize) {
      node.left = null;
      node.right = null;
      this.computeNodeBoundingBox(node, node.bbox, vertices);
    } else {
      if (w >= h) {
        const w1 = (w + 1) >> 1;
        const w2 = w - w1 + 1;
        node.left = this.allocNode();
        this.createChildNode(node.left, x, y, w1, h, vertices);
        node.right = this.allocNode();
        this.createChildNode(node.right, x + w1 - 1, y, w2, h, vertices);
      } else {
        const h1 = (h + 1) >> 1;
        const h2 = h - h1 + 1;
        node.left = this.allocNode();
        this.createChildNode(node.left, x, y, w, h1, vertices);
        node.right = this.allocNode();
        this.createChildNode(node.right, x, y + h1 - 1, w, h2, vertices);
      }
      node.bbox.beginExtend();
      node.bbox.extend(node.left.bbox.minPoint);
      node.bbox.extend(node.left.bbox.maxPoint);
      node.bbox.extend(node.right.bbox.minPoint);
      node.bbox.extend(node.right.bbox.maxPoint);
    }
    return true;
  }
}

export class HeightField {
  private m_v4Range: Vector4;
  private m_scale: Vector3;
  private m_sizeX: number;
  private m_sizeZ: number;
  private m_bboxTree: HeightfieldBBoxTree;
  constructor() {
    this.m_v4Range = Vector4.zero();
    this.m_bboxTree = null;
    this.m_scale = Vector3.one();
    this.m_sizeX = 0;
    this.m_sizeZ = 0;
  }
  init(sizeX: number, sizeZ: number, offsetX: number, offsetZ: number, spacingX: number, spacingZ: number, vScale: number, heights: Float32Array, patchSize: number): boolean {
    const v: Vector4[] = [];
    for (let i = 0; i < sizeZ; ++i) {
      const srcOffset = i * sizeX;
      const dstOffset = (sizeZ - i - 1) * sizeX;
      for (let j = 0; j < sizeX; ++j) {
        v[dstOffset + j] = new Vector4(offsetX + j * spacingX, heights[srcOffset + j] * vScale, offsetZ + i * spacingZ, 1);
      }
    }
    this.m_bboxTree = new HeightfieldBBoxTree(sizeX, sizeZ, v, patchSize);
    this.m_v4Range.set(
      this.m_bboxTree.getRootNode().bbox.minPoint.x,
      this.m_bboxTree.getRootNode().bbox.minPoint.z,
      this.m_bboxTree.getRootNode().bbox.extents.x * 2,
      this.m_bboxTree.getRootNode().bbox.extents.z * 2
    );
    this.m_scale.set(spacingX, vScale, spacingZ);
    this.m_sizeX = sizeX;
    this.m_sizeZ = sizeZ;
    return true;
  }
  initWithVertices(sizeX: number, sizeZ: number, vertices: Vector4[], patchSize: number): boolean {
    this.m_bboxTree = new HeightfieldBBoxTree(sizeX, sizeZ, vertices, patchSize);
    this.m_scale.set(1, 1, 1);
    this.m_sizeX = sizeX;
    this.m_sizeZ = sizeZ;
    this.m_v4Range.set(
      this.m_bboxTree.getRootNode().bbox.minPoint.x,
      this.m_bboxTree.getRootNode().bbox.minPoint.z,
      this.m_bboxTree.getRootNode().bbox.extents.x * 2,
      this.m_bboxTree.getRootNode().bbox.extents.z * 2
    );
    return true;
  }
  clear(): void {
    this.m_bboxTree = null;
    this.m_v4Range.set(0, 0, 0, 0);
    this.m_scale.set(1, 1, 1);
    this.m_sizeX = 0;
    this.m_sizeZ = 0;
  }
  computeNormals(): Uint8Array {
    const scaleX = this.m_scale.x;
    const scaleZ = this.m_scale.z;
    const heights = this.getHeights();
    const v = new Vector3();
    const normals = new Uint8Array((this.m_sizeZ - 1) * (this.m_sizeX - 1) * 4);
    for (let y = 0; y < this.m_sizeZ - 1; ++y) {
      for (let x = 0; x < this.m_sizeX - 1; ++x) {
        const h00 = heights[x + y * this.m_sizeX];
        const h01 = heights[x + (y + 1) * this.m_sizeX];
        const h11 = heights[x + 1 + (y + 1) * this.m_sizeX];
        const h10 = heights[x + 1 + y * this.m_sizeX];
        const sx = (h00 + h01 - h11 - h10) * 0.5;
        const sy = (h00 + h10 - h01 - h11) * 0.5;
        const index = (x + (this.m_sizeZ - 2 - y) * (this.m_sizeX - 1));
        v.set(sx * scaleZ, 2 * scaleX * scaleZ, -sy * scaleX).inplaceNormalize();
        normals[index * 4 + 0] = Math.floor((v.x * 0.5 + 0.5) * 255);
        normals[index * 4 + 1] = Math.floor((v.y * 0.5 + 0.5) * 255);
        normals[index * 4 + 2] = Math.floor((v.z * 0.5 + 0.5) * 255);
        normals[index * 4 + 3] = 255;
      }
    }
    return normals;
  }
  computeNormalVectors(): Float32Array {
    const scaleX = this.m_scale.x;
    const scaleZ = this.m_scale.z;
    const heights = this.getHeights();
    const v = new Vector3();
    const normals = new Float32Array(this.m_sizeZ * this.m_sizeX * 3);
    for (let y = 0; y < this.m_sizeZ; ++y) {
      for (let x = 0; x < this.m_sizeX; ++x) {
        const h = heights[x + y * this.m_sizeX];
        const h00 = x > 0 && y > 0 ? heights[x - 1 + (y - 1) * this.m_sizeX] : h;
        const h01 = y > 0 && y < this.m_sizeZ - 1 ? heights[(x - 1) + (y + 1) * this.m_sizeX] : h;
        const h11 = x < this.m_sizeX - 1 && y < this.m_sizeZ - 1 ? heights[x + 1 + (y + 1) * this.m_sizeX] : h;
        const h10 = x < this.m_sizeX - 1 && y > 0 ? heights[x + 1 + (y - 1) * this.m_sizeX] : h;
        const sx = (h00 + h01 - h11 - h10) * 0.5;
        const sy = (h00 + h10 - h01 - h11) * 0.5;
        const index = x + (this.m_sizeZ - 1 - y) * this.m_sizeX;
        v.set(sx * scaleZ, 2 * scaleX * scaleZ, -sy * scaleX).inplaceNormalize();
        normals[index * 3 + 0] = v.x;
        normals[index * 3 + 1] = v.y;
        normals[index * 3 + 2] = v.z;
      }
    }
    return normals;
  }
  getBBoxTree(): HeightfieldBBoxTree {
    return this.m_bboxTree;
  }
  getSpacingX(): number {
    return this.m_scale.x;
  }
  getSpacingZ(): number {
    return this.m_scale.z;
  }
  getVerticalScale(): number {
    return this.m_scale.y;
  }
  getSizeX(): number {
    return this.m_sizeX;
  }
  getSizeZ(): number {
    return this.m_sizeZ;
  }
  getOffsetX(): number {
    return this.m_v4Range.x;
  }
  getOffsetZ(): number {
    return this.m_v4Range.y;
  }
  getBoundingbox(): BoundingBox {
    return this.m_bboxTree?.getRootNode()?.bbox || null;
  }
  getHeights(): Float32Array {
    return this.m_bboxTree?.getHeights() || null;
  }
  getHeight(x: number, z: number): number {
    return this.m_bboxTree ? this.m_bboxTree.getHeight(x, z) : 0;
  }
  getRealHeight(x: number, z: number): number {
    return this.m_bboxTree ? this.m_bboxTree.getRealHeight(x, z) : 0;
  }
}
