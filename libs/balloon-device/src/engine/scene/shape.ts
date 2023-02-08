import { Vector2, Vector3 } from '../math';
import {
  PrimitiveType,
  Device,
  makeVertexBufferType,
} from '../device';
import { Primitive } from './primitive';
import { BoundingBox } from './bounding_volume';

export interface IShapeCreationOptions {
  needNormal?: boolean;
  needTangent?: boolean;
  needUV?: boolean;
}

export abstract class Shape<T extends IShapeCreationOptions = IShapeCreationOptions> extends Primitive {
  /** @internal */
  protected _options: T;
  constructor(device: Device, options?: T) {
    super(device);
    this._options = this.createDefaultOptions();
    this.create(options);
  }
  create(options?: T): boolean {
    if (options) {
      this._options = this.createDefaultOptions();
      Object.assign(this._options, options);
    }
    this._create();
    return this._vao !== null;
  }
  /** @internal */
  protected createDefaultOptions(): T {
    return {
      needNormal: true,
      needTangent: false,
      needUV: true,
    } as T;
  }
  /** @internal */
  protected abstract _create(): void;
}

export interface IPlaneCreationOptions extends IShapeCreationOptions {
  size?: number;
  sizeX?: number;
  sizeY?: number;
}

export class PlaneShape extends Shape<IPlaneCreationOptions> {
  size: Vector2;
  constructor(device: Device, options?: IPlaneCreationOptions) {
    super(device, options);
  }
  /** @internal */
  protected createDefaultOptions() {
    const options = super.createDefaultOptions();
    options.size = 1;
    return options;
  }
  /** @internal */
  protected _createArrays(
    vertices: number[],
    normals: number[],
    uvs: number[],
    indices: number[],
    sizeX: number,
    sizeY: number,
  ) {
    uvs?.push(0, 1, 0, 0, 1, 0, 1, 1);
    vertices?.push(
      0, 0, sizeY,
      sizeX, 0, sizeY,
      sizeX, 0, 0,
      0, 0, 0);
    indices?.push(0, 1, 2, 0, 2, 3);
    normals?.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    this.primitiveType = PrimitiveType.TriangleList;
  }
  /** @internal */
  protected _create() {
    const needNormal = this._options.needNormal;
    const needUV = this._options.needUV;
    const sizeX = Math.abs(this._options.sizeX || this._options.size) || 1;
    const sizeY = Math.abs(this._options.sizeY || this._options.size) || 1;
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = needNormal ? [] : null;
    const uvs: number[] = needUV ? [] : null;
    this._createArrays(vertices, normals, uvs, indices, sizeX, sizeY);
    this.createAndSetVertexBuffer(makeVertexBufferType(vertices.length / 3, 'position_f32x3'), new Float32Array(vertices));
    normals &&
      this.createAndSetVertexBuffer(makeVertexBufferType(normals.length / 3, 'normal_f32x3'), new Float32Array(normals));
    uvs &&
      this.createAndSetVertexBuffer(makeVertexBufferType(uvs.length / 2, 'tex0_f32x2'), new Float32Array(uvs));
    this.createAndSetIndexBuffer(new Uint16Array(indices));
    this.setBoundingVolume(new BoundingBox(new Vector3(0, 0, 0), new Vector3(sizeX, 0, sizeY)));
    this.indexCount = indices.length;
  }
}

export interface IBoxCreationOptions extends IShapeCreationOptions {
  size?: number;
  sizeX?: number;
  sizeY?: number;
  sizeZ?: number;
  pivotX?: number;
  pivotY?: number;
  pivotZ?: number;
}

export class BoxShape extends Shape<IBoxCreationOptions> {
  constructor(device: Device, options?: IBoxCreationOptions) {
    super(device, options);
  }
  /** @internal */
  protected createDefaultOptions() {
    const options = super.createDefaultOptions();
    options.size = 1;
    return options;
  }
  /** @internal */
  protected _createArrays(
    vertices: number[],
    normals: number[],
    uvs: number[],
    indices: number[],
    minx: number,
    miny: number,
    minz: number,
    maxx: number,
    maxy: number,
    maxz: number
  ) {
    const needTangent = this._options.needTangent;
    const needNormal = this._options.needNormal || needTangent;
    const needUV = this._options.needUV;
    const uv = needUV ? [0, 0, 0, 1, 1, 1, 1, 0] : null;
    const topFacePos = [minx, maxy, minz, minx, maxy, maxz, maxx, maxy, maxz, maxx, maxy, minz];
    const topFacenormal = needNormal ? [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0] : null;
    const frontFacePos = [minx, maxy, maxz, minx, miny, maxz, maxx, miny, maxz, maxx, maxy, maxz];
    const frontFaceNormal = needNormal ? [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1] : null;
    const rightFacePos = [maxx, maxy, maxz, maxx, miny, maxz, maxx, miny, minz, maxx, maxy, minz];
    const rightFaceNormal = needNormal ? [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0] : null;
    const backFacePos = [maxx, maxy, minz, maxx, miny, minz, minx, miny, minz, minx, maxy, minz];
    const backFaceNormal = needNormal ? [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1] : null;
    const leftFacePos = [minx, maxy, minz, minx, miny, minz, minx, miny, maxz, minx, maxy, maxz];
    const leftFaceNormal = needNormal ? [-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0] : null;
    const bottomFacePos = [minx, miny, maxz, minx, miny, minz, maxx, miny, minz, maxx, miny, maxz];
    const bottomFaceNormal = needNormal ? [0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0] : null;
    indices && indices.push(0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23);
    vertices && vertices.push(...topFacePos, ...frontFacePos, ...rightFacePos, ...backFacePos, ...leftFacePos, ...bottomFacePos);
    needNormal && normals && normals.push(...topFacenormal, ...frontFaceNormal, ...rightFaceNormal, ...backFaceNormal, ...leftFaceNormal, ...bottomFaceNormal);
    needUV && uvs && uvs.push(...uv, ...uv, ...uv, ...uv, ...uv, ...uv);
    this.primitiveType = PrimitiveType.TriangleList;
  }
  /** @internal */
  protected _create() {
    const needNormal = this._options.needNormal;
    const needUV = this._options.needUV;
    const sizeX = this._options.sizeX ?? this._options.size ?? 1;
    const sizeY = this._options.sizeY ?? this._options.size ?? 1;
    const sizeZ = this._options.sizeZ ?? this._options.size ?? 1;
    const pivotX = this._options.pivotX ?? 0;
    const pivotY = this._options.pivotY ?? 0;
    const pivotZ = this._options.pivotZ ?? 0;
    const minx = -pivotX * sizeX;
    const maxx = minx + sizeX;
    const miny = -pivotY * sizeY;
    const maxy = miny + sizeY;
    const minz = -pivotZ * sizeZ;
    const maxz = minz + sizeZ;
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = needNormal ? [] : null;
    const uvs: number[] = needUV ? [] : null;
    this._createArrays(vertices, normals, uvs, indices, minx, miny, minz, maxx, maxy, maxz);
    this.createAndSetVertexBuffer(makeVertexBufferType(vertices.length / 3, 'position_f32x3'), new Float32Array(vertices));
    normals &&
      this.createAndSetVertexBuffer(makeVertexBufferType(normals.length / 3, 'normal_f32x3'), new Float32Array(normals));
    uvs &&
      this.createAndSetVertexBuffer(makeVertexBufferType(uvs.length / 2, 'tex0_f32x2'), new Float32Array(uvs));
    this.createAndSetIndexBuffer(new Uint16Array(indices));
    this.setBoundingVolume(
      new BoundingBox(
        new Vector3(minx, miny, minz),
        new Vector3(maxx, maxy, maxz),
      ),
    );
    this.indexCount = indices.length;
  }
}

export class BoxFrameShape extends Shape<IBoxCreationOptions> {
  constructor(device: Device, options?: IBoxCreationOptions) {
    super(device, options);
  }
  /** @internal */
  protected createDefaultOptions() {
    const options = super.createDefaultOptions();
    options.size = 1;
    options.needNormal = false;
    options.needTangent = false;
    options.needUV = false;
    return options;
  }
  /** @internal */
  protected _createArrays(
    vertices: number[],
    indices: number[],
    minx: number,
    miny: number,
    minz: number,
    maxx: number,
    maxy: number,
    maxz: number
  ) {
    const topFacePos = [minx, maxy, minz, minx, maxy, maxz, maxx, maxy, maxz, maxx, maxy, minz];
    const bottomFacePos = [minx, miny, maxz, minx, miny, minz, maxx, miny, minz, maxx, miny, maxz];
    indices && indices.push(0, 1, 1, 2, 2, 3, 3, 0, 0, 5, 1, 4, 2, 7, 3, 6, 6, 5, 5, 4, 4, 7, 7, 6);
    vertices && vertices.push(...topFacePos, ...bottomFacePos);
    this.primitiveType = PrimitiveType.LineList;
  }
  /** @internal */
  protected _create() {
    const sizeX = this._options.sizeX ?? this._options.size ?? 1;
    const sizeY = this._options.sizeY ?? this._options.size ?? 1;
    const sizeZ = this._options.sizeZ ?? this._options.size ?? 1;
    const pivotX = this._options.pivotX ?? 0;
    const pivotY = this._options.pivotY ?? 0;
    const pivotZ = this._options.pivotZ ?? 0;
    const minx = -pivotX * sizeX;
    const maxx = minx + sizeX;
    const miny = -pivotY * sizeY;
    const maxy = miny + sizeY;
    const minz = -pivotZ * sizeZ;
    const maxz = minz + sizeZ;
    const vertices: number[] = [];
    const indices: number[] = [];
    this._createArrays(vertices, indices, minx, miny, minz, maxx, maxy, maxz);
    this.createAndSetVertexBuffer(makeVertexBufferType(vertices.length / 3, 'position_f32x3'), new Float32Array(vertices));
    this.createAndSetIndexBuffer(new Uint16Array(indices));
    this.setBoundingVolume(
      new BoundingBox(
        new Vector3(minx, miny, minz),
        new Vector3(maxx, maxy, maxz),
      ),
    );
    this.indexCount = indices.length;
  }
}

export interface ISphereCreationOptions extends IShapeCreationOptions {
  radius?: number;
  verticalDetail?: number;
  horizonalDetail?: number;
}

export class SphereShape extends Shape<ISphereCreationOptions> {
  constructor(device: Device, options?: ISphereCreationOptions) {
    super(device, options);
  }
  /** @internal */
  protected createDefaultOptions() {
    const options = super.createDefaultOptions();
    options.radius = 1;
    options.verticalDetail = 20;
    options.horizonalDetail = 20;
    return options;
  }
  /** @internal */
  _create() {
    function getVertex(v: number, h: number, r: number) {
      const y = r * Math.cos(v);
      const hRadius = r * Math.sin(v);
      const x = hRadius * Math.sin(h);
      const z = hRadius * Math.cos(h);
      return [x, y, z];
    }
    const radius = this._options.radius ?? 1;
    const verticalDetail = this._options.verticalDetail ?? 20;
    const horizonalDetail = this._options.horizonalDetail ?? 20;
    const vTheta = Math.PI / verticalDetail;
    const hTheta = (Math.PI * 2) / horizonalDetail;
    const vertices: number[] = [];
    const normals: number[] = [];
    const uv: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= verticalDetail; i++) {
      for (let j = 0; j <= horizonalDetail; j++) {
        const v = getVertex(i * vTheta, j * hTheta, radius);
        vertices.push(...v);
        if (this._options.needUV) {
          uv.push(j / horizonalDetail, i / verticalDetail);
        }
        if (this._options.needNormal) {
          normals.push(v[0] / radius, v[1] / radius, v[2] / radius);
        }
      }
    }
    for (let i = 0; i < verticalDetail; i++) {
      for (let j = 0; j <= horizonalDetail; j++) {
        const startIndex = i * (horizonalDetail + 1);
        indices.push(startIndex + j, startIndex + j + horizonalDetail + 1);
      }
      indices.push(indices[indices.length - 1]);
      indices.push((i + 1) * (horizonalDetail + 1));
    }
    this.createAndSetVertexBuffer(makeVertexBufferType(vertices.length / 3, 'position_f32x3'), new Float32Array(vertices));
    normals?.length > 0 &&
      this.createAndSetVertexBuffer(makeVertexBufferType(normals.length / 3, 'normal_f32x3'), new Float32Array(normals));
    uv?.length > 0 &&
      this.createAndSetVertexBuffer(makeVertexBufferType(uv.length / 2, 'tex0_f32x2'), new Float32Array(uv));

    this.createAndSetIndexBuffer(new Uint32Array(indices));
    this.setBoundingVolume(
      new BoundingBox(new Vector3(-radius, -radius, -radius), new Vector3(radius, radius, radius)),
    );
    this.primitiveType = PrimitiveType.TriangleStrip;
    this.indexCount = indices.length;
  }
}
