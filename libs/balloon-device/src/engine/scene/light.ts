import { Vector3, Vector4, Matrix4x4, Frustum, AABB } from '../math';
import { GraphNode } from './graph_node';
import { BoundingVolume, BoundingBox } from './bounding_volume';
import { TextureCube } from '../device';
import { ShadowMapper } from './shadow/shadowmapper';
import type { Scene } from './scene';

export enum LightingFalloffMode {
  UNKNOWN = 0,
  CONSTANT = 1,
  LINEAR = 2,
  QUADRATIC = 3,
}

export enum LightType {
  NONE = 0,
  DIRECTIONAL = 1,
  POINT = 2,
  SPOT = 3,
  HEMISPHERIC = 4,
  ENVIRONMENT = 5,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class BaseLight extends GraphNode {
  /** @internal */
  protected _type: LightType;
  /** @internal */
  protected _intensity: number;
  /** @internal */
  protected _positionRange: Vector4;
  /** @internal */
  protected _directionCutoff: Vector4;
  /** @internal */
  protected _diffuseIntensity: Vector4;
  constructor(scene: Scene, type: LightType) {
    super(scene);
    this._intensity = 1;
    this._type = type;
    this._positionRange = null;
    this._directionCutoff = null;
    this._diffuseIntensity = null;
    this.addDefaultEventListener('xform_change', () => {
      this.invalidateUniforms();
    });
  }
  get lightType(): LightType {
    return this._type;
  }
  get intensity() {
    return this._intensity;
  }
  set intensity(val: number) {
    this.setIntensity(val);
  }
  get positionAndRange() {
    if (!this._positionRange) {
      this.computeUniforms();
    }
    return this._positionRange;
  }
  get directionAndCutoff() {
    if (!this._directionCutoff) {
      this.computeUniforms();
    }
    return this._directionCutoff;
  }
  get diffuseAndIntensity() {
    if (!this._diffuseIntensity) {
      this.computeUniforms();
    }
    return this._diffuseIntensity;
  }
  get viewMatrix(): Matrix4x4 {
    return this.invWorldMatrix;
  }
  get viewProjMatrix(): Matrix4x4 {
    return null;
  }
  setIntensity(val: number) {
    if (this._intensity !== val) {
      this._intensity = val;
      this.invalidateUniforms();
    }
    return this;
  }
  invalidateUniforms() {
    this._positionRange = null;
    this._directionCutoff = null;
    this._diffuseIntensity = null;
  }
  isLight(): this is BaseLight {
    return true;
  }
  isPunctualLight(): this is PunctualLight {
    return false;
  }
  isAmbientLight(): this is AmbientLight {
    return false;
  }
  isHemiSphericLight(): this is HemiSphericLight {
    return false;
  }
  isDirectionLight(): this is DirectionalLight {
    return false;
  }
  isPointLight(): this is PointLight {
    return false;
  }
  isSpotLight(): this is SpotLight {
    return false;
  }
  /** @internal */
  abstract computeUniforms(): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class AmbientLight extends BaseLight {
  constructor(scene: Scene, type: LightType) {
    super(scene, type);
  }
  isAmbientLight(): this is AmbientLight {
    return true;
  }
}

export class EnvironmentLight extends AmbientLight {
  /** @internal */
  protected _radianceMap: TextureCube;
  /** @internal */
  protected _irradianceMap: TextureCube;
  constructor(scene: Scene, radianceMap?: TextureCube, irradianceMap?: TextureCube) {
    super(scene, LightType.ENVIRONMENT);
    this._radianceMap = radianceMap || null;
    this._irradianceMap = irradianceMap || null;
  }
  get radianceMap(): TextureCube {
    return this._radianceMap;
  }
  set radianceMap(map: TextureCube) {
    this._radianceMap = map || null;
  }
  get irradianceMap(): TextureCube {
    return this._irradianceMap;
  }
  set irradianceMap(map: TextureCube) {
    this._irradianceMap = map || null;
  }
  computeUniforms() {
  }
}
export class HemiSphericLight extends AmbientLight {
  /** @internal */
  protected _colorUp: Vector4;
  /** @internal */
  protected _colorDown: Vector4;
  constructor(scene: Scene) {
    super(scene, LightType.HEMISPHERIC);
    this._colorUp = Vector4.zero();
    this._colorDown = Vector4.zero();
  }
  get colorUp() {
    return this._colorUp;
  }
  set colorUp(val: Vector4) {
    this.setColorUp(val);
  }
  setColorUp(val: Vector4) {
    this._colorUp.assign(val.getArray());
    this.invalidateUniforms();
    return this;
  }
  get colorDown() {
    return this._colorDown;
  }
  set colorDown(val: Vector4) {
    this.setColorDown(val);
  }
  setColorDown(val: Vector4) {
    this._colorDown.assign(val.getArray());
    this.invalidateUniforms();
    return this;
  }
  isHemiSphericLight(): this is HemiSphericLight {
    return true;
  }
  /** @internal */
  computeUniforms() {
    this._positionRange = this.colorUp;
    this._directionCutoff = this.colorDown;
    this._diffuseIntensity = new Vector4(1, 1, 1, this.intensity);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class PunctualLight extends BaseLight {
  /** @internal */
  protected _color: Vector4;
  /** @internal */
  protected _castShadow: boolean;
  /** @internal */
  protected _lightViewProjectionMatrix: Matrix4x4;
  /** @internal */
  protected _shadowMapper: ShadowMapper;
  constructor(scene: Scene, type: LightType) {
    super(scene, type);
    this._color = Vector4.one();
    this._castShadow = false;
    this._lightViewProjectionMatrix = Matrix4x4.identity();
    this._shadowMapper = new ShadowMapper(this);
  }
  get color(): Vector4 {
    return this._color;
  }
  set color(clr: Vector4) {
    this.setColor(clr);
  }
  setColor(clr: Vector4) {
    this._color.assign(clr.getArray());
    this.invalidateUniforms();
    return this;
  }
  get castShadow(): boolean {
    return this._castShadow;
  }
  set castShadow(b: boolean) {
    this.setCastShadow(b);
  }
  setCastShadow(b: boolean): this {
    this._castShadow = b;
    return this;
  }
  get viewProjMatrix(): Matrix4x4 {
    return this._lightViewProjectionMatrix;
  }
  set viewProjMatrix(mat: Matrix4x4) {
    this.setLightViewProjectionMatrix(mat);
  }
  get shadow(): ShadowMapper {
    return this._shadowMapper;
  }
  setLightViewProjectionMatrix(mat: Matrix4x4): this {
    this._lightViewProjectionMatrix.assign(mat.getArray());
    return this;
  }
  isPunctualLight(): this is PunctualLight {
    return true;
  }
  dispose() {
    this._shadowMapper.dispose();
    super.dispose();
  }
}

export class DirectionalLight extends PunctualLight {
  constructor(scene: Scene) {
    super(scene, LightType.DIRECTIONAL);
  }
  isDirectionLight(): this is DirectionalLight {
    return true;
  }
  /** @internal */
  computeBoundingVolume(bv: BoundingVolume): BoundingVolume {
    return null;
  }
  /** @internal */
  computeUniforms() {
    const a = this.worldMatrix.getRow(3);
    const b = this.worldMatrix.getRow(2).scaleBy(-1);
    this._positionRange = new Vector4(a.x, a.y, a.z, 0);
    this._directionCutoff = new Vector4(b.x, b.y, b.z, 0);
    this._diffuseIntensity = new Vector4(this.color.x, this.color.y, this.color.z, this.intensity);
  }
  // adapt from DXSDK
  /** @internal */
  private _computeNearAndFar(frustumMin: Vector3, frustumMax: Vector3, aabbLightSpace: Vector3[]): [number, number] {
    type Triangle = { pt: [Vector3, Vector3, Vector3], culled: boolean };
    function dupTriangle(src: Triangle): Triangle {
      return {
        pt: [
          src.pt[0] ? new Vector3(src.pt[0]) : null,
          src.pt[1] ? new Vector3(src.pt[1]) : null,
          src.pt[2] ? new Vector3(src.pt[2]) : null
        ],
        culled: src.culled
      };
    }
    let nearPlane = Number.MAX_VALUE;
    let farPlane = -Number.MAX_VALUE;
    const triangleList: Triangle[] = Array.from({ length: 16 }).map(val => ({ pt: [null, null, null], culled: false }));
    let triangleCount = 1;
    triangleList[0].pt[0] = aabbLightSpace[0];
    triangleList[0].pt[1] = aabbLightSpace[1];
    triangleList[0].pt[2] = aabbLightSpace[2];
    const triIndices = [0, 1, 2, 1, 2, 3, 4, 5, 6, 5, 6, 7, 0, 2, 4, 2, 4, 6, 1, 3, 5, 3, 5, 7, 0, 1, 4, 1, 4, 5, 2, 3, 6, 3, 6, 7];
    const pointPassesCollision: number[] = [0, 0, 0];
    const minx = frustumMin.x;
    const maxx = frustumMax.x;
    const miny = frustumMin.y;
    const maxy = frustumMax.y;
    for (let i = 0; i < 12; i++) {
      triangleList[0].pt[0] = aabbLightSpace[triIndices[i * 3 + 0]];
      triangleList[0].pt[1] = aabbLightSpace[triIndices[i * 3 + 1]];
      triangleList[0].pt[2] = aabbLightSpace[triIndices[i * 3 + 2]];
      triangleList[0].culled = false;
      triangleCount = 1;
      for (let j = 0; j < 4; j++) {
        let edge: number, comp: number;
        if (j === 0) {
          edge = minx;
          comp = 0;
        } else if (j === 1) {
          edge = maxx;
          comp = 0;
        } else if (j === 2) {
          edge = miny;
          comp = 1;
        } else {
          edge = maxy;
          comp = 1;
        }
        let k = 0;
        while (k < triangleCount) {
          if (!triangleList[k].culled) {
            let insideVertCount = 0;
            let tempOrder: Vector3 = null;
            if (j === 0) {
              for (let t = 0; t < 3; t++) {
                if (triangleList[k].pt[t].x > minx) {
                  pointPassesCollision[t] = 1;
                } else {
                  pointPassesCollision[t] = 0;
                }
                insideVertCount += pointPassesCollision[t];
              }
            } else if (j === 1) {
              for (let t = 0; t < 3; t++) {
                if (triangleList[k].pt[t].x < maxx) {
                  pointPassesCollision[t] = 1;
                } else {
                  pointPassesCollision[t] = 0;
                }
                insideVertCount += pointPassesCollision[t];
              }
            } else if (j === 2) {
              for (let t = 0; t < 3; t++) {
                if (triangleList[k].pt[t].y > miny) {
                  pointPassesCollision[t] = 1;
                } else {
                  pointPassesCollision[t] = 0;
                }
                insideVertCount += pointPassesCollision[t];
              }
            } else {
              for (let t = 0; t < 3; t++) {
                if (triangleList[k].pt[t].y < maxy) {
                  pointPassesCollision[t] = 1;
                } else {
                  pointPassesCollision[t] = 0;
                }
                insideVertCount += pointPassesCollision[t];
              }
            }
            if (pointPassesCollision[1] && !pointPassesCollision[0]) {
              tempOrder = triangleList[k].pt[0];
              triangleList[k].pt[0] = triangleList[k].pt[1];
              triangleList[k].pt[1] = tempOrder;
              pointPassesCollision[0] = 1;
              pointPassesCollision[1] = 0;
            }
            if (pointPassesCollision[2] && !pointPassesCollision[1]) {
              tempOrder = triangleList[k].pt[1];
              triangleList[k].pt[1] = triangleList[k].pt[2];
              triangleList[k].pt[2] = tempOrder;
              pointPassesCollision[1] = 1;
              pointPassesCollision[2] = 0;
            }
            if (pointPassesCollision[1] && !pointPassesCollision[0]) {
              tempOrder = triangleList[k].pt[0];
              triangleList[k].pt[0] = triangleList[k].pt[1];
              triangleList[k].pt[1] = tempOrder;
              pointPassesCollision[0] = 1;
              pointPassesCollision[1] = 0;
            }
            if (insideVertCount === 0) {
              triangleList[k].culled = true;
            } else if (insideVertCount === 1) {
              triangleList[k].culled = false;
              const v0Tov1 = Vector3.sub(triangleList[k].pt[1], triangleList[k].pt[0]);
              const v0Tov2 = Vector3.sub(triangleList[k].pt[2], triangleList[k].pt[0]);
              const hitPointTimeRatio = edge - triangleList[k].pt[0].getArray()[comp];
              const distanceAlongV1 = hitPointTimeRatio / v0Tov1.getArray()[comp];
              const distanceAloneV2 = hitPointTimeRatio / v0Tov2.getArray()[comp];
              v0Tov1.scaleBy(distanceAlongV1);
              v0Tov1.addBy(triangleList[k].pt[0]);
              v0Tov2.scaleBy(distanceAloneV2);
              v0Tov2.addBy(triangleList[k].pt[0]);
              triangleList[k].pt[1] = v0Tov2;
              triangleList[k].pt[2] = v0Tov1;
            } else if (insideVertCount === 2) {
              triangleList[triangleCount] = dupTriangle(triangleList[k + 1]);
              triangleList[k].culled = false;
              triangleList[k + 1].culled = false;
              const v2Tov0 = Vector3.sub(triangleList[k].pt[0], triangleList[k].pt[2]);
              const v2Tov1 = Vector3.sub(triangleList[k].pt[1], triangleList[k].pt[2]);
              const hitPointTime_2_0 = edge - triangleList[k].pt[2].getArray()[comp];
              const distanceAloneVec_2_0 = hitPointTime_2_0 / v2Tov0.getArray()[comp];
              v2Tov0.scaleBy(distanceAloneVec_2_0);
              v2Tov0.addBy(triangleList[k].pt[2]);
              triangleList[k + 1].pt[0] = new Vector3(triangleList[k].pt[0]);
              triangleList[k + 1].pt[1] = new Vector3(triangleList[k].pt[1]);
              triangleList[k + 1].pt[2] = v2Tov0;
              const hitPointTime_2_1 = edge - triangleList[k].pt[2].getArray()[comp];
              const distanceAloneVec_2_1 = hitPointTime_2_1 / v2Tov1.getArray()[comp];
              v2Tov1.scaleBy(distanceAloneVec_2_1);
              v2Tov1.addBy(triangleList[k].pt[2]);
              triangleList[k].pt[0] = new Vector3(triangleList[k + 1].pt[1]);
              triangleList[k].pt[1] = new Vector3(triangleList[k + 1].pt[2]);
              triangleList[k].pt[2] = v2Tov1;
              triangleCount++;
              k++;
            } else {
              triangleList[k].culled = false;
            }
          }
          k++;
        }
      }
      for (let index = 0; index < triangleCount; index++) {
        if (!triangleList[index].culled) {
          for (let v = 0; v < 3; v++) {
            const z = triangleList[index].pt[v].z;
            if (nearPlane > z) {
              nearPlane = z;
            }
            if (farPlane < z) {
              farPlane = z;
            }
          }
        }
      }
    }
    return [nearPlane, farPlane];
  }
}

export class PointLight extends PunctualLight {
  /** @internal */
  protected _range: number;
  constructor(scene: Scene) {
    super(scene, LightType.POINT);
    this._range = 1;
    this.invalidateBoundingVolume();
  }
  get range() {
    return this._range;
  }
  set range(val: number) {
    this.setRange(val);
  }
  setRange(val: number) {
    if (this._range !== val) {
      this._range = val;
      this.invalidateUniforms();
      this.invalidateBoundingVolume();
    }
    return this;
  }
  isPointLight(): this is PointLight {
    return true;
  }
  /** @internal */
  computeBoundingVolume(bv: BoundingVolume): BoundingVolume {
    const bbox = bv ? (bv as BoundingBox) : new BoundingBox();
    bbox.minPoint = new Vector3(-this._range, -this._range, -this._range);
    bbox.maxPoint = new Vector3(this._range, this._range, this._range);
    return bbox;
  }
  /** @internal */
  computeUniforms() {
    const a = this.worldMatrix.getRow(3);
    const b = this.worldMatrix.getRow(2);
    this._positionRange = new Vector4(a.x, a.y, a.z, this.range);
    this._directionCutoff = new Vector4(b.x, b.y, b.z, 0);
    this._diffuseIntensity = new Vector4(this.color.x, this.color.y, this.color.z, this.intensity);
  }
}

export class SpotLight extends PunctualLight {
  /** @internal */
  protected _range: number;
  /** @internal */
  protected _cutoff: number;
  constructor(scene: Scene) {
    super(scene, LightType.SPOT);
    this._range = 1;
    this._cutoff = Math.cos(Math.PI / 4);
    this.invalidateBoundingVolume();
  }
  get range() {
    return this._range;
  }
  set range(val: number) {
    this.setRange(val);
  }
  setRange(val: number) {
    if (this._range !== val) {
      this._range = val;
      this.invalidateUniforms();
      this.invalidateBoundingVolume();
    }
    return this;
  }
  get cutoff() {
    return this._cutoff;
  }
  set cutoff(val: number) {
    this.setCutoff(val);
  }
  setCutoff(val: number) {
    if (this._cutoff !== val) {
      this._cutoff = val;
      this.invalidateUniforms();
      this.invalidateBoundingVolume();
    }
    return this;
  }
  isSpotLight(): this is SpotLight {
    return true;
  }
  /** @internal */
  computeBoundingVolume(bv: BoundingVolume): BoundingVolume {
    const bbox = bv ? (bv as BoundingBox) : new BoundingBox();
    const cosCutoff = Math.cos(this._cutoff);
    const r = (this._range / cosCutoff) * Math.sqrt(1 - cosCutoff * cosCutoff);
    bbox.minPoint = new Vector3(-r, -r, 0);
    bbox.maxPoint = new Vector3(r, r, this._range);
    return bbox;
  }
  /** @internal */
  computeUniforms() {
    const a = this.worldMatrix.getRow(3);
    const b = this.worldMatrix.getRow(2).scaleBy(-1);
    this._positionRange = new Vector4(a.x, a.y, a.z, this.range);
    this._directionCutoff = new Vector4(b.x, b.y, b.z, Math.cos(this.cutoff));
    this._diffuseIntensity = new Vector4(this.color.x, this.color.y, this.color.z, this.intensity);
  }
}
