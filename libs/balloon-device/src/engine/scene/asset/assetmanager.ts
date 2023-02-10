import { Device, BaseTexture, TextureFilter, TextureWrapping, GPUResourceUsageFlags, TextureFormat, Texture2D, GPUObject } from '../../device'
import { AssetHierarchyNode, AssetSkeleton, AssetSubMeshData, SharedModel } from './model';
import { GLTFLoader } from './loaders/gltf';
import { WebImageLoader } from './loaders/image/webimage_loader';
import { DDSLoader } from './loaders/dds/dds_loader';
import { SceneNode } from '../scene_node';
import { Mesh } from '../mesh';
import { Model } from '../model';
import { Skeleton } from '../skeleton';
import { SkinnedBoundingBox } from '../animation';
import { Vector3 } from '../../math';
import { BoundingBox } from '../bounding_volume';
import { isPowerOf2, nextPowerOf2 } from '../../../shared';
import { GammaBlitter } from '../blitter';
import { getSheenLutLoader, sheenLUTTextureName } from './builtin';
import { GraphNode } from '../graph_node';
import type { Scene } from '../scene';
import type { AbstractTextureLoader, AbstractModelLoader } from './loaders/loader';

export class AssetManager {
  static readonly BUILTIN_TEXTURE_SHEEN_LUT = sheenLUTTextureName;
  /** @internal */
  static _builtinTextures: {
    [name: string]: Promise<BaseTexture>
  } = {};
  /** @internal */
  static _builtinTextureLoaders: {
    [name: string]: (device: Device, texture?: BaseTexture) => Promise<BaseTexture>
  } = {
      [sheenLUTTextureName]: getSheenLutLoader(64)
    };
  /** @internal */
  private _device: Device;
  /** @internal */
  private _urlResolver: (url: string) => string;
  /** @internal */
  private _textureLoaders: AbstractTextureLoader[];
  /** @inernal */
  private _modelLoaders: AbstractModelLoader[];
  /** @internal */
  private _textures: {
    [url: string]: Promise<BaseTexture>
  };
  /** @internal */
  private _textures_nomipmap: {
    [url: string]: Promise<BaseTexture>
  };
  /** @internal */
  private _textures_srgb: {
    [url: string]: Promise<BaseTexture>,
  };
  /** @internal */
  private _textures_srgb_nomipmap: {
    [url: string]: Promise<BaseTexture>,
  };
  /** @internal */
  private _models: {
    [url: string]: Promise<SharedModel>
  };
  /** @internal */
  private _binaryDatas: {
    [url: string]: Promise<ArrayBuffer>
  };
  /** @internal */
  private _textDatas: {
    [url: string]: Promise<string>
  };
  constructor(device: Device) {
    this._device = device;
    this._urlResolver = null;
    this._textureLoaders = [new WebImageLoader(), new DDSLoader()];
    this._modelLoaders = [new GLTFLoader()];
    this._textures = {};
    this._textures_nomipmap = {};
    this._textures_srgb = {};
    this._textures_srgb_nomipmap = {};
    this._models = {};
    this._binaryDatas = {};
    this._textDatas = {};
  }
  get urlResolver(): (url: string) => string {
    return this._urlResolver;
  }
  set urlResolver(resolver: (url: string) => string) {
    this._urlResolver = resolver;
  }
  get device(): Device {
    return this._device;
  }
  async request(url: string, headers: Record<string, string> = {}, crossOrigin = 'anonymous'): Promise<Response> {
    url = this._urlResolver ? this._urlResolver(url) : url;
    return url ? fetch(url, {
      credentials: crossOrigin === 'anonymous' ? 'same-origin' : 'include',
      headers: headers
    }) : null;
  }
  clearCache() {
    this._textures = {};
    this._textures_nomipmap = {};
    this._textures_srgb = {};
    this._textures_srgb_nomipmap = {};
    this._models = {};
    this._binaryDatas = {};
    this._textDatas = {};
  }
  addTextureLoader(loader: AbstractTextureLoader) {
    if (loader) {
      this._textureLoaders.unshift(loader);
    }
  }
  addModelLoader(loader: AbstractModelLoader) {
    if (loader) {
      this._modelLoaders.unshift(loader);
    }
  }
  async fetchTextData(url: string): Promise<string> {
    let P = this._textDatas[url];
    if (!P) {
      P = this.loadTextData(url);
      this._textDatas[url] = P;
    }
    return P;
  }
  async fetchBinaryData(url: string): Promise<ArrayBuffer> {
    let P = this._binaryDatas[url];
    if (!P) {
      P = this.loadBinaryData(url);
      this._binaryDatas[url] = P;
    }
    return P;
  }
  async fetchTexture<T extends BaseTexture>(url: string, mimeType?: string, srgb?: boolean, noMipmap?: boolean): Promise<T> {
    const textures = srgb ? noMipmap ? this._textures_srgb_nomipmap : this._textures_srgb : noMipmap ? this._textures_nomipmap : this._textures;
    let P = textures[url];
    if (!P) {
      P = this.loadTexture(url, mimeType, srgb, noMipmap);
      textures[url] = P;
    }
    return P as Promise<T>;
  }
  async fetchModel(scene: Scene, url: string, mimeType?: string): Promise<SharedModel> {
    let P = this._models[url];
    if (!P) {
      P = this.loadModel(url, mimeType);
      this._models[url] = P;
    }
    return P;
  }
  async createModelNode(scene: Scene, url: string, mimeType?: string): Promise<Model> {
    const sharedModel = await this.fetchModel(scene, url, mimeType);
    return this.createSceneNode(scene, sharedModel);
  }
  async loadTextData(url: string): Promise<string> {
    const response = await this.request(url);
    if (!response.ok) {
      throw new Error(`Asset download failed: ${url}`);
    }
    return await response.text();
  }
  async loadBinaryData(url: string): Promise<ArrayBuffer> {
    const response = await this.request(url);
    if (!response.ok) {
      throw new Error(`Asset download failed: ${url}`);
    }
    return await response.arrayBuffer();
  }
  async loadTexture(url: string, mimeType?: string, srgb?: boolean, noMipmap?: boolean, texture?: BaseTexture): Promise<BaseTexture> {
    const response = await this.request(url);
    if (!response.ok) {
      throw new Error(`Asset download failed: ${url}`)
    }
    const data = await response.arrayBuffer();
    let ext = '';
    let filename = '';
    const dataUriMatchResult = url.match(/^data:([^;]+)/);
    if (dataUriMatchResult) {
      mimeType = mimeType || dataUriMatchResult[1];
    } else {
      filename = new URL(url, new URL(location.href).origin).pathname.split('/').filter(val => !!val).slice(-1)[0];
      const p = filename ? filename.lastIndexOf('.') : -1;
      ext = p >= 0 ? filename.substring(p).toLowerCase() : null;
      if (!mimeType) {
        if (ext === '.jpg' || ext === '.jpeg') {
          mimeType = 'image/jpg';
        } else if (ext === '.png') {
          mimeType = 'image/png';
        }
      }
    }
    for (const loader of this._textureLoaders) {
      if ((!ext || !loader.supportExtension(ext)) && (!mimeType || !loader.supportMIMEType(mimeType))) {
        continue;
      }
      const tex = await this.doLoadTexture(loader, filename, mimeType, data, !!srgb, !!noMipmap, texture);
      tex.name = filename;
      if (url.match(/^blob:/)) {
        tex.restoreHandler = async (tex: GPUObject) => {
          await this.doLoadTexture(loader, filename, mimeType, data, !!srgb, !!noMipmap, tex as BaseTexture);
        };
      } else {
        tex.restoreHandler = async (tex: GPUObject) => {
          await this.loadTexture(url, mimeType, srgb, noMipmap, tex as BaseTexture);
        };
      }
      return tex;
    }
    throw new Error(`Can not find loader for asset ${url}`);
  }
  async doLoadTexture(loader: AbstractTextureLoader, url: string, mimeType: string, data: ArrayBuffer, srgb: boolean, noMipmap: boolean, texture?: BaseTexture): Promise<BaseTexture> {
    if (this.device.getDeviceType() !== 'webgl') {
      return await loader.load(this, url, mimeType, data, srgb, noMipmap, texture);
    } else {
      let tex = await loader.load(this, url, mimeType, data, srgb, noMipmap);
      if (texture) {
        const magFilter = tex.width !== texture.width || tex.height !== texture.height ? TextureFilter.Linear : TextureFilter.Nearest;
        const minFilter = magFilter;
        const mipFilter = TextureFilter.None;
        const sampler = this.device.createSampler({
          addressU: TextureWrapping.ClampToEdge,
          addressV: TextureWrapping.ClampToEdge,
          magFilter,
          minFilter,
          mipFilter
        });
        const blitter = new GammaBlitter(1);
        blitter.blit(tex as any, texture as any, sampler);
        tex = texture;
      } else if (!noMipmap && (tex.isTexture2D() || tex.isTextureCube()) && (srgb || !isPowerOf2(tex.width) || !isPowerOf2(tex.height))) {
        const newWidth = !noMipmap && !isPowerOf2(tex.width) ? nextPowerOf2(tex.width) : tex.width;
        const newHeight = !noMipmap && !isPowerOf2(tex.height) ? nextPowerOf2(tex.height) : tex.height;
        const magFilter = newWidth !== tex.width || newHeight !== tex.height ? TextureFilter.Linear : TextureFilter.Nearest;
        const minFilter = magFilter;
        const mipFilter = TextureFilter.None;
        const sampler = this.device.createSampler({
          addressU: TextureWrapping.ClampToEdge,
          addressV: TextureWrapping.ClampToEdge,
          magFilter,
          minFilter,
          mipFilter
        });
        const blitter = new GammaBlitter(1);
        const newTexture = tex.isTexture2D()
          ? this.device.createTexture2D(TextureFormat.RGBA8UNORM, newWidth, newHeight, GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE)
          : this.device.createCubeTexture(TextureFormat.RGBA8UNORM, newWidth, GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE);

        blitter.blit(tex as any, newTexture as any, sampler);
        tex.dispose();
        tex = newTexture;
      }
      return tex;
    }
  }
  async loadModel(url: string, mimeType?: string, name?: string): Promise<SharedModel> {
    const response = await this.request(url);
    if (!response.ok) {
      throw new Error(`Asset download failed: ${url}`)
    }
    const data = await response.blob();
    const filename = new URL(url, new URL(location.href).origin).pathname.split('/').filter(val => !!val).slice(-1)[0];
    const p = filename ? filename.lastIndexOf('.') : -1;
    const ext = p >= 0 ? filename.substring(p) : null;
    for (const loader of this._modelLoaders) {
      if (!loader.supportExtension(ext) && !loader.supportMIMEType(mimeType || data.type)) {
        continue;
      }
      const model = await loader.load(this, url, mimeType || data.type, data);
      if (!model) {
        throw new Error(`Load asset failed: ${url}`);
      }
      model.name = name || filename;
      return model;
    }
    throw new Error(`Can not find loader for asset ${url}`);
  }
  static async fetchBuiltinTexture<T extends BaseTexture>(device: Device, name: string): Promise<T> {
    let P = this._builtinTextures[name];
    const loader = this._builtinTextureLoaders[name];
    if (!P) {
      if (!loader) {
        throw new Error(`Unknown builtin texture name: ${name}`);
      }
      P = loader(device);
      this._builtinTextures[name] = P;
    }
    const tex = await P;
    tex.restoreHandler = async tex => {
      await loader(device, tex as Texture2D);
    }
    return tex as T;
  }
  private createSceneNode(scene: Scene, model: SharedModel, sceneIndex?: number): Model {
    const node = new Model(scene);
    node.name = model.name;
    for (let i = 0; i < model.scenes.length; i++) {
      if (typeof sceneIndex === 'number' && sceneIndex >= 0 && i !== sceneIndex) {
        continue;
      } else if ((sceneIndex === undefined || sceneIndex === null) && model.activeScene >= 0 && i !== model.activeScene) {
        continue;
      }
      const assetScene = model.scenes[i];
      const skeletonMeshMap: Map<AssetSkeleton, { mesh: Mesh[], bounding: AssetSubMeshData[] }> = new Map();
      const nodeMap: Map<AssetHierarchyNode, SceneNode> = new Map();
      for (let k = 0; k < assetScene.rootNodes.length; k++) {
        this.setAssetNodeToSceneNode(scene, node, model, assetScene.rootNodes[k], skeletonMeshMap, nodeMap);
      }
      for (const animationData of model.animations) {
        const animation = node.addAnimation(animationData.name);
        if (animation) {
          for (const track of animationData.tracks) {
            animation.addAnimationTrack(nodeMap.get(track.node), track.interpolator);
          }
          for (const sk of animationData.skeletons) {
            const nodes = skeletonMeshMap.get(sk);
            if (nodes) {
              const skeleton = new Skeleton(sk.joints.map(val => nodeMap.get(val)), sk.inverseBindMatrices, sk.bindPoseMatrices);
              skeleton.updateJointMatrices(scene.device);
              animation.addSkeleton(skeleton, nodes.mesh, nodes.bounding.map(val => this.getBoundingInfo(skeleton, val)));
            }
          }
        }
        animation.stop();
      }
    }
    return node;
  }
  static setBuiltinTextureLoader(name: string, loader: (device: Device) => Promise<BaseTexture>) {
    if (loader) {
      this._builtinTextureLoaders[name] = loader;
    } else {
      delete this._builtinTextureLoaders[name];
    }
  }
  private getBoundingInfo(skeleton: Skeleton, meshData: AssetSubMeshData): SkinnedBoundingBox {
    const indices = [0, 0, 0, 0, 0, 0];
    let minx = Number.MAX_VALUE;
    let maxx = -Number.MAX_VALUE;
    let miny = Number.MAX_VALUE;
    let maxy = -Number.MAX_VALUE;
    let minz = Number.MAX_VALUE;
    let maxz = -Number.MAX_VALUE;
    const v = meshData.rawPositions;
    const vert = new Vector3();
    const tmpV0 = new Vector3();
    const tmpV1 = new Vector3();
    const tmpV2 = new Vector3();
    const tmpV3 = new Vector3();
    const numVertices = Math.floor(v.length / 3);
    for (let i = 0; i < numVertices; i++) {
      vert.set(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]);
      skeleton.jointMatrices[meshData.rawBlendIndices[i * 4 + 0]].transformPointAffine(vert, tmpV0).scaleBy(meshData.rawJointWeights[i * 4 + 0]);
      skeleton.jointMatrices[meshData.rawBlendIndices[i * 4 + 1]].transformPointAffine(vert, tmpV1).scaleBy(meshData.rawJointWeights[i * 4 + 1]);
      skeleton.jointMatrices[meshData.rawBlendIndices[i * 4 + 2]].transformPointAffine(vert, tmpV2).scaleBy(meshData.rawJointWeights[i * 4 + 2]);
      skeleton.jointMatrices[meshData.rawBlendIndices[i * 4 + 3]].transformPointAffine(vert, tmpV3).scaleBy(meshData.rawJointWeights[i * 4 + 3]);
      tmpV0.addBy(tmpV1).addBy(tmpV2).addBy(tmpV3);
      if (tmpV0.x < minx) {
        minx = tmpV0.x;
        indices[0] = i;
      }
      if (tmpV0.x > maxx) {
        maxx = tmpV0.x;
        indices[1] = i;
      }
      if (tmpV0.y < miny) {
        miny = tmpV0.y;
        indices[2] = i;
      }
      if (tmpV0.y > maxy) {
        maxy = tmpV0.y;
        indices[3] = i;
      }
      if (tmpV0.z < minz) {
        minz = tmpV0.z;
        indices[4] = i;
      }
      if (tmpV0.z > maxz) {
        maxz = tmpV0.z;
        indices[5] = i;
      }
    }
    const info: SkinnedBoundingBox = {
      boundingVertexBlendIndices: new Float32Array(Array.from({ length: 6 * 4 }).map((val, index) => meshData.rawBlendIndices[indices[index >> 2] * 4 + index % 4])),
      boundingVertexJointWeights: new Float32Array(Array.from({ length: 6 * 4 }).map((val, index) => meshData.rawJointWeights[indices[index >> 2] * 4 + index % 4])),
      boundingVertices: Array.from({ length: 6 }).map((val, index) => new Vector3(meshData.rawPositions[indices[index] * 3], meshData.rawPositions[indices[index] * 3 + 1], meshData.rawPositions[indices[index] * 3 + 2])),
      boundingBox: new BoundingBox,
    };
    return info;
  }
  private setAssetNodeToSceneNode(scene: Scene, parent: SceneNode, model: SharedModel, assetNode: AssetHierarchyNode, skeletonMeshMap: Map<AssetSkeleton, { mesh: Mesh[], bounding: AssetSubMeshData[] }>, nodeMap: Map<AssetHierarchyNode, SceneNode>) {
    const node: SceneNode = new SceneNode(scene);
    nodeMap.set(assetNode, node);
    node.name = `${assetNode.name}`
    node.position = assetNode.position;
    node.rotation = assetNode.rotation;
    node.scaling = assetNode.scaling;
    if (assetNode.mesh) {
      const meshData = assetNode.mesh;
      const skeleton = assetNode.skeleton;
      for (const subMesh of meshData.subMeshes) {
        const meshNode = new Mesh(scene);
        meshNode.renderOrder = GraphNode.ORDER_INHERITED;
        meshNode.clipMode = GraphNode.CLIP_INHERITED;
        meshNode.showState = GraphNode.SHOW_INHERITED;
        meshNode.pickMode = GraphNode.PICK_INHERITED;
        meshNode.primitive = subMesh.primitive;
        meshNode.material = subMesh.material;
        // meshNode.drawBoundingBox = true;
        meshNode.reparent(node);
        if (skeleton) {
          if (!skeletonMeshMap.has(skeleton)) {
            skeletonMeshMap.set(skeleton, { mesh: [meshNode], bounding: [subMesh] });
          } else {
            skeletonMeshMap.get(skeleton).mesh.push(meshNode);
            skeletonMeshMap.get(skeleton).bounding.push(subMesh);
          }
        }
      }
    }
    node.reparent(parent);
    for (const child of assetNode.children) {
      this.setAssetNodeToSceneNode(scene, node, model, child, skeletonMeshMap, nodeMap);
    }
  }
}
