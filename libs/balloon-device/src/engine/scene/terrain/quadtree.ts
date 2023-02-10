import { PatchPosition } from './types';
import { BoundingBox } from '../bounding_volume';
import { TerrainPatch } from './patch';
import { ClipState, Frustum, Matrix4x4, Vector3 } from '../../math';
import { isPowerOf2, nextPowerOf2 } from '../../../shared';
import { GPUResourceUsageFlags, IndexBuffer, makeVertexBufferType, PrimitiveType, StructuredBuffer, Texture2D, TextureFormat } from '../../device';
import { HeightField } from './heightfield';
import type { Terrain } from './terrain';
import type { Camera } from '../camera';
import type { Scene } from '../scene';

export class QuadtreeNode {
  private _patch: TerrainPatch;
  private _parent: QuadtreeNode;
  private _children: QuadtreeNode[];
  constructor() {
    this._patch = null;
    this._parent = null;
    this._children = null;
  }
  initialize(scene: Scene, quadtree: Quadtree, parent: QuadtreeNode, position: PatchPosition, baseVertices: StructuredBuffer, normals: Float32Array, elevations: Float32Array): boolean {
    this._parent = parent;
    this._children = [];
    this._patch = new TerrainPatch();
    if (!this._patch.initialize(scene, quadtree, this._parent?._patch || null, position, baseVertices, normals, elevations)) {
      return false;
    }
    if (this._patch.getStep() > 1) {
      let bbox: BoundingBox = null;
      const size = (quadtree.getPatchSize() - 1) * (this._patch.getStep() >> 1);
      const offsetX = this._patch.getOffsetX();
      const offsetZ = this._patch.getOffsetZ();
      const offsets = [
        [offsetX, offsetZ],
        [offsetX + size, offsetZ],
        [offsetX, offsetZ + size],
        [offsetX + size, offsetZ + size]
      ];
      const rootSizeX = quadtree.getRootSizeX() - 1;
      const rootSizeZ = quadtree.getRootSizeZ() - 1;
      for (let i = 0; i < 4; ++i) {
        if (offsets[i][0] >= rootSizeX || offsets[i][1] >= rootSizeZ) {
          this._children[i] = null;
        } else {
          this._children[i] = new QuadtreeNode();
          if (!this._children[i].initialize(scene, quadtree, this, i, baseVertices, normals, elevations)) {
            return false;
          }
          const childBBox = this._children[i]._patch.getBoundingBox();
          if (childBBox) {
            if (!bbox) {
              bbox = new BoundingBox();
              bbox.beginExtend();
            }
            bbox.extend(childBBox.minPoint);
            bbox.extend(childBBox.maxPoint);
          }
        }
      }
      this._patch.setBoundingBox(bbox);
    }
    quadtree.addPatch(this._patch);
    return true;
  }
  setupCamera(viewportH: number, tanHalfFovy: number, maxPixelError: number): void {
    if (this._patch && !this._patch.isDummy()) {
      this._patch.setupCamera(viewportH, tanHalfFovy, maxPixelError);
    }
    for (let i = 0; i < 4; ++i) {
      if (this._children[i]) {
        this._children[i].setupCamera(viewportH, tanHalfFovy, maxPixelError);
      }
    }
  }
  getBoundingbox(): BoundingBox {
    return this._patch.getBoundingBox();
  }
  getPatch(): TerrainPatch {
    return this._patch;
  }
  getParent(): QuadtreeNode {
    return this._parent;
  }
  getChild(index: number): QuadtreeNode {
    return this._children[index];
  }
}

export class Quadtree {
  private _baseVertices: StructuredBuffer;
  private _indices: IndexBuffer;
  private _indicesWireframe: IndexBuffer;
  private _normalMap: Texture2D;
  private _scaleX: number;
  private _scaleZ: number;
  private _patchSize: number;
  private _rootSizeX: number;
  private _rootSizeZ: number;
  private _rootSize: number;
  private _primitiveCount: number;
  private _primitiveType: PrimitiveType;
  private _rootNode: QuadtreeNode;
  private _terrain: Terrain;
  private _heightField: HeightField;
  private _patches: TerrainPatch[];
  constructor(terrain: Terrain) {
    this._terrain = terrain;
    this._baseVertices = null;
    this._indices = null;
    this._indicesWireframe = null;
    this._normalMap = null;
    this._scaleX = 1;
    this._scaleZ = 1;
    this._patchSize = 0;
    this._rootSizeX = 0;
    this._rootSizeZ = 0;
    this._rootSize = 0;
    this._heightField = null;
    this._rootNode = null;
    this._primitiveCount = 0;
    this._primitiveType = PrimitiveType.TriangleStrip;
    this._patches = [];
  }
  get normalMap(): Texture2D {
    return this._normalMap;
  }
  build(scene: Scene, patchSize: number, rootSizeX: number, rootSizeZ: number, elevations: Float32Array, scaleX: number, scaleZ: number, vertexCacheSize: number): boolean {
    const device = scene.device;
    if (!isPowerOf2(patchSize - 1)
      || !!((rootSizeX - 1) % (patchSize - 1))
      || !!((rootSizeZ - 1) % (patchSize - 1))
      || !elevations) {
      return false;
    }
    this._heightField = new HeightField();
    if (!this._heightField.init(rootSizeX, rootSizeZ, 0, 0, scaleX, scaleZ, 1, elevations, patchSize)) {
      this._heightField = null;
      return false;
    }
    this._patchSize = patchSize;
    this._rootSizeX = rootSizeX;
    this._rootSizeZ = rootSizeZ;
    this._rootSize = nextPowerOf2(Math.max((rootSizeX - 1), (rootSizeZ - 1))) + 1;
    this._scaleX = scaleX;
    this._scaleZ = scaleZ;
    // Create base vertex buffer
    const dimension = patchSize + 2; // with "skirts"
    const vertices = new Float32Array(dimension * dimension * 3);
    let offset = 0;
    // top skirt
    vertices[0] = 0;
    vertices[1] = 0;
    vertices[2] = 0;
    for (let i = 1; i < dimension - 1; ++i) {
      vertices[3 * i + 0] = i - 1;
      vertices[3 * i + 1] = 0;
      vertices[3 * i + 2] = 0;
    }
    vertices[3 * (dimension - 1) + 0] = dimension - 3;
    vertices[3 * (dimension - 1) + 1] = 0;
    vertices[3 * (dimension - 1) + 2] = 0;
    offset += dimension * 3;
    for (let i = 1; i < dimension - 1; ++i, offset += dimension * 3) {
      // left skirt
      vertices[offset + 0] = 0;
      vertices[offset + 1] = 0;
      vertices[offset + 2] = i - 1;
      // height
      for (let j = 1; j < dimension - 1; ++j) {
        vertices[offset + 3 * j + 0] = j - 1;
        vertices[offset + 3 * j + 1] = 0;
        vertices[offset + 3 * j + 2] = i - 1;
      }
      // right skirt
      vertices[offset + (dimension - 1) * 3 + 0] = dimension - 3;
      vertices[offset + (dimension - 1) * 3 + 1] = 0;
      vertices[offset + (dimension - 1) * 3 + 2] = i - 1;
    }
    // bottom skirt
    vertices[offset + 0] = 0;
    vertices[offset + 1] = 0;
    vertices[offset + 2] = dimension - 3;
    for (let i = 1; i < dimension - 1; ++i) {
      vertices[offset + 3 * i + 0] = i - 1;
      vertices[offset + 3 * i + 1] = 0;
      vertices[offset + 3 * i + 2] = dimension - 3;
    }
    vertices[offset + (dimension - 1) * 3 + 0] = dimension - 3;
    vertices[offset + (dimension - 1) * 3 + 1] = 0;
    vertices[offset + (dimension - 1) * 3 + 2] = dimension - 3;
    this._baseVertices = device.createStructuredBuffer(makeVertexBufferType(dimension * dimension, 'position_f32x3'), GPUResourceUsageFlags.BF_VERTEX | GPUResourceUsageFlags.MANAGED, vertices);
    // Create base index buffer
    const indices = this.strip(vertexCacheSize);
    this._indices = device.createIndexBuffer(indices, GPUResourceUsageFlags.MANAGED);
    const lineIndices = this.line(indices);
    this._indicesWireframe = device.createIndexBuffer(lineIndices, GPUResourceUsageFlags.MANAGED);
    this._primitiveCount = indices.length - 2;
    this._primitiveType = PrimitiveType.TriangleStrip;
    this._rootNode = new QuadtreeNode();
    const normals = this._heightField.computeNormalVectors();
    const normalMapBytes = new Uint8Array(normals.length / 3 * 4);
    for (let i = 0; i < normals.length / 3; i++) {
      normalMapBytes[i * 4 + 0] = Math.floor((normals[i * 3 + 0] * 0.5 + 0.5) * 255);
      normalMapBytes[i * 4 + 1] = Math.floor((normals[i * 3 + 1] * 0.5 + 0.5) * 255);
      normalMapBytes[i * 4 + 2] = Math.floor((normals[i * 3 + 2] * 0.5 + 0.5) * 255);
      normalMapBytes[i * 4 + 3] = 255;
    }
    this._normalMap = device.createTexture2D(TextureFormat.RGBA8UNORM, rootSizeX, rootSizeZ, GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE);
    this._normalMap.name = `TerrainNormalMap-${this._normalMap.uid}`;
    this._normalMap.update(normalMapBytes, 0, 0, this._normalMap.width, this._normalMap.height);
    return this._rootNode.initialize(scene, this, null, PatchPosition.LeftTop, this._baseVertices, normals, elevations);
  }
  strip(vertexCacheSize: number): Uint16Array {
    const dimension = this._patchSize + 2;
    const step = (vertexCacheSize >> 1) - 1;
    const indices: number[] = [];
    for (let i = 0; i < dimension - 1; i += step) {
      const start = i;
      const end = (i + step > dimension - 1) ? dimension - 1 : i + step;
      for (let j = 0; j < dimension - 1; ++j) {
        for (let k = start; k <= end; ++k) {
          indices.push((dimension - 1 - k) * dimension + j);
          indices.push((dimension - 1 - k) * dimension + j + 1);
        }
        indices.push((dimension - 1 - end) * dimension + j + 1);
        indices.push((j == dimension - 2) ? (dimension - 1 - end) * dimension : (dimension - 1 - start) * dimension + j + 1);
      }
    }
    indices.length = indices.length - 2;
    return new Uint16Array(indices);
  }
  line(strip: Uint16Array): Uint16Array {
    const numTris = strip.length - 2;
    const lineIndices: number[] = [];
    let lastSkipped = true;
    let a: number, b: number, c: number;
    for (let i = 0; i < numTris; i++) {
      if (i % 2 === 0) {
        a = strip[i];
        b = strip[i + 1];
        c = strip[i + 2];
      } else {
        a = strip[i + 1];
        b = strip[i];
        c = strip[i + 2];
      }
      const thisSkipped = a === b || a === c || b === c;
      if (!thisSkipped) {
        if (lastSkipped) {
          lineIndices.push(a, b);
        }
        lineIndices.push(b, c, c, a);
      }
      lastSkipped = thisSkipped;
    }
    return new Uint16Array(lineIndices);
  }
  setupCamera(viewportH: number, tanHalfFovy: number, maxPixelError: number): void {
    this._rootNode?.setupCamera(viewportH, tanHalfFovy, maxPixelError);
  }
  getBoundingBox(bbox: BoundingBox): void {
    if (this._heightField) {
      bbox.minPoint = this._heightField.getBoundingbox().minPoint;
      bbox.maxPoint = this._heightField.getBoundingbox().maxPoint;
    } else {
      bbox.minPoint = Vector3.zero();
      bbox.maxPoint = Vector3.zero();
    }
  }
  getPatchSize(): number {
    return this._patchSize;
  }
  getRootSize(): number {
    return this._rootSize;
  }
  getRootSizeX(): number {
    return this._rootSizeX;
  }
  getRootSizeZ(): number {
    return this._rootSizeZ;
  }
  getTerrain(): Terrain {
    return this._terrain;
  }
  getElevations(): Float32Array {
    return this._heightField?.getHeights() || null;
  }
  getScaleX(): number {
    return this._scaleX;
  }
  getScaleZ(): number {
    return this._scaleZ;
  }
  getIndices(): IndexBuffer {
    return this._indices;
  }
  getIndicesWireframe(): IndexBuffer {
    return this._indicesWireframe;
  }
  getPrimitiveCount(): number {
    return this._primitiveCount;
  }
  getPrimitiveType(): PrimitiveType {
    return this._primitiveType;
  }
  getHeightField(): HeightField {
    return this._heightField;
  }
  getPatches(): TerrainPatch[] {
    return this._patches;
  }
  /** @internal */
  addPatch(patch: TerrainPatch) {
    this._patches.push(patch);
  }
  /** @internal */
  cull(camera: Camera, viewPoint: Vector3, worldMatrix: Matrix4x4) {
    if (this._rootNode && this._terrain) {
      const frustum = new Frustum(camera.viewProjectionMatrix, worldMatrix);
      this.cull_r(camera, this._rootNode, viewPoint, worldMatrix, frustum, true);
    }
  }
  /** @internal */
  cull_r(camera: Camera, node: QuadtreeNode, viewPoint: Vector3, worldMatrix: Matrix4x4, frustum: Frustum, cliptest: boolean) {
    const bbox = node.getBoundingbox();
    if (cliptest) {
      const clipState = bbox.getClipStateWithFrustum(frustum);
      if (clipState === ClipState.NOT_CLIPPED) {
        return;
      } else if (clipState === ClipState.A_INSIDE_B) {
        cliptest = false;
      }
    }
    const ld = node.getPatch().isDummy() ? -1 : node.getPatch().getLODDistance();
    const lodDistance = ld >= 0 ? ld * ld : Number.MAX_VALUE;
    const eyeDistSq = ld >= 0 ? node.getPatch().sqrDistanceToPoint(viewPoint) : 0;
    const lodLevel = this._terrain.detailLODLevel;
    if (eyeDistSq < lodDistance && node.getChild(0) && (lodLevel === 0 || node.getPatch().getMipLevel() < lodLevel)) {
      for (let i = 0; i < 4; i++) {
        const child = node.getChild(i);
        if (child) {
          this.cull_r(camera, child, viewPoint, worldMatrix, frustum, cliptest);
        }
      }
    } else if (!node.getPatch().isDummy()) {
      this._terrain.addPatch(node.getPatch(), true);
    }
  }
}
