import { nextPowerOf2 } from "../defs";
import { Device, GPUResourceUsageFlags, Texture2D, TextureFormat } from "../device";
import { Matrix4x4, Vector3 } from "../math";
import { SkinnedBoundingBox } from "./animation";
import { BoundingBox } from "./bounding_volume";
import type { SceneNode } from "./scene_node";

const tmpV0 = new Vector3();
const tmpV1 = new Vector3();
const tmpV2 = new Vector3();
const tmpV3 = new Vector3();

export class Skeleton {
  protected _joints: SceneNode[];
  protected _inverseBindMatrices: Matrix4x4[];
  protected _bindPoseMatrices: Matrix4x4[];
  protected _jointMatrices: Matrix4x4[];
  protected _jointMatrixArray: Float32Array;
  protected _jointTexture: Texture2D;
  constructor(joints: SceneNode[], inverseBindMatrices: Matrix4x4[], bindPoseMatrices: Matrix4x4[]) {
    this._joints = joints;
    this._inverseBindMatrices = inverseBindMatrices;
    this._bindPoseMatrices = bindPoseMatrices;
    this._jointMatrixArray = null;
    this._jointMatrices = null;
    this._jointTexture = null;
  }
  get jointMatrices(): Matrix4x4[] {
    return this._jointMatrices;
  }
  get jointTexture(): Texture2D {
    return this._jointTexture;
  }
  updateJointMatrices(device: Device, jointTransforms?: Matrix4x4[]) {
    if (!this._jointTexture) {
      this._createJointTexture(device);
    }
    for (let i = 0; i < this._joints.length; i++) {
      const mat = this._jointMatrices[i];
      Matrix4x4.multiply(jointTransforms ? jointTransforms[i] : this._joints[i].worldMatrix, this._inverseBindMatrices[i], mat);
    }
  }
  computeBindPose(device: Device) {
    this.updateJointMatrices(device, this._bindPoseMatrices);
    this._jointTexture.update(this._jointMatrixArray, 0, 0, this._jointTexture.width, this._jointTexture.height);
  }
  computeJoints(device: Device) {
    this.updateJointMatrices(device);
    this._jointTexture.update(this._jointMatrixArray, 0, 0, this._jointTexture.width, this._jointTexture.height);
  }
  computeBoundingBox(info: SkinnedBoundingBox, invWorldMatrix: Matrix4x4) {
    info.boundingBox.beginExtend();
    for (let i = 0; i < info.boundingVertices.length; i++) {
      this._jointMatrices[info.boundingVertexBlendIndices[i * 4 + 0]].transformPointAffine(info.boundingVertices[i], tmpV0).scaleBy(info.boundingVertexJointWeights[i * 4 + 0]);
      this._jointMatrices[info.boundingVertexBlendIndices[i * 4 + 1]].transformPointAffine(info.boundingVertices[i], tmpV1).scaleBy(info.boundingVertexJointWeights[i * 4 + 1]);
      this._jointMatrices[info.boundingVertexBlendIndices[i * 4 + 2]].transformPointAffine(info.boundingVertices[i], tmpV2).scaleBy(info.boundingVertexJointWeights[i * 4 + 2]);
      this._jointMatrices[info.boundingVertexBlendIndices[i * 4 + 3]].transformPointAffine(info.boundingVertices[i], tmpV3).scaleBy(info.boundingVertexJointWeights[i * 4 + 3]);
      tmpV0.addBy(tmpV1).addBy(tmpV2).addBy(tmpV3);
      invWorldMatrix.transformPointAffine(tmpV0, tmpV0);
      info.boundingBox.extend(tmpV0);
    }
  }
  /** @internal */
  private _createJointTexture(device: Device) {
    const textureWidth = nextPowerOf2(Math.max(4, Math.ceil(Math.sqrt(this._joints.length * 4))));
    this._jointTexture = device.createTexture2D(TextureFormat.RGBA32F, textureWidth, textureWidth, GPUResourceUsageFlags.TF_NO_MIPMAP | GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE);
    this._jointMatrixArray = new Float32Array(textureWidth * textureWidth * 4);
    this._jointMatrices = this._joints.map((val, index) => new Matrix4x4(this._jointMatrixArray.subarray(index * 16, index * 16 + 16)));
  }
}
