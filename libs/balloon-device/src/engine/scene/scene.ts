import { Vector3, Vector4, Matrix4x4, Ray, AABB, XFormChangeEvent } from '../math';
import { Device, TextureCube } from '../device';
import { SkyboxMaterial } from './materiallib';
import { SceneNode, SceneNodeAttachEvent } from './scene_node';
import { RootNode } from './rootnode';
import { BoxMesh } from './mesh';
import { Camera } from './camera';
import { Octree } from './octree';
import { OctreeUpdateVisitor } from './visitors';
import { REventTarget, REvent } from '../../shared';
import { Material } from './material';
import { GraphNode } from './graph_node';
import type { PunctualLight } from './light';
import type { EnvironmentLighting } from './materiallib/envlight';
import { RaycastVisitor } from './visitors/raycast_visitor';

// eslint-disable-next-line @typescript-eslint/no-namespace
export class Scene extends REventTarget {
  /** @internal */
  private static _nextId = 0;
  /** @internal */
  protected _device: Device;
  /** @internal */
  protected _rootNode: SceneNode;
  /** @internal */
  protected _octree: Octree;
  /** @internal */
  protected _cameraList: Camera[];
  /** @internal */
  protected _lightList: PunctualLight[];
  /** @internal */
  protected _xformChangedList: Set<SceneNode>;
  /** @internal */
  protected _bvChangedList: Set<SceneNode>;
  /** @internal */
  protected _environmentLighting: EnvironmentLighting;
  /** @internal */
  protected _envLightStrength: number;
  /** @internal */
  protected _tickEvent: Scene.TickEvent;
  /** @internal */
  protected _updateFrame: number;
  /** @internal */
  protected _id: number;
  constructor(device: Device) {
    super();
    this._id = ++Scene._nextId;
    this._device = device;
    this._rootNode = new SceneNode(this, null);
    this._octree = new Octree(this, 2048, 64);
    this._cameraList = [];
    this._lightList = [];
    this._xformChangedList = new Set();
    this._bvChangedList = new Set();
    this._environmentLighting = null;
    this._envLightStrength = 1;
    this._tickEvent = new Scene.TickEvent(this);
    this._updateFrame = -1;
    this.addDefaultEventListener(XFormChangeEvent.NAME, (evt: REvent) => {
      const e = evt as XFormChangeEvent;
      this._xformChanged(e.xform as SceneNode);
    });
    this.addDefaultEventListener(SceneNodeAttachEvent.ATTACHED_NAME, (evt: REvent) => {
      const e = evt as SceneNodeAttachEvent;
      this._xformChanged(e.node);
      if (e.node.isCamera()) {
        this._addCamera(e.node);
      } else if (e.node.isLight() && e.node.isPunctualLight()) {
        this._addLight(e.node);
      }
      if (this.octree) {
        this.octree.placeNode(e.node);
      }
    });
    this.addDefaultEventListener(SceneNodeAttachEvent.DETACHED_NAME, (evt: REvent) => {
      const e = evt as SceneNodeAttachEvent;
      this._xformChangedRemove(e.node);
      this._bvChangedRemove(e.node);
      if (this.octree) {
        this.octree.removeNode(e.node);
      }
      if (e.node.isCamera()) {
        this._removeCamera(e.node);
      } else if (e.node.isLight() && e.node.isPunctualLight()) {
        this._removeLight(e.node);
      }
    });
  }
  get id(): number {
    return this._id;
  }
  get device() {
    return this._device;
  }
  get rootNode() {
    return this._rootNode;
  }
  get octree(): Octree {
    return this._octree;
  }
  get cameraList(): Camera[] {
    return this._cameraList;
  }
  get lightList(): PunctualLight[] {
    return this._lightList;
  }
  get boundingBox(): AABB {
    this._syncBVChangedList();
    return this._octree.getRootNode().getBox() || this._octree.getRootNode().getBoxLoosed();
  }
  get environment(): EnvironmentLighting {
    return this._environmentLighting;
  }
  set environment(env: EnvironmentLighting) {
    this._environmentLighting = env;
  }
  get envHash(): string {
    return this._environmentLighting?.constructor.name || '';
  }
  get envLightStrength(): number {
    return this._envLightStrength;
  }
  set envLightStrength(val: number) {
    this._envLightStrength = val;
  }
  dispose() {
    this._device = null;
    this._rootNode = null;
  }
  addSkybox(skyTexture: TextureCube): SceneNode {
    const material = new SkyboxMaterial(this._device);
    material.skyCubeMap = skyTexture;
    const sky = new BoxMesh(this, {
      size: 4,
      pivotX: 0.5,
      pivotY: 0.5,
      pivotZ: 0.5,
      material: material
    });
    sky.clipMode = GraphNode.CLIP_DISABLED;
    sky.renderOrder = GraphNode.ORDER_BACKGROUND;
    sky.pickMode = GraphNode.PICK_DISABLED;
    return sky;
  }
  addCamera(matrix?: Matrix4x4): Camera {
    return new Camera(this, matrix || Matrix4x4.perspective(Math.PI / 3, this._device.getDrawingBufferWidth() / this._device.getDrawingBufferHeight(), 1, 100));
  }
  raycast(camera: Camera, screenX: number, screenY: number): GraphNode {
    const viewport = this.device.getViewport();
    const ray = this.constructRay(camera, viewport[2], viewport[3], screenX, screenY);
    const raycastVisitor = new RaycastVisitor(ray);
    this.octree.getRootNode().traverse(raycastVisitor);
    return raycastVisitor.intersected;
  }
  constructRay(
    camera: Camera,
    viewportWidth: number,
    viewportHeight: number,
    screenX: number,
    screenY: number,
    invModelMatrix?: Matrix4x4,
  ): Ray {
    const vClip = new Vector4(
      (2 * screenX) / viewportWidth - 1,
      1 - (2 * screenY) / viewportHeight,
      1,
      1,
    );
    const vWorld = camera.invViewProjectionMatrix.transform(vClip);
    vWorld.scaleBy(1 / vWorld.w);
    let vEye = camera.worldMatrix.getRow(3).xyz();
    let vDir = Vector3.sub(vWorld.xyz(), vEye).inplaceNormalize();
    if (invModelMatrix) {
      vEye = invModelMatrix.transformPointAffine(vEye);
      vDir = invModelMatrix.transformVectorAffine(vDir);
    }
    return new Ray(vEye, vDir);
  }
  /** @internal */
  _addLight(node: PunctualLight) {
    if (node && node.isLight() && this._lightList.indexOf(node) < 0) {
      this._lightList.push(node);
    }
  }
  /** @internal */
  _removeLight(node: PunctualLight) {
    const index = this._lightList.indexOf(node);
    if (index >= 0) {
      this._lightList.splice(index, 1);
    }
  }
  /** @internal */
  _addCamera(node: Camera) {
    if (node && node.isCamera() && this._cameraList.indexOf(node) < 0) {
      this._cameraList.push(node);
    }
  }
  /** @internal */
  _removeCamera(node: Camera) {
    const index = this._cameraList.indexOf(node);
    if (index >= 0) {
      this._cameraList.splice(index, 1);
    }
  }
  /** @internal */
  _xformChanged(node: SceneNode) {
    if (node) {
      !this._xformChangedList.has(node) && this._xformChangedList.add(node);
      !this._bvChangedList.has(node) && this._bvChangedList.add(node);
    }
  }
  /** @internal */
  _xformChangedRemove(node: SceneNode) {
    if (node) {
      if (this._xformChangedList.has(node)) {
        this._xformChangedList.delete(node);
      }
      for (const child of node.children) {
        this._xformChangedRemove(child);
      }
    }
  }
  /** @internal */
  _bvChanged(node: SceneNode) {
    node && !this._bvChangedList.has(node) && this._bvChangedList.add(node);
  }
  /** @internal */
  _bvChangedRemove(node: SceneNode) {
    if (this._bvChangedList.has(node)) {
      this._bvChangedList.delete(node);
    }
  }
  frameUpdate(camera: Camera) {
    const frameInfo = this._device.frameInfo;
    if (frameInfo.frameCounter !== this._updateFrame) {
      this._updateFrame = frameInfo.frameCounter;
      // uniform buffer garbage collect
      if (!Material.getGCOptions().disabled) {
        Material.garbageCollect(frameInfo.frameTimestamp);
      }
      // update scene objects first
      this._tickEvent.reset();
      this._tickEvent.camera = camera;
      this.dispatchEvent(this._tickEvent);
      this._syncXFormChangedList();
      this._syncBVChangedList();
      camera.frameUpdate();
    }
  }
  /** @internal */
  private _syncXFormChangedList() {
    const that = this;
    function syncNodeXForm(node: SceneNode, checkAttach: boolean) {
      if (!checkAttach || node.attached) {
        if (that.octree && node.isGraphNode()) {
          that.octree.placeNode(node);
        }
        if (node.isPunctualLight()) {
          node.invalidateUniforms();
        }
        for (const child of node.children) {
          syncNodeXForm(child, false);
        }
        if (that._xformChangedList.has(node)) {
          that._xformChangedList.delete(node);
        }
      } else {
        that._xformChangedList.delete(node);
      }
    }
    while (this._xformChangedList.size > 0) {
      syncNodeXForm(this._xformChangedList.keys().next().value, true);
    }
  }
  /** @internal */
  private _syncNodeBV(node: SceneNode) {
    if (this.octree && node.isGraphNode() && node.attached) {
      this.octree.placeNode(node);
    }
    this._bvChangedList.delete(node);
  }
  /** @internal */
  private _syncBVChangedList() {
    if (this._bvChangedList.size > 0) {
      while (this._bvChangedList.size > 0) {
        this._syncNodeBV(this._bvChangedList.keys().next().value);
      }
      const worldBox = this.boundingBox;
      const rootBox = new AABB(this._octree.getRootNode().getBoxLoosed());
      let rootSize = this._octree.getRootSize();
      while (!rootBox.containsBox(worldBox)) {
        rootSize *= 2;
        rootBox.minPoint.scaleBy(2);
        rootBox.maxPoint.scaleBy(2);
      }
      if (rootSize > this._octree.getRootSize()) {
        this._octree.initialize(rootSize, this._octree.getLeafSize());
        const v = new OctreeUpdateVisitor(this._octree);
        this._rootNode.traverse(v);
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Scene {
  export class TickEvent extends REvent {
    static readonly NAME = 'tick';
    camera: Camera;
    scene: Scene;
    constructor(scene: Scene) {
      super(TickEvent.NAME, false, false);
      this.scene = scene;
      this.camera = null;
    }
  }
}

