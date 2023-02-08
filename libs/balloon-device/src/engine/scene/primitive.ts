/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Device,
  Geometry,
} from '../device';
import type {BoundingVolume} from './bounding_volume';

export class Primitive extends Geometry {
  /** @internal */
  private static _nextId = 0;
  /** @internal */
  protected _id: number;
  /** @internal */
  protected _bbox: BoundingVolume;
  /** @internal */
  protected _bboxChangeCallback: (() => void)[];

  constructor(device: Device) {
    super(device);
    this._id = ++Primitive._nextId;
    this._bbox = null;
    this._bboxChangeCallback = [];
  }
  get id(): number {
    return this._id;
  }
  addBoundingboxChangeCallback(cb: () => void) {
    cb && this._bboxChangeCallback.push(cb);
  }
  removeBoundingboxChangeCallback(cb: () => void) {
    const index = this._bboxChangeCallback.indexOf(cb);
    if (index >= 0) {
      this._bboxChangeCallback.splice(index, 1);
    }
  }
  /*
  createAABBTree(): AABBTree {
    const indices = this.getIndexBuffer() ? this.getIndexBuffer().getData() : null;
    const vertices = (this.getVertexBuffer(VERTEX_ATTRIB_POSITION)?.getData() as Float32Array) || null;
    const aabbtree = new AABBTree();
    aabbtree.buildFromPrimitives(vertices, indices, this._primitiveType);
    return aabbtree;
  }
  */
  getBoundingVolume(): BoundingVolume {
    return this._bbox;
  }
  setBoundingVolume(bv: BoundingVolume) {
    if (bv !== this._bbox) {
      this._bbox = bv;
      for (const cb of this._bboxChangeCallback) {
        cb();
      }
    }
  }
  /*
  createWireframeIndexBuffer(epsl: number): {
    buffer: AbstractIndexBuffer;
    primitiveType: PrimitiveType;
  } {
    if (
      this._primitiveType === PrimitiveType.LineList ||
      this._primitiveType === PrimitiveType.LineStrip
    ) {
      return {
        buffer: this.getIndexBuffer(),
        primitiveType: this._primitiveType,
      };
    }
    const that = this;
    const vertices = (this.getVertexBuffer(VERTEX_ATTRIB_POSITION)?.getData() as Float32Array) || null;
    const indexMap = (function () {
      const im: number[] = [];
      const numVerts = Math.floor(vertices.length / 3);
      const sortedVertexIndices: number[] = [];
      const sameVertex = function (v0: number, v1: number) {
        return (
          vertices[v0 * 3] === vertices[v1 * 3] &&
          vertices[v0 * 3 + 1] === vertices[v1 * 3 + 1] &&
          vertices[v0 * 3 + 2] === vertices[v1 * 3 + 2]
        );
      };
      for (let i = 0; i < numVerts; i++) {
        sortedVertexIndices.push(i);
      }
      sortedVertexIndices.sort(
        (a, b) =>
          vertices[a * 3] - vertices[b * 3] ||
          vertices[a * 3 + 1] - vertices[b * 3 + 1] ||
          vertices[a * 3 + 2] - vertices[b * 3 + 2],
      );
      let p0 = 0;
      for (let p1 = 0; p1 < numVerts; p1++) {
        const v0 = sortedVertexIndices[p0];
        const v1 = sortedVertexIndices[p1];
        if (sameVertex(v0, v1)) {
          im[v1] = v0;
        } else {
          im[v1] = v1;
          p0 = p1;
        }
      }
      return im;
    })();
    const lineIndices = (function () {
      const indexBuffer = that.getIndexBuffer();
      const indices = indexBuffer ? indexBuffer.getData() : null;
      const edges: {
        [hash: string]: {tri: number[]; dot: number; removed: boolean};
      } = {};
      const triFlags: {normal: Vector3; merged: boolean}[] = [];
      const t: [number, number, number] = [0, 0, 0];
      const e01 = Vector3.zero();
      const e02 = Vector3.zero();
      const li: number[] = [];
      let numTriangles: number;
      let getTriangle: (tri: number, i: [number, number, number]) => void;
      const addEdge = function (v0: number, v1: number, tri: number) {
        if (v0 > v1) {
          const tmp = v0;
          v0 = v1;
          v1 = tmp;
        }
        const hash = `${v0}-${v1}`;
        let edgeInfo = edges[hash];
        if (!edgeInfo) {
          edges[hash] = edgeInfo = {tri: [], dot: 100, removed: false};
        }
        edgeInfo.tri.push(tri);
      };
      const calcFaceNormal = function (
        v0: number,
        v1: number,
        v2: number,
        outNormal: Vector3,
      ): Vector3 {
        e01
          .set(
            vertices[v1 * 3] - vertices[v0 * 3],
            vertices[v1 * 3 + 1] - vertices[v0 * 3 + 1],
            vertices[v1 * 3 + 2] - vertices[v0 * 3 + 2],
          )
          .inplaceNormalize();
        e02
          .set(
            vertices[v2 * 3] - vertices[v0 * 3],
            vertices[v2 * 3 + 1] - vertices[v0 * 3 + 1],
            vertices[v2 * 3 + 2] - vertices[v0 * 3 + 2],
          )
          .inplaceNormalize();
        return Vector3.cross(e01, e02, outNormal).inplaceNormalize();
      };
      switch (that._primitiveType) {
      case PrimitiveType.TriangleList:
        numTriangles = Math.floor(indices.length / 3);
        getTriangle = (tri, i) => {
          i[0] = indexMap[indices[tri * 3]];
          i[1] = indexMap[indices[tri * 3 + 1]];
          i[2] = indexMap[indices[tri * 3 + 2]];
        };
        break;
      case PrimitiveType.TriangleStrip:
        numTriangles = indices.length - 2;
        getTriangle = (tri, i) => {
          const r = tri % 2;
          i[0] = indexMap[indices[tri + r]];
          i[1] = indexMap[indices[tri - r + 1]];
          i[2] = indexMap[indices[tri + 2]];
        };
        break;
      case PrimitiveType.TriangleFan:
        numTriangles = indices.length - 2;
        getTriangle = (tri, i) => {
          i[0] = indexMap[indices[0]];
          i[1] = indexMap[indices[tri + 1]];
          i[2] = indexMap[indices[tri + 2]];
        };
        break;
      default:
        return null;
      }
      for (let i = 0; i < numTriangles; i++) {
        getTriangle(i, t);
        addEdge(t[0], t[1], i);
        addEdge(t[1], t[2], i);
        addEdge(t[2], t[0], i);
        const tf = (triFlags[i] = {normal: null, merged: false});
        tf.normal = calcFaceNormal(t[0], t[1], t[2], tf.normal);
      }
      const threshold = Math.cos(epsl);
      for (const hash in edges) {
        const edgeInfo = edges[hash];
        if (threshold < 1 && edgeInfo.tri.length === 2) {
          const tri1 = triFlags[edgeInfo.tri[0]];
          const tri2 = triFlags[edgeInfo.tri[1]];
          const dot = Math.abs(Vector3.dot(tri1.normal, tri2.normal));
          if (dot >= threshold) {
            tri1.merged = true;
            tri2.merged = true;
            edgeInfo.removed = true;
          }
        }
        if (!edgeInfo.removed) {
          const s = hash.split('-');
          li.push(Number(s[0]), Number(s[1]));
        }
      }
      return li;
    })();
    const buffer =
      lineIndices && lineIndices.length > 0
        ? this._vao.device.createIndexBuffer(new Uint32Array(lineIndices))
        : null;
    return {buffer: buffer, primitiveType: PrimitiveType.LineList};
  }
  */
}
