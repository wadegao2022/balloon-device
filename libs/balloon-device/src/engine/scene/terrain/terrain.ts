import { Vector3 } from "../../math";
import { Quadtree } from "./quadtree";
import { FaceMode, GPUObject, GPUResourceUsageFlags, PBStructTypeInfo, RenderStateSet, StructuredBuffer, Texture2D, TextureFormat } from "../../device";
import { MAX_DETAIL_TEXTURE_LEVELS, TerrainMaterial } from "./terrainmaterial";
import { Drawable, DrawContext } from "../drawable";
import { GraphNode } from "../graph_node";
import { MATERIAL_FUNC_DEPTH_SHADOW } from "../values";
import type { Camera } from "../camera";
import type { TerrainPatch } from "./patch";
import type { BoundingVolume } from "../bounding_volume";
import type { Scene } from "../scene";
import type { SceneNode } from "../scene_node";
import type { CullVisitor } from "../visitors";
import type { REvent } from "../../../shared";

export class Terrain extends GraphNode implements Drawable {
  private _quadtree: Quadtree;
  private _maxPixelError: number;
  private _maxPixelErrorDirty: boolean;
  private _detailPatches: TerrainPatch[];
  private _nondetailPatches: TerrainPatch[];
  private _lodCamera: Camera;
  private _scale: Vector3;
  private _patchSize: number;
  private _detailLodLevel: number;
  private _lastViewportH: number;
  private _lastTanHalfFOVY: number;
  private _width: number;
  private _height: number;
  private _material: TerrainMaterial;
  private _terrainInfoBuffer: StructuredBuffer;
  private _maxDetailTextureLevels: number;
  private _overridenStateSet: RenderStateSet;
  private _wireframe: boolean;
  private _viewPoint: Vector3;
  private _castShadow: boolean;
  private _updateFunc: (evt: REvent) => void;
  constructor(scene: Scene, parent?: SceneNode) {
    super(scene, null);
    this._quadtree = null;
    this._maxPixelError = 10;
    this._maxPixelErrorDirty = true;
    this._lodCamera = null;
    this._detailPatches = [];
    this._nondetailPatches = [];
    this._scale = Vector3.one();
    this._patchSize = 33;
    this._detailLodLevel = 0;
    this._lastViewportH = 0;
    this._lastTanHalfFOVY = 0;
    this._width = 0;
    this._height = 0;
    this._material = null;
    this._maxDetailTextureLevels = MAX_DETAIL_TEXTURE_LEVELS;
    this._wireframe = false;
    this._viewPoint = null;
    this._castShadow = false;
    this._overridenStateSet = scene.device.createRenderStateSet();
    this._overridenStateSet.useRasterizerState().setCullMode(FaceMode.NONE);
    this._updateFunc = (evt: REvent) => this.frameUpdate((evt as Scene.TickEvent).camera);
    this.addEventListener('attached', () => {
      scene.addEventListener('tick', this._updateFunc);
    });
    this.addEventListener('detached', () => {
      scene.removeEventListener('tick', this._updateFunc);
    });
    this.parent = parent || scene.rootNode;
  }
  get castShadow(): boolean {
    return this._castShadow;
  }
  set castShadow(val: boolean) {
    this._castShadow = !!val;
  }
  get maxDetailTextureLevels(): number {
    return this._maxDetailTextureLevels;
  }
  get maxPixelError(): number {
    return this._maxPixelError;
  }
  set maxPixelError(val: number) {
    if (val !== this._maxPixelError) {
      this._maxPixelError = val;
      this._maxPixelErrorDirty = true;
    }
  }
  get LODCamera(): Camera {
    return this._lodCamera;
  }
  set LODCamera(camera: Camera) {
    this._lodCamera = camera;
  }
  get scale(): Vector3 {
    return this._scale;
  }
  get patchSize(): number {
    return this._patchSize;
  }
  get width(): number {
    return this._width;
  }
  get height(): number {
    return this._height;
  }
  get detailLODLevel(): number {
    return this._detailLodLevel;
  }
  get material(): TerrainMaterial {
    return this._material;
  }
  get wireframe(): boolean {
    return this._wireframe;
  }
  set wireframe(b: boolean) {
    this._wireframe = !!b;
  }
  get normalMap(): Texture2D {
    return this._quadtree.normalMap;
  }
  create(sizeX: number, sizeZ: number, elevations: Float32Array, scale: Vector3, patchSize: number): boolean {
    this._quadtree = new Quadtree(this);
    this._material = new TerrainMaterial(this._scene.device);
    if (!this._quadtree.build(this._scene, patchSize, sizeX, sizeZ, elevations, scale.x, scale.z, 24)) {
      this._quadtree = null;
      return false;
    }
    this._patchSize = patchSize;
    this._width = sizeX;
    this._height = sizeZ;
    this._material.normalMap = this._quadtree.normalMap;
    this._terrainInfoBuffer = null;
    this.invalidateBoundingVolume();
    return true;
  }
  computeBoundingVolume(bv: BoundingVolume): BoundingVolume {
    return this._quadtree ? this._quadtree.getHeightField().getBBoxTree().getRootNode().bbox : null;
  }
  frameUpdate(camera: Camera) {
    const viewportH = this.scene.device.getViewport()[3];
    const tanHalfFovy = camera.getTanHalfFovy();
    if (viewportH !== this._lastViewportH || tanHalfFovy !== this._lastTanHalfFOVY || this._maxPixelErrorDirty) {
      this._maxPixelErrorDirty = false;
      this._lastViewportH = viewportH;
      this._lastTanHalfFOVY = tanHalfFovy;
      this._quadtree.setupCamera(viewportH, tanHalfFovy, this._maxPixelError);
    }
    const worldEyePos = camera.worldMatrix.getRow(3).xyz();
    this._viewPoint = this.invWorldMatrix.transformPointAffine(worldEyePos);
  }
  cull(cullVisitor: CullVisitor): boolean {
    this.clearPatches();
    this._quadtree.cull(cullVisitor.camera, this._viewPoint, this.worldMatrix);
    return this._detailPatches.length > 0;
  }
  // Drawable interfaces
  isTransparency(): boolean {
    return false;
  }
  isUnlit(): boolean {
    return !this.material?.supportLighting();
  }
  isTerrain(): this is Terrain {
    return true;
  }
  draw(ctx: DrawContext) {
    if (!this._terrainInfoBuffer) {
      const program = this._material.getOrCreateProgram(ctx).programs[ctx.materialFunc];
      this._terrainInfoBuffer = this.scene.device.createStructuredBuffer(program.getBindingInfo('terrainInfo').type as PBStructTypeInfo, GPUResourceUsageFlags.BF_UNIFORM);
      const bbox = this.getBoundingVolume().toAABB();
      const terrainSizeX = bbox.extents.x * 2;
      const terrainSizeZ = bbox.extents.z * 2;
      this._terrainInfoBuffer.bufferSubData(0, new Int32Array([terrainSizeX, terrainSizeZ, 0, 0]))
      this._terrainInfoBuffer.restoreHandler = async (obj: GPUObject) => {
        this._terrainInfoBuffer.bufferSubData(0, new Int32Array([terrainSizeX, terrainSizeZ, 0, 0]))
      };
    }
    if (ctx.materialFunc === MATERIAL_FUNC_DEPTH_SHADOW) {
      this.scene.device.setRenderStatesOverridden(this._overridenStateSet);
    }
    if (this._material.beginDraw(ctx)) {
      const bindGroup = this._material.getMaterialBindGroup();
      bindGroup.setBuffer('terrainInfo', this._terrainInfoBuffer);
      for (const patch of this._detailPatches) {
        bindGroup.setBuffer('scaleOffset', patch.getOffsetScale(this, ctx));
        (this._wireframe ? patch.getGeometryWireframe() : patch.getGeometry()).draw();
      }
      this._material.endDraw();
    }
    if (ctx.materialFunc === MATERIAL_FUNC_DEPTH_SHADOW) {
      this.scene.device.setRenderStatesOverridden(null);
    }
  }
  getPatches(): TerrainPatch[] {
    return this._quadtree?.getPatches() || [];
  }
  /** @internal */
  addPatch(patch: TerrainPatch, detail: boolean) {
    if (detail) {
      this._detailPatches.push(patch);
    } else {
      this._nondetailPatches.push(patch);
    }
  }
  /** @internal */
  clearPatches() {
    this._detailPatches.length = 0;
    this._nondetailPatches.length = 0;
  }
}
