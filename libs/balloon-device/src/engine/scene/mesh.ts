import { Device, Texture2D } from '../device';
import { GraphNode } from './graph_node';
import { BoxFrameShape, BoxShape, IBoxCreationOptions, PlaneShape, SphereShape } from './shape';
import { LambertLightModel, StandardMaterial } from './materiallib';
import { RenderPass } from './renderers';
import { Matrix4x4, XForm } from '../math';
import type { Primitive } from './primitive';
import type { SceneNode } from './scene_node';
import type { Scene } from './scene';
import type { Material } from './material';
import type { BatchDrawable, DrawContext } from './drawable';
import type { BoundingBox, BoundingVolume } from './bounding_volume';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Mesh extends GraphNode implements BatchDrawable {
  /** @internal */
  private _primitive: Primitive;
  /** @internal */
  private _material: Material;
  /** @internal */
  protected _castShadow: boolean;
  /** @internal */
  protected _bboxChangeCallback: () => void;
  /** @internal */
  protected _animatedBoundingBox: BoundingBox;
  /** @internal */
  protected _boneMatrices: Texture2D;
  /** @internal */
  protected _invBindMatrix: Matrix4x4;
  /** @internal */
  protected _instanceHash: string;
  /** @internal */
  protected _batchable: boolean;
  /** @internal */
  protected _boundingBoxNode: Mesh;
  constructor(scene: Scene, parent?: SceneNode) {
    super(scene, parent);
    this._primitive = null;
    this._material = null;
    this._castShadow = true;
    this._animatedBoundingBox = null;
    this._boneMatrices = null;
    this._invBindMatrix = null;
    this._instanceHash = null;
    this._boundingBoxNode = null;
    this._batchable = scene.device.getDeviceType() !== 'webgl';
    this._bboxChangeCallback = this._onBoundingboxChange.bind(this);
  }
  getInstanceId(renderPass: RenderPass): string {
    return this._instanceHash;
  }
  get castShadow(): boolean {
    return this._castShadow;
  }
  set castShadow(b: boolean) {
    this._castShadow = b;
  }
  get primitive(): Primitive {
    return this._primitive;
  }
  set primitive(prim: Primitive) {
    if (prim !== this._primitive) {
      if (this._primitive) {
        this._primitive.removeBoundingboxChangeCallback(this._bboxChangeCallback);
      }
      this._primitive = prim || null;
      if (this._primitive) {
        this._primitive.addBoundingboxChangeCallback(this._bboxChangeCallback);
      }
      this._instanceHash = (this._primitive && this._material) ? `${this.constructor.name}:${this._scene.id}:${this._primitive.id}:${this._material.id}` : null;
      this.invalidateBoundingVolume();
    }
  }
  get material(): Material {
    return this._material;
  }
  set material(m: Material) {
    if (this._material !== m) {
      this._material = m;
      this._instanceHash = (this._primitive && this._material) ? `${this.constructor.name}:${this._scene.id}:${this._primitive.id}:${this._material.id}` : null;
    }
  }
  get drawBoundingBox(): boolean {
    return !!this._boundingBoxNode;
  }
  set drawBoundingBox(val: boolean) {
    if (!!this._boundingBoxNode !== !!val) {
      if (!val) {
        this._boundingBoxNode.remove();
        this._boundingBoxNode = null;
      } else {
        this._boundingBoxNode = Mesh.unitBoxFrame(this._scene, this);
        this._boundingBoxNode.scaling.assign(this.getBoundingVolume().toAABB().size.getArray());
        this._boundingBoxNode.position.assign(this.getBoundingVolume().toAABB().minPoint.getArray());
      }
    }
  }
  isMesh(): boolean {
    return true;
  }
  setAnimatedBoundingBox(bbox: BoundingBox) {
    this._animatedBoundingBox = bbox;
    this.invalidateBoundingVolume();
  }
  setBoneMatrices(matrices: Texture2D) {
    this._boneMatrices = matrices;
  }
  setInvBindMatrix(matrix: Matrix4x4) {
    this._invBindMatrix = matrix;
  }
  isBatchable(): this is BatchDrawable {
    return this._batchable && !this._boneMatrices;
  }
  dispose() {
    this._primitive = null;
    this._material = null;
    super.dispose();
  }
  // Drawable interface
  isTransparency(): boolean {
    return !!this.material?.isTransparent();
  }
  isUnlit(): boolean {
    return !this.material?.supportLighting();
  }
  draw(ctx: DrawContext) {
    this.material.draw(this.primitive, ctx);
  }
  getBoneMatrices(): Texture2D {
    return this._boneMatrices;
  }
  getInvBindMatrix(): Matrix4x4 {
    return this._invBindMatrix;
  }
  getXForm(): XForm {
    // mesh transform should be ignored when skinned
    return this;
  }
  /** @internal */
  computeBoundingVolume(bv: BoundingVolume): BoundingVolume {
    let bbox: BoundingVolume;
    if (this._animatedBoundingBox) {
      bbox = this._animatedBoundingBox;
    } else {
      const primitive = this.primitive;
      bbox = primitive ? primitive.getBoundingVolume() : null;
    }
    if (bbox && this._boundingBoxNode) {
      this._boundingBoxNode.scaling.assign(bbox.toAABB().size.getArray());
      this._boundingBoxNode.position.assign(bbox.toAABB().minPoint.getArray());
    }
    return bbox;
  }
  /** @internal */
  private _onBoundingboxChange() {
    this.invalidateBoundingVolume();
  }
  private static _defaultMaterial: StandardMaterial = null;
  private static _defaultSphere: Primitive = null;
  private static _defaultBox: Primitive = null;
  private static _defaultBoxFrame: Primitive = null;
  private static _getDefaultMaterial(device: Device): StandardMaterial {
    if (!this._defaultMaterial) {
      this._defaultMaterial = new StandardMaterial(device);
      this._defaultMaterial.lightModel = new LambertLightModel();
    }
    return this._defaultMaterial;
  }
  static unitSphere(scene: Scene, parent?: SceneNode) {
    if (!this._defaultSphere) {
      this._defaultSphere = new SphereShape(scene.device, { radius: 1 });
    }
    const mesh = new Mesh(scene, parent);
    mesh.primitive = this._defaultSphere;
    mesh.material = this._getDefaultMaterial(scene.device);
    return mesh;
  }
  static unitBox(scene: Scene, parent?: SceneNode) {
    if (!this._defaultBox) {
      this._defaultBox = new BoxShape(scene.device, { size: 1 });
    }
    const mesh = new Mesh(scene, parent);
    mesh.primitive = this._defaultBox;
    mesh.material = this._getDefaultMaterial(scene.device);
    return mesh;
  }
  static unitBoxFrame(scene: Scene, parent?: SceneNode) {
    if (!this._defaultBoxFrame) {
      this._defaultBoxFrame = new BoxFrameShape(scene.device, { size: 1 });
    }
    const mesh = new Mesh(scene, parent);
    mesh.primitive = this._defaultBoxFrame;
    mesh.material = this._getDefaultMaterial(scene.device);
    return mesh;
  }
}

export class BoxMesh extends Mesh {
  constructor(
    scene: Scene,
    options?: IBoxCreationOptions & { material?: Material },
  ) {
    super(scene);
    this.primitive = new BoxShape(scene.device, options);
    this.material = options.material;
    if (!this.material) {
      const stdMat = new StandardMaterial(scene.device);
      stdMat.lightModel = new LambertLightModel();
      this.material = stdMat;
    }
  }
}

export class PlaneMesh extends Mesh {
  constructor(
    scene: Scene,
    options?: {
      size: number;
      sizeX?: number;
      sizeY?: number;
      material?: Material;
    },
  ) {
    super(scene);
    this.primitive = new PlaneShape(scene.device, options);
    this.material = options.material;
    if (!this.material) {
      const stdMat = new StandardMaterial(scene.device);
      stdMat.lightModel = new LambertLightModel();
      this.material = stdMat;
    }
  }
}

export class SphereMesh extends Mesh {
  constructor(
    scene: Scene,
    options?: {
      radius?: number;
      verticalDetail?: number;
      horizonalDetail?: number;
      material?: Material;
    },
  ) {
    super(scene);
    this.primitive = new SphereShape(scene.device, options);
    this.material = options.material;
    if (!this.material) {
      const stdMat = new StandardMaterial(scene.device);
      stdMat.lightModel = new LambertLightModel();
      this.material = stdMat;
    }
  }
}
