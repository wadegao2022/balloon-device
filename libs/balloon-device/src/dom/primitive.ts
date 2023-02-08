import { UIRect } from './layout';
import { RColor } from './types';
import type { Texture2D } from '../engine/device';

export abstract class RPrimitive {
  abstract forEach(callback: (x: number, y: number, u: number, v: number) => void, thisArg?: unknown);
  abstract clipToRect(x: number, y: number, w: number, h: number): RPrimitive;
  abstract clone(): RPrimitive;
}

type Vertex = { x: number; y: number; u?: number; v?: number };
export class RPolygonPrimitive extends RPrimitive {
  /** @internal */
  private _vertices: Vertex[];
  constructor(vertices?: Vertex[]) {
    super();
    this._vertices = vertices || [];
  }
  get vertices() {
    return this._vertices;
  }
  set vertices(v) {
    this._vertices = v || [];
  }
  clone(): RPrimitive {
    const copy = new RPolygonPrimitive();
    copy._vertices = this._vertices.map((v) => {
      return { ...v };
    });
    return copy;
  }
  forEach(callback: (x: number, y: number, u: number, v: number) => void, thisArg?: unknown) {
    const indices: number[] = [];
    if (this._vertices.length > 2) {
      const numQuads = Math.ceil((this._vertices.length - 2) / 2);
      for (let i = 0; i < numQuads; i++) {
        indices.push(0);
        indices.push(i * 2 + 1);
        indices.push(i * 2 + 2);
        indices.push(Math.min(this._vertices.length - 1, i * 2 + 3));
      }
    }
    for (const i of indices) {
      const v = this._vertices[i];
      callback.call(thisArg, v.x, v.y, v.u || 0, v.v || 0);
    }
  }
  clipToRect(x: number, y: number, w: number, h: number): RPrimitive {
    if (this._vertices.length < 3) {
      return null;
    }
    // use Sutherland Hodgeman algorithm
    const pingpong: Vertex[][] = [[], []];
    let current = 0;
    pingpong[current] = [...this._vertices];
    const classify: ((v: Vertex) => boolean)[] = [
      (v: Vertex): boolean => v.x >= x, // left
      (v: Vertex): boolean => v.x <= x + w, // right
      (v: Vertex): boolean => v.y >= y, // top
      (v: Vertex): boolean => v.y <= y + h, // bottom
    ];
    const intersect: ((v1: Vertex, v2: Vertex) => Vertex)[] = [
      (v1: Vertex, v2: Vertex): Vertex =>
        this._interpolateVertex(v1, v2, (x - v1.x) / (v2.x - v1.x)), // left
      (v1: Vertex, v2: Vertex): Vertex =>
        this._interpolateVertex(v1, v2, (x + w - v1.x) / (v2.x - v1.x)), // right
      (v1: Vertex, v2: Vertex): Vertex =>
        this._interpolateVertex(v1, v2, (y - v1.y) / (v2.y - v1.y)), // top
      (v1: Vertex, v2: Vertex): Vertex =>
        this._interpolateVertex(v1, v2, (y + h - v1.y) / (v2.y - v1.y)), // bottom
    ];
    for (let pass = 0; pass < 4; pass++) {
      const fnClassify = classify[pass];
      const fnIntersect = intersect[pass];
      const src = pingpong[current];
      const dest = pingpong[1 - current];
      dest.length = 0;
      for (let i = 0; i < src.length; i++) {
        const j = (i + 1) % src.length;
        const firstIn = fnClassify(src[i]);
        const secondIn = fnClassify(src[j]);
        if (firstIn) {
          if (secondIn) {
            dest.push(src[j]);
          } else {
            dest.push(fnIntersect(src[i], src[j]));
          }
        } else if (secondIn) {
          dest.push(fnIntersect(src[i], src[j]), src[j]);
        }
      }
      current = 1 - current;
    }
    if (pingpong[current].length === 0) {
      return null;
    }
    const ret = new RPolygonPrimitive();
    ret.vertices = pingpong[current];
    return ret;
  }
  /** @internal */
  private _interpolateVertex(v1: Vertex, v2: Vertex, factor: number): Vertex {
    const s1 = v1.u || 0;
    const t1 = v1.v || 0;
    const s2 = v2.u || 0;
    const t2 = v2.v || 0;
    return {
      x: Math.round(v1.x + (v2.x - v1.x) * factor),
      y: Math.round(v1.y + (v2.y - v1.y) * factor),
      u: s1 + (s2 - s1) * factor,
      v: t1 + (t2 - t1) * factor,
    };
  }
}

export class RRectPrimitive extends RPrimitive {
  /** @internal */
  private _x1: number;
  /** @internal */
  private _y1: number;
  /** @internal */
  private _x2: number;
  /** @internal */
  private _y2: number;
  /** @internal */
  private _u1: number;
  /** @internal */
  private _v1: number;
  /** @internal */
  private _u2: number;
  /** @internal */
  private _v2: number;
  constructor(
    x: number,
    y: number,
    w: number,
    h: number,
    uMin: number,
    vMin: number,
    uMax: number,
    vMax: number,
  ) {
    super();
    this._x1 = x;
    this._y1 = y;
    this._x2 = x + w;
    this._y2 = y + h;
    this._u1 = uMin;
    this._v1 = vMin;
    this._u2 = uMax;
    this._v2 = vMax;
  }
  clone(): RPrimitive {
    return new RRectPrimitive(
      this._x1,
      this._y1,
      this._x2 - this._x1,
      this._y2 - this._y1,
      this._u1,
      this._v1,
      this._u2,
      this._v2,
    );
  }
  forEach(callback: (x: number, y: number, u: number, v: number) => void, thisArg?: unknown) {
    const x = [this._x1, this._x2, this._x2, this._x1];
    const y = [this._y1, this._y1, this._y2, this._y2];
    const u = [this._u1, this._u2, this._u2, this._u1];
    const v = [this._v1, this._v1, this._v2, this._v2];
    for (let i = 0; i < 4; i++) {
      callback.call(thisArg, x[i], y[i], u[i], v[i]);
    }
  }
  clipToRect(x: number, y: number, w: number, h: number): RPrimitive {
    const x1 = Math.max(x, this._x1);
    const y1 = Math.max(y, this._y1);
    const x2 = Math.min(x + w, this._x2);
    const y2 = Math.min(y + h, this._y2);
    if (x1 >= x2 || y1 >= y2) {
      return null;
    }
    const du = this._u2 - this._u1;
    const dv = this._v2 - this._v1;
    const dw = this._x2 - this._x1;
    const dh = this._y2 - this._y1;
    const u1 = this._u1 + (du * (x1 - this._x1)) / dw;
    const v1 = this._v1 + (dv * (y1 - this._y1)) / dh;
    const u2 = this._u2 - (du * (this._x2 - x2)) / dw;
    const v2 = this._v2 - (dv * (this._y2 - y2)) / dh;

    return new RRectPrimitive(x1, y1, x2 - x1, y2 - y1, u1, v1, u2, v2);
  }
}

export class RPrimitiveBatchList {
  /** @internal */
  private _batchList: { batch: RPrimitiveBatch; vertices: Float32Array }[];
  /** @internal */
  private _absoluteX: number;
  /** @internal */
  private _absoluteY: number;
  /** @internal */
  private _needUpdate: boolean;
  constructor(x: number, y: number) {
    this._absoluteX = x;
    this._absoluteY = y;
    this._batchList = [];
    this._needUpdate = false;
  }
  get length(): number {
    return this._batchList.length;
  }
  get x(): number {
    return this._absoluteX;
  }
  set x(val: number) {
    if (this._absoluteX !== val) {
      this._absoluteX = val;
      this._needUpdate = true;
    }
  }
  get y(): number {
    return this._absoluteY;
  }
  set y(val: number) {
    if (this._absoluteY !== val) {
      this._absoluteY = val;
      this._needUpdate = true;
    }
  }
  clear() {
    this._batchList = [];
    this._needUpdate = false;
  }
  clone(transformOptions?: {
    textureTransformFunc?: (t: Texture2D) => Texture2D;
    colorTransformFunc?: (c: RColor) => RColor;
  }): RPrimitiveBatchList {
    const copy = new RPrimitiveBatchList(this._absoluteX, this._absoluteY);
    copy._batchList = this._batchList.map((bv) => {
      return { batch: bv.batch.clone(transformOptions), vertices: null };
    });
    copy._needUpdate = true;
    return copy;
  }
  getBatch(index: number): RPrimitiveBatch {
    return this._batchList[index]?.batch || null;
  }
  getVertices(index: number): Float32Array {
    if (this._needUpdate) {
      this._needUpdate = false;
      this._updateVertices();
    }
    return this._batchList[index]?.vertices || null;
  }
  addBatch(batch: RPrimitiveBatch) {
    if (batch) {
      const lastBatch = this._batchList[this._batchList.length - 1].batch || null;
      if (
        !lastBatch ||
        lastBatch.texture !== batch.texture ||
        lastBatch.color.r !== batch.color.r ||
        lastBatch.color.g !== batch.color.g ||
        lastBatch.color.b !== batch.color.b ||
        lastBatch.color.a !== batch.color.a
      ) {
        this._batchList.push({ batch: batch, vertices: null });
      } else {
        for (let i = 0; i < batch.length; i++) {
          lastBatch.addPrimitive(batch.getPrimitive(i));
        }
      }
      this._needUpdate = true;
    }
  }
  addPrimitive(prim: RPrimitive, clipper: UIRect, tex?: Texture2D, color?: RColor) {
    if (prim && clipper) {
      tex = tex || null;
      color = color || { r: 1, g: 1, b: 1, a: 1 };
      if (color.a > 0) {
        let lastBatch = this._batchList[this._batchList.length - 1]?.batch || null;
        if (
          !lastBatch ||
          lastBatch.texture !== tex ||
          lastBatch.color.r !== color.r ||
          lastBatch.color.g !== color.g ||
          lastBatch.color.b !== color.b ||
          lastBatch.color.a !== color.a ||
          !lastBatch.isSameClipper(clipper)
        ) {
          lastBatch = new RPrimitiveBatch(clipper);
          lastBatch.texture = tex;
          lastBatch.color = color;
          this._batchList.push({ batch: lastBatch, vertices: null });
        }
        lastBatch.addPrimitive(prim);
        this._needUpdate = true;
      }
    }
  }
  /** @internal */
  private _updateVertices() {
    for (const batch of this._batchList) {
      const verts: number[] = [];
      for (let prim = 0; prim < batch.batch.length; prim++) {
        const primitive = batch.batch.getPrimitive(prim);
        const color = batch.batch.color;
        primitive.forEach((x, y, u, v) => {
          verts.push(
            x + this._absoluteX,
            y + this._absoluteY,
            -50,
            color.r,
            color.g,
            color.b,
            color.a,
            u,
            v,
          );
        });
      }
      batch.vertices = new Float32Array(verts);
    }
  }
}

export class RPrimitiveBatch {
  /** @internal */
  private _clippedRect: UIRect;
  /** @internal */
  private _tex: Texture2D;
  /** @internal */
  private _color: RColor;
  /** @internal */
  private _primitives: RPrimitive[];
  constructor(clipper: UIRect) {
    if (!clipper) {
      throw new Error('Failed to construct RPrimitiveBatch: clipper must not be null');
    }
    this._clippedRect = clipper;
    this._tex = null;
    this._color = { r: 1, g: 1, b: 1, a: 1 };
    this._primitives = [];
  }
  get texture(): Texture2D {
    return this._tex;
  }
  set texture(tex: Texture2D) {
    this._tex = tex;
  }
  get color(): RColor {
    return this._color;
  }
  set color(clr: RColor) {
    clr = clr || { r: 1, g: 1, b: 1, a: 1 };
    this._color.r = clr.r;
    this._color.g = clr.g;
    this._color.b = clr.b;
    this._color.a = clr.a;
  }
  get length(): number {
    return this._primitives.length;
  }
  clone(transformOptions?: {
    textureTransformFunc?: (t: Texture2D) => Texture2D;
    colorTransformFunc?: (c: RColor) => RColor;
  }): RPrimitiveBatch {
    const copy = new RPrimitiveBatch({ ...this._clippedRect });
    copy._tex = transformOptions?.textureTransformFunc
      ? transformOptions.textureTransformFunc(this._tex)
      : this._tex;
    copy._color = transformOptions?.colorTransformFunc
      ? transformOptions.colorTransformFunc(this._color)
      : { ...this._color };
    copy._primitives = this._primitives.map((prim) => prim.clone());
    return copy;
  }
  getPrimitive(index: number): RPrimitive {
    return this._primitives[index] || null;
  }
  addPrimitive(prim: RPrimitive) {
    if (prim && this._primitives.indexOf(prim) < 0) {
      if (this._clippedRect) {
        prim = prim.clipToRect(
          this._clippedRect.x,
          this._clippedRect.y,
          this._clippedRect.width,
          this._clippedRect.height,
        );
      }
      if (prim) {
        this._primitives.push(prim);
      }
    }
  }
  setClipper(rect: UIRect) {
    this._clippedRect = rect ? { ...rect } : null;
  }
  isSameClipper(rc: UIRect) {
    return (
      rc.x !== this._clippedRect.x ||
      rc.y !== this._clippedRect.y ||
      rc.width !== this._clippedRect.width ||
      rc.height !== this._clippedRect.height
    );
  }
  clear() {
    this._primitives.length = 0;
  }
}
