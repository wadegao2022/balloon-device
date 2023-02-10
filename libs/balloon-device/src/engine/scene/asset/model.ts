import { Matrix4x4, Quaternion, Vector3, Vector4 } from "../../math";
import type { Primitive } from "../primitive";
import type { Texture2D, TextureSampler } from "../../device";
import type { StandardMaterial } from "../materiallib";
import type { Interpolator } from "../interpolator";
import type { TypedArray } from "../../../shared";

export class AssetModelObject {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

export interface MaterialTextureInfo {
  texture: Texture2D;
  sampler: TextureSampler;
  texCoord: number;
  transform: Matrix4x4;
}

export interface AssetMaterialCommon {
  vertexColor?: boolean;
  vertexNormal?: boolean;
  useTangent?: boolean;
  alphaMode?: 'blend' | 'mask';
  alphaCutoff?: number;
  doubleSided?: boolean;
  normalMap?: MaterialTextureInfo;
  bumpScale?: number;
  emissiveMap?: MaterialTextureInfo;
  emissiveColor?: Vector3;
  emissiveStrength?: number;
  occlusionMap?: MaterialTextureInfo;
  occlusionStrength?: number;
}

export interface AssetMaterial {
  type: string;
  common: AssetMaterialCommon;
}

export interface AssetUnlitMaterial extends AssetMaterial {
  diffuseMap?: MaterialTextureInfo;
  diffuse?: Vector4;
}

export interface AssetMaterialSheen {
  sheenColorFactor?: Vector3;
  sheenColorMap?: MaterialTextureInfo;
  sheenRoughnessFactor?: number;
  sheenRoughnessMap?: MaterialTextureInfo;
}

export interface AssetMaterialClearcoat {
  clearCoatFactor?: number;
  clearCoatIntensityMap?: MaterialTextureInfo;
  clearCoatRoughnessFactor?: number;
  clearCoatRoughnessMap?: MaterialTextureInfo;
  clearCoatNormalMap?: MaterialTextureInfo;
}

export interface AssetPBRMaterialCommon extends AssetUnlitMaterial {
  ior?: number;
}

export interface AssetPBRMaterialMR extends AssetPBRMaterialCommon {
  metallic?: number;
  roughness?: number;
  metallicMap?: MaterialTextureInfo;
  metallicIndex?: number;
  roughnessIndex?: number;
  specularMap?: MaterialTextureInfo;
  specularColorMap?: MaterialTextureInfo;
  specularFactor?: Vector4;
  sheen?: AssetMaterialSheen;
  clearcoat?: AssetMaterialClearcoat;
}

export interface AssetPBRMaterialSG extends AssetPBRMaterialCommon {
  specular?: Vector3;
  glossness?: number;
  specularGlossnessMap?: MaterialTextureInfo;
}

export interface AssetSubMeshData {
  primitive: Primitive,
  material: StandardMaterial,
  rawPositions: Float32Array;
  rawBlendIndices: TypedArray;
  rawJointWeights: TypedArray;
}

export interface AssetMeshData {
  subMeshes: AssetSubMeshData[];
}

export interface AssetAnimationTrack {
  node: AssetHierarchyNode;
  interpolator: Interpolator;
}

export interface AssetAnimationData {
  name: string;
  tracks: AssetAnimationTrack[];
  skeletons: AssetSkeleton[];
  nodes: AssetHierarchyNode[];
}

export interface AssetSkeletalAnimationTrack extends AssetAnimationTrack {
  skeleton: AssetSkeleton;
  keyFrames: { [t: number]: { translation: Vector3, rotation: Quaternion, scale: Vector3 }[] };
}

export interface AssetRotationTrack extends AssetAnimationTrack {
  keyFrames: { [t: number]: Quaternion[] };
  nodes: number[];
}

export interface AssetTranslationTrack extends AssetAnimationTrack {
  keyFrames: { [t: number]: Vector3[] };
  nodes: number[];
}

export interface AssetScaleTrack extends AssetAnimationTrack {
  keyFrames: { [t: number]: Vector3[] };
  nodes: number[];
}

export class AssetHierarchyNode extends AssetModelObject {
  private _parent: AssetHierarchyNode;
  private _position: Vector3;
  private _rotation: Quaternion;
  private _scaling: Vector3;
  private _mesh: AssetMeshData;
  private _skeleton: AssetSkeleton;
  private _attachToSkeleton: AssetSkeleton;
  private _attachIndex: number;
  private _meshAttached: boolean;
  private _matrix: Matrix4x4;
  private _worldMatrix: Matrix4x4;
  private _children: AssetHierarchyNode[];
  constructor(name: string, parent?: AssetHierarchyNode) {
    super(name);
    this._parent = null;
    this._position = Vector3.zero();
    this._rotation = Quaternion.identity();
    this._scaling = Vector3.one();
    this._children = [];
    this._mesh = null;
    this._skeleton = null;
    this._attachToSkeleton = null;
    this._meshAttached = false;
    this._attachIndex = -1;
    this._matrix = null;
    this._worldMatrix = null;
    parent?.addChild(this);
  }
  get parent(): AssetHierarchyNode {
    return this._parent;
  }
  get matrix(): Matrix4x4 {
    return this._matrix;
  }
  get worldMatrix(): Matrix4x4 {
    return this._worldMatrix;
  }
  get mesh(): AssetMeshData {
    return this._mesh;
  }
  set mesh(data: AssetMeshData) {
    this._mesh = data;
    this.setMeshAttached();
  }
  get skeleton(): AssetSkeleton {
    return this._skeleton;
  }
  set skeleton(skeleton: AssetSkeleton) {
    this._skeleton = skeleton;
  }
  get position(): Vector3 {
    return this._position;
  }
  set position(val: Vector3) {
    this._position = val;
  }
  get rotation(): Quaternion {
    return this._rotation;
  }
  set rotation(val: Quaternion) {
    this._rotation = val;
  }
  get scaling(): Vector3 {
    return this._scaling;
  }
  set scaling(val: Vector3) {
    this._scaling = val;
  }
  get meshAttached(): boolean {
    return this._meshAttached;
  }
  get children(): AssetHierarchyNode[] {
    return this._children;
  }
  get skeletonAttached(): AssetSkeleton {
    return this._attachToSkeleton;
  }
  get attachIndex(): number {
    return this._attachIndex;
  }
  computeTransforms(parentTransform: Matrix4x4) {
    this._matrix = Matrix4x4.scaling(this._scaling).rotateLeft(this._rotation).translateLeft(this._position);
    this._worldMatrix = parentTransform ? Matrix4x4.multiply(parentTransform, this._matrix) : new Matrix4x4(this._matrix);
    for (const child of this._children) {
      child.computeTransforms(this._worldMatrix);
    }
  }
  addChild(child: AssetHierarchyNode) {
    if (!child || child.parent) {
      throw new Error('AssetHierarchyNode.addChild(): invalid child node');
    }
    this._children.push(child);
    child._parent = this;
    if (child.meshAttached) {
      this.setMeshAttached();
    }
  }
  removeChild(child: AssetHierarchyNode) {
    const index = this._children.indexOf(child);
    if (index < 0) {
      throw new Error('AssetHierarchyNode.removeChild(): invalid child node');
    }
    this._children[index]._parent = null;
    this._children.splice(index, 1);
  }
  attachToSkeleton(skeleton: AssetSkeleton, index: number) {
    if (this._attachToSkeleton && skeleton !== this._attachToSkeleton) {
      throw new Error(`joint can not attached to multiple skeletons`);
    }
    this._attachToSkeleton = skeleton;
    this._attachIndex = index;
  }
  private setMeshAttached() {
    this._meshAttached = true;
    this._parent?.setMeshAttached();
  }
}

export class AssetSkeleton extends AssetModelObject {
  pivot: AssetHierarchyNode;
  joints: AssetHierarchyNode[];
  inverseBindMatrices: Matrix4x4[];
  bindPoseMatrices: Matrix4x4[];
  constructor(name: string) {
    super(name);
    this.name = name;
    this.pivot = null;
    this.joints = [];
    this.inverseBindMatrices = [];
    this.bindPoseMatrices = [];
  }
  addJoint(joint: AssetHierarchyNode, inverseBindMatrix: Matrix4x4) {
    joint.attachToSkeleton(this, this.joints.length);
    this.joints.push(joint);
    this.inverseBindMatrices.push(inverseBindMatrix);
    this.bindPoseMatrices.push(joint.worldMatrix);
  }
}

export class AssetScene extends AssetModelObject {
  rootNodes: AssetHierarchyNode[];
  constructor(name: string) {
    super(name);
    this.rootNodes = [];
  }
}
export class SharedModel {
  private _name: string;
  private _skeletons: AssetSkeleton[];
  private _nodes: AssetHierarchyNode[];
  private _animations: AssetAnimationData[];
  private _scenes: AssetScene[];
  private _activeScene: number;
  constructor(name?: string) {
    this._name = name || '';
    this._skeletons = [];
    this._nodes = [];
    this._scenes = [];
    this._animations = [];
    this._activeScene = -1;
  }
  get name(): string {
    return this._name;
  }
  set name(val: string) {
    this._name = val;
  }
  get scenes(): AssetScene[] {
    return this._scenes;
  }
  get animations(): AssetAnimationData[] {
    return this._animations;
  }
  get skeletons(): AssetSkeleton[] {
    return this._skeletons;
  }
  get nodes(): AssetHierarchyNode[] {
    return this._nodes;
  }
  get activeScene(): number {
    return this._activeScene;
  }
  set activeScene(val: number) {
    this._activeScene = val;
  }
  addNode(parent: AssetHierarchyNode, index: number, name: string): AssetHierarchyNode {
    const childNode = new AssetHierarchyNode(name, parent);
    this._nodes[index] = childNode;
    return childNode;
  }
  addSkeleton(skeleton: AssetSkeleton) {
    this._skeletons.push(skeleton);
  }
  addAnimation(animation: AssetAnimationData) {
    this._animations.push(animation);
  }
}
