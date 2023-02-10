/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Device,
  GPUDataBuffer,
  TextureFilter,
  TextureWrapping,
  GPUResourceUsageFlags,
  FaceMode,
  PrimitiveType,
  Texture2D,
  IndexBuffer,
  VERTEX_ATTRIB_POSITION,
  VERTEX_ATTRIB_NORMAL,
  VERTEX_ATTRIB_TANGENT,
  VERTEX_ATTRIB_TEXCOORD0,
  VERTEX_ATTRIB_TEXCOORD1,
  VERTEX_ATTRIB_TEXCOORD2,
  VERTEX_ATTRIB_TEXCOORD3,
  VERTEX_ATTRIB_TEXCOORD4,
  VERTEX_ATTRIB_TEXCOORD5,
  VERTEX_ATTRIB_TEXCOORD6,
  VERTEX_ATTRIB_TEXCOORD7,
  getVertexAttribName,
  VERTEX_ATTRIB_DIFFUSE,
  VERTEX_ATTRIB_BLEND_INDICES,
  VERTEX_ATTRIB_BLEND_WEIGHT,
  PBStructTypeInfo,
  PBArrayTypeInfo,
  PBPrimitiveTypeInfo,
  makePrimitiveType,
  I8_BITMASK,
  U8_BITMASK,
  I16_BITMASK,
  U16_BITMASK,
  I32_BITMASK,
  U32_BITMASK,
  F32_BITMASK,
  StructuredBuffer,
  getVertexBufferAttribType,
} from '../../../../device';
import { Vector3, Vector4, Matrix4x4, Quaternion } from '../../../../math';
import { SharedModel, AssetHierarchyNode, AssetMeshData, AssetSkeleton, AssetScene, AssetAnimationData, AssetSubMeshData, AssetMaterial, AssetUnlitMaterial, AssetPBRMaterialMR, AssetPBRMaterialSG, AssetMaterialCommon, MaterialTextureInfo, AssetPBRMaterialCommon } from '../../model';
import { BoundingBox } from '../../../bounding_volume';
import { Primitive } from '../../../primitive';
import { StandardMaterial, UnlitMaterial, PBRMetallicRoughnessMaterial, PBRSpecularGlossinessMaterial } from '../../../materiallib';
import { ComponentType, GLTFAccessor } from './helpers';
import { Interpolator, InterpolationMode, InterpolationTarget } from '../../../interpolator';
import { AssetManager } from '../../assetmanager';
import { AbstractModelLoader } from '../loader';
import type { AnimationChannel, AnimationSampler, GlTf, Material, TextureInfo } from './gltf';
import type { TypedArray } from '../../../../../shared';


export interface GLTFContent extends GlTf {
  _manager: AssetManager;
  _loadedBuffers: ArrayBuffer[];
  _accessors: GLTFAccessor[];
  _bufferCache: { [name: string]: GPUDataBuffer };
  _textureCache: { [name: string]: Texture2D };
  _primitiveCache: { [hash: string]: Primitive };
  _materialCache: { [hash: string]: StandardMaterial };
  _accessorCache: { [index: number]: { array: TypedArray, typeMask: number, elementCount: number } };
  _nodes: AssetHierarchyNode[];
  _meshes: AssetMeshData[];
}

export class GLTFLoader extends AbstractModelLoader {
  supportExtension(ext: string): boolean {
    return ext === '.gltf' || ext === '.glb';
  }
  supportMIMEType(mimeType: string): boolean {
    return mimeType === 'model/gltf+json' || mimeType === 'model/gltf-binary';
  }
  async load(assetManager: AssetManager, url: string, mimeType: string, data: Blob) {
    const buffer = await data.arrayBuffer();
    if (this.isGLB(buffer)) {
      return this.loadBinary(assetManager, url, buffer);
    }
    const gltf = await new Response(data).json() as GLTFContent;
    gltf._manager = assetManager;
    gltf._loadedBuffers = null;
    return this.loadJson(url, gltf);
  }
  async loadBinary(assetManager: AssetManager, url: string, buffer: ArrayBuffer): Promise<SharedModel> {
    const jsonChunkType = 0x4E4F534A;
    const binaryChunkType = 0x004E4942;
    let gltf: GLTFContent = null;
    const buffers: ArrayBuffer[] = [];
    const chunkInfos = this.getGLBChunkInfos(buffer);
    for (const info of chunkInfos) {
      if (info.type === jsonChunkType && !gltf) {
        const jsonSlice = new Uint8Array(buffer, 20, info.length);
        const stringBuffer = new TextDecoder('utf-8').decode(jsonSlice);
        gltf = JSON.parse(stringBuffer);
      } else if (info.type === binaryChunkType) {
        buffers.push(buffer.slice(info.start, info.start + info.length));
      }
    }
    if (gltf) {
      gltf._manager = assetManager;
      gltf._loadedBuffers = buffers;
      return this.loadJson(url, gltf);
    }
    return null;
  }
  async loadJson(url: string, gltf: GLTFContent): Promise<SharedModel> {
    console.log(`GLTF extensions used: ${gltf.extensionsUsed || []}`);
    gltf._accessors = [];
    gltf._bufferCache = {};
    gltf._textureCache = {};
    gltf._primitiveCache = {};
    gltf._materialCache = {};
    gltf._accessorCache = {};
    gltf._nodes = [];
    gltf._meshes = [];
    // check asset property
    const asset = gltf.asset;
    if (asset) {
      const gltfVersion = asset.version;
      if (gltfVersion !== '2.0') {
        console.error(`Invalid GLTF version: ${gltfVersion}`);
        return null;
      }
    }
    gltf._baseURI = url.substring(0, url.lastIndexOf('/') + 1);
    if (!gltf._loadedBuffers) {
      gltf._loadedBuffers = [];
      const buffers = gltf.buffers;
      if (buffers) {
        for (const buffer of buffers) {
          const uri = this._normalizeURI(gltf._baseURI, buffer.uri);
          const buf = await gltf._manager.fetchBinaryData(uri);
          // const buf = (await new FileLoader(null, 'arraybuffer').load(uri)) as ArrayBuffer;
          if (buffer.byteLength !== buf.byteLength) {
            console.error(`Invalid GLTF: buffer byte length error.`);
            return null;
          }
          gltf._loadedBuffers.push(buf);
        }
      }
    }
    const accessors = gltf.accessors;
    if (accessors) {
      for (const accessor of gltf.accessors) {
        gltf._accessors.push(new GLTFAccessor(accessor));
      }
    }
    const scenes = gltf.scenes;
    if (scenes) {
      const sharedModel = new SharedModel();
      await this._loadMeshes(gltf, sharedModel);
      this._loadNodes(gltf, sharedModel);
      this._loadSkins(gltf, sharedModel);
      for (let i = 0; i < gltf.nodes?.length; i++) {
        if (typeof gltf.nodes[i].skin === 'number' && gltf.nodes[i].skin >= 0) {
          gltf._nodes[i].skeleton = sharedModel.skeletons[gltf.nodes[i].skin];
        }
      }
      this._loadAnimations(gltf, sharedModel);
      for (const scene of scenes) {
        const assetScene = new AssetScene(scene.name);
        for (const node of scene.nodes) {
          assetScene.rootNodes.push(gltf._nodes[node]);
        }
        sharedModel.scenes.push(assetScene);
      }
      if (typeof gltf.scene === 'number') {
        sharedModel.activeScene = gltf.scene;
      }
      return sharedModel;
    }
    return null;
  }
  /** @internal */
  private _normalizeURI(baseURI: string, uri: string) {
    const s = uri.toLowerCase();
    if (s.startsWith('http://')
      || s.startsWith('https://')
      || s.startsWith('blob:')
      || s.startsWith('data:')) {
      // absolute path
      return encodeURI(uri);
    }
    uri = uri.replace(/\.\//g, '');
    uri = decodeURIComponent(uri);
    if (uri[0] === '/') {
      uri = uri.slice(1);
    }
    uri = uri.split('/').map(val => encodeURIComponent(val)).join('/');
    return baseURI + uri;
  }
  /** @internal */
  private _loadNodes(gltf: GLTFContent, model: SharedModel) {
    if (gltf.nodes) {
      for (let i = 0; i < gltf.nodes.length; i++) {
        this._loadNode(gltf, i, null, model);
      }
      for (const node of gltf._nodes) {
        if (!node.parent) {
          node.computeTransforms(null);
        }
      }
    }
  }
  /** @internal */
  private _loadSkins(gltf: GLTFContent, model: SharedModel) {
    if (gltf.skins) {
      for (let i = 0; i < gltf.skins.length; i++) {
        const skinInfo = gltf.skins[i];
        const skeleton = new AssetSkeleton(skinInfo.name);
        if (typeof skinInfo.skeleton === 'number') {
          skeleton.pivot = gltf._nodes[skinInfo.skeleton];
        }
        const accessor = gltf._accessors[skinInfo.inverseBindMatrices];
        if (!accessor || accessor.type !== 'MAT4' || accessor.componentType !== ComponentType.FLOAT) {
          throw new Error('Invalid GLTF inverse bind matricies accessor');
        }
        const matrices = typeof skinInfo.inverseBindMatrices === 'number' ? accessor.getDeinterlacedView(gltf) as Float32Array : null;
        skinInfo.joints.forEach((joint, index) => {
          const m = index * 16;
          skeleton.addJoint(gltf._nodes[joint], matrices ? new Matrix4x4(matrices.subarray(m, m + 16)) : Matrix4x4.identity());
        });
        model.addSkeleton(skeleton);
      }
    }
  }
  /** @internal */
  private _loadAnimations(gltf: GLTFContent, model: SharedModel) {
    if (gltf.animations) {
      for (let i = 0; i < gltf.animations.length; i++) {
        const animation = this._loadAnimation(gltf, i, model);
        model.addAnimation(animation);
      }
    }
  }
  /** @internal */
  private collectNodes(gltf: GLTFContent): Map<AssetHierarchyNode, {
    translate: Vector3,
    scale: Vector3,
    rotation: Quaternion,
    worldTransform: Matrix4x4
  }> {
    const collect: Map<AssetHierarchyNode, {
      translate: Vector3,
      scale: Vector3,
      rotation: Quaternion,
      worldTransform: Matrix4x4
    }> = new Map();
    for (const node of gltf._nodes) {
      collect.set(node, {
        translate: node.position || Vector3.zero(),
        rotation: node.rotation || Quaternion.identity(),
        scale: node.scaling || Vector3.one(),
        worldTransform: null
      });
    }
    return collect;
  }
  /** @internal */
  private updateNodeTransform(nodeTransforms: Map<AssetHierarchyNode, {
    translate: Vector3,
    scale: Vector3,
    rotation: Quaternion,
    worldTransform: Matrix4x4
  }>, node: AssetHierarchyNode) {
    const transform = nodeTransforms.get(node);
    if (!transform.worldTransform) {
      transform.worldTransform = Matrix4x4.scaling(transform.scale).rotateLeft(transform.rotation).translateLeft(transform.translate);
      if (node.parent) {
        this.updateNodeTransform(nodeTransforms, node.parent);
        transform.worldTransform.multiplyLeft(nodeTransforms.get(node.parent).worldTransform);
      }
    }
  }
  /** @internal */
  private getAnimationInfo(gltf: GLTFContent, index: number): {
    name: string;
    channels: AnimationChannel[],
    samplers: AnimationSampler[],
    interpolators: Interpolator[],
    maxTime: number,
    nodes: Map<AssetHierarchyNode, {
      translate: Vector3,
      scale: Vector3,
      rotation: Quaternion,
      worldTransform: Matrix4x4
    }>
  } {
    const animationInfo = gltf.animations[index];
    const name = animationInfo.name || null;
    const channels = animationInfo.channels;
    const samplers = animationInfo.samplers;
    const interpolators = [] as Interpolator[];
    const nodes = this.collectNodes(gltf);
    let maxTime = 0;
    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i];
      const sampler = samplers[channel.sampler];
      const input = gltf._accessors[sampler.input].getNormalizedDeinterlacedView(gltf);
      const output = gltf._accessors[sampler.output].getNormalizedDeinterlacedView(gltf);
      const mode = sampler.interpolation === 'STEP'
        ? InterpolationMode.STEP
        : sampler.interpolation === 'CUBICSPLINE'
          ? InterpolationMode.CUBICSPLINE
          : InterpolationMode.LINEAR;
      const target = channel.target.path === 'rotation'
        ? InterpolationTarget.ROTATION
        : channel.target.path === 'translation'
          ? InterpolationTarget.TRANSLATION
          : channel.target.path === 'scale'
            ? InterpolationTarget.SCALING
            : InterpolationTarget.WEIGHTS;
      // TODO: morph target animation
      interpolators.push(new Interpolator(mode, target, input, output, 0));
      const max = input[input.length - 1];
      if (max > maxTime) {
        maxTime = max;
      }
    }
    return { name, channels, samplers, interpolators, maxTime, nodes };
  }
  /** @internal */
  private _loadAnimation(gltf: GLTFContent, index: number, model: SharedModel): AssetAnimationData {
    const animationInfo = this.getAnimationInfo(gltf, index);
    const animationData: AssetAnimationData = { name: animationInfo.name, tracks: [], skeletons: [], nodes: [] };
    for (let i = 0; i < animationInfo.channels.length; i++) {
      const targetNode = gltf._nodes[animationInfo.channels[i].target.node];
      animationData.tracks.push({
        node: targetNode,
        interpolator: animationInfo.interpolators[i]
      });
      if (animationData.nodes.indexOf(targetNode) < 0) {
        animationData.nodes.push(targetNode);
      }
      if (targetNode.skeletonAttached && animationData.skeletons.indexOf(targetNode.skeletonAttached) < 0) {
        animationData.skeletons.push(targetNode.skeletonAttached);
      }
    }
    return animationData;
  }
  /** @internal */
  private _loadNode(gltf: GLTFContent, nodeIndex: number, parent: AssetHierarchyNode, model: SharedModel): AssetHierarchyNode {
    let node: AssetHierarchyNode = gltf._nodes[nodeIndex];
    if (node) {
      if (parent) {
        if (node.parent) {
          throw new Error('invalid node hierarchy');
        }
        parent.addChild(node);
      }
      return node;
    }
    const nodeInfo = gltf.nodes?.[nodeIndex];
    if (nodeInfo) {
      node = model.addNode(parent, nodeIndex, nodeInfo.name);
      if (typeof nodeInfo.mesh === 'number') {
        node.mesh = gltf._meshes[nodeInfo.mesh];
      }
      if (!(typeof nodeInfo.skin === 'number') || nodeInfo.skin < 0) {
        // GLTF spec: Only the joint transforms are applied to the skinned mesh; the transform of the skinned mesh node MUST be ignored.
        if (nodeInfo.matrix) {
          const matrix = new Matrix4x4(nodeInfo.matrix);
          matrix.decompose(node.scaling, node.rotation, node.position);
        } else {
          if (nodeInfo.rotation) {
            node.rotation.assign(nodeInfo.rotation);
          }
          if (nodeInfo.scale) {
            node.scaling.assign(nodeInfo.scale);
          }
          if (nodeInfo.translation) {
            node.position.assign(nodeInfo.translation);
          }
        }
      }
      gltf._nodes[nodeIndex] = node;
      if (nodeInfo.children) {
        for (const childIndex of nodeInfo.children) {
          this._loadNode(gltf, childIndex, node, model);
        }
      }
    } else {
      throw new Error(`invalid GLTF node: ${nodeIndex}`);
    }
    return node;
  }
  /** @internal */
  private async _loadMeshes(gltf: GLTFContent, model: SharedModel) {
    if (gltf.meshes) {
      for (let i = 0; i < gltf.meshes.length; i++) {
        gltf._meshes[i] = await this._loadMesh(gltf, i);
      }
    }
  }
  /** @internal */
  private async _loadMesh(gltf: GLTFContent, meshIndex: number): Promise<AssetMeshData> {
    const meshInfo = gltf.meshes && gltf.meshes[meshIndex];
    let mesh: AssetMeshData = null;
    if (meshInfo) {
      mesh = { subMeshes: [] };
      const primitives = meshInfo.primitives;
      const meshName = meshInfo.name || null;
      if (primitives) {
        for (const p of primitives) {
          const subMeshData: AssetSubMeshData = {
            primitive: null,
            material: null,
            rawPositions: null,
            rawBlendIndices: null,
            rawJointWeights: null,
          };
          const hash = `(${Object.getOwnPropertyNames(p.attributes).sort().map(k => `${k}:${p.attributes[k]}`).join(',')})-(${p.indices})-(${p.mode})`;
          let primitive: Primitive = p.targets ? null : gltf._primitiveCache[hash];
          if (!primitive) {
            primitive = new Primitive(gltf._manager.device);
            const attributes = p.attributes;
            for (const attrib in attributes) {
              this._loadVertexBuffer(gltf, attrib, attributes[attrib], primitive, subMeshData);
            }
            const indices = p.indices;
            if (typeof indices === 'number') {
              this._loadIndexBuffer(gltf, indices, primitive, subMeshData);
            }
            let primitiveType = p.mode;
            if (typeof primitiveType !== 'number') {
              primitiveType = 4;
            }
            primitive.primitiveType = this._primitiveType(primitiveType);
            gltf._primitiveCache[hash] = primitive;
          }
          const hasVertexNormal = !!primitive.getVertexBuffer(VERTEX_ATTRIB_NORMAL);
          const hasVertexColor = !!primitive.getVertexBuffer(VERTEX_ATTRIB_DIFFUSE);
          const hasVertexTangent = !!primitive.getVertexBuffer(VERTEX_ATTRIB_TANGENT);
          const materialHash = `${p.material}.${Number(hasVertexNormal)}.${Number(hasVertexColor)}.${Number(hasVertexTangent)}`;
          let material = gltf._materialCache[materialHash];
          if (!material) {
            const materialInfo = p.material !== undefined ? gltf.materials[p.material] : null;
            material = await this._loadMaterial(gltf, materialInfo, hasVertexColor, hasVertexNormal, hasVertexTangent);
            gltf._materialCache[materialHash] = material;
          }
          subMeshData.primitive = primitive;
          subMeshData.material = material;
          mesh.subMeshes.push(subMeshData);
        }
      }
    }
    return mesh;
  }
  private async _createMaterial(device: Device, assetMaterial: AssetMaterial): Promise<StandardMaterial> {
    if (assetMaterial.type === 'unlit') {
      const unlitAssetMaterial = assetMaterial as AssetUnlitMaterial;
      const unlitMaterial = new UnlitMaterial(device);
      unlitMaterial.lightModel.albedo = unlitAssetMaterial.diffuse ?? Vector4.one();
      if (unlitAssetMaterial.diffuseMap) {
        unlitMaterial.lightModel.setAlbedoMap(unlitAssetMaterial.diffuseMap.texture, unlitAssetMaterial.diffuseMap.sampler, unlitAssetMaterial.diffuseMap.texCoord, unlitAssetMaterial.diffuseMap.transform);
      }
      unlitMaterial.vertexColor = unlitAssetMaterial.common.vertexColor;
      if (assetMaterial.common.alphaMode === 'blend') {
        unlitMaterial.alphaBlend = true;
      } else if (assetMaterial.common.alphaMode === 'mask') {
        unlitMaterial.alphaCutoff = assetMaterial.common.alphaCutoff;
      }
      if (assetMaterial.common.doubleSided) {
        const rasterizerState = unlitMaterial.stateSet.useRasterizerState();
        rasterizerState.setCullMode(FaceMode.NONE);
      }
      unlitMaterial.vertexNormal = !!assetMaterial.common.vertexNormal;
      return unlitMaterial;
    } else if (assetMaterial.type === 'pbrSpecularGlossiness') {
      const assetPBRMaterial = assetMaterial as AssetPBRMaterialSG;
      const pbrMaterial = new PBRSpecularGlossinessMaterial(device);
      pbrMaterial.lightModel.ior = assetPBRMaterial.ior;
      pbrMaterial.lightModel.albedo = assetPBRMaterial.diffuse;
      pbrMaterial.lightModel.specularFactor = new Vector4(assetPBRMaterial.specular.x, assetPBRMaterial.specular.y, assetPBRMaterial.specular.z, 1);
      pbrMaterial.lightModel.glossinessFactor = assetPBRMaterial.glossness;
      if (assetPBRMaterial.diffuseMap) {
        pbrMaterial.lightModel.setAlbedoMap(assetPBRMaterial.diffuseMap.texture, assetPBRMaterial.diffuseMap.sampler, assetPBRMaterial.diffuseMap.texCoord, assetPBRMaterial.diffuseMap.transform);
      }
      if (assetPBRMaterial.common.normalMap) {
        pbrMaterial.lightModel.setNormalMap(assetPBRMaterial.common.normalMap.texture, assetPBRMaterial.common.normalMap.sampler, assetPBRMaterial.common.normalMap.texCoord, assetPBRMaterial.common.normalMap.transform);
      }
      pbrMaterial.lightModel.normalScale = assetPBRMaterial.common.bumpScale;
      if (assetPBRMaterial.common.emissiveMap) {
        pbrMaterial.lightModel.setEmissiveMap(assetPBRMaterial.common.emissiveMap.texture, assetPBRMaterial.common.emissiveMap.sampler, assetPBRMaterial.common.emissiveMap.texCoord, assetPBRMaterial.common.emissiveMap.transform);
      }
      pbrMaterial.lightModel.emissiveColor = assetPBRMaterial.common.emissiveColor;
      pbrMaterial.lightModel.emissiveStrength = assetPBRMaterial.common.emissiveStrength;
      if (assetPBRMaterial.common.occlusionMap) {
        pbrMaterial.lightModel.setOcclusionMap(assetPBRMaterial.common.occlusionMap.texture, assetPBRMaterial.common.occlusionMap.sampler, assetPBRMaterial.common.occlusionMap.texCoord, assetPBRMaterial.common.occlusionMap.transform);
      }
      pbrMaterial.lightModel.occlusionStrength = assetPBRMaterial.common.occlusionStrength;
      if (assetPBRMaterial.specularGlossnessMap) {
        pbrMaterial.lightModel.setSpecularMap(assetPBRMaterial.specularGlossnessMap.texture, assetPBRMaterial.specularGlossnessMap.sampler, assetPBRMaterial.specularGlossnessMap.texCoord, assetPBRMaterial.specularGlossnessMap.transform);
      }
      pbrMaterial.vertexTangent = assetPBRMaterial.common.useTangent;
      pbrMaterial.vertexColor = assetPBRMaterial.common.vertexColor;
      if (assetPBRMaterial.common.alphaMode === 'blend') {
        pbrMaterial.alphaBlend = true;
      } else if (assetPBRMaterial.common.alphaMode === 'mask') {
        pbrMaterial.alphaCutoff = assetPBRMaterial.common.alphaCutoff;
      }
      if (assetPBRMaterial.common.doubleSided) {
        const rasterizerState = pbrMaterial.stateSet.useRasterizerState();
        rasterizerState.setCullMode(FaceMode.NONE);
      }
      pbrMaterial.vertexNormal = !!assetMaterial.common.vertexNormal;
      return pbrMaterial;
    } else if (assetMaterial.type === 'pbrMetallicRoughness') {
      const assetPBRMaterial = assetMaterial as AssetPBRMaterialMR;
      const pbrMaterial = new PBRMetallicRoughnessMaterial(device);
      pbrMaterial.lightModel.ior = assetPBRMaterial.ior;
      pbrMaterial.lightModel.albedo = assetPBRMaterial.diffuse;
      pbrMaterial.lightModel.metallic = assetPBRMaterial.metallic;
      pbrMaterial.lightModel.roughness = assetPBRMaterial.roughness;
      if (assetPBRMaterial.diffuseMap) {
        pbrMaterial.lightModel.setAlbedoMap(assetPBRMaterial.diffuseMap.texture, assetPBRMaterial.diffuseMap.sampler, assetPBRMaterial.diffuseMap.texCoord, assetPBRMaterial.diffuseMap.transform);
      }
      if (assetPBRMaterial.common.normalMap) {
        pbrMaterial.lightModel.setNormalMap(assetPBRMaterial.common.normalMap.texture, assetPBRMaterial.common.normalMap.sampler, assetPBRMaterial.common.normalMap.texCoord, assetPBRMaterial.common.normalMap.transform);
      }
      pbrMaterial.lightModel.normalScale = assetPBRMaterial.common.bumpScale;
      if (assetPBRMaterial.common.emissiveMap) {
        pbrMaterial.lightModel.setEmissiveMap(assetPBRMaterial.common.emissiveMap.texture, assetPBRMaterial.common.emissiveMap.sampler, assetPBRMaterial.common.emissiveMap.texCoord, assetPBRMaterial.common.emissiveMap.transform);
      }
      pbrMaterial.lightModel.emissiveColor = assetPBRMaterial.common.emissiveColor;
      pbrMaterial.lightModel.emissiveStrength = assetPBRMaterial.common.emissiveStrength;
      if (assetPBRMaterial.common.occlusionMap) {
        pbrMaterial.lightModel.setOcclusionMap(assetPBRMaterial.common.occlusionMap.texture, assetPBRMaterial.common.occlusionMap.sampler, assetPBRMaterial.common.occlusionMap.texCoord, assetPBRMaterial.common.occlusionMap.transform);
      }
      pbrMaterial.lightModel.occlusionStrength = assetPBRMaterial.common.occlusionStrength;
      if (assetPBRMaterial.metallicMap) {
        pbrMaterial.lightModel.setMetallicMap(assetPBRMaterial.metallicMap.texture, assetPBRMaterial.metallicMap.sampler, assetPBRMaterial.metallicMap.texCoord, assetPBRMaterial.metallicMap.transform);
      }
      pbrMaterial.lightModel.metallicIndex = assetPBRMaterial.metallicIndex;
      pbrMaterial.lightModel.roughnessIndex = assetPBRMaterial.roughnessIndex;
      pbrMaterial.lightModel.specularFactor = assetPBRMaterial.specularFactor;
      if (assetPBRMaterial.specularMap) {
        pbrMaterial.lightModel.setSpecularMap(assetPBRMaterial.specularMap.texture, assetPBRMaterial.specularMap.sampler, assetPBRMaterial.specularMap.texCoord, assetPBRMaterial.specularMap.transform);
      }
      if (assetPBRMaterial.specularColorMap) {
        pbrMaterial.lightModel.setSpecularColorMap(assetPBRMaterial.specularColorMap.texture, assetPBRMaterial.specularColorMap.sampler, assetPBRMaterial.specularColorMap.texCoord, assetPBRMaterial.specularColorMap.transform);
      }
      if (assetPBRMaterial.sheen) {
        const sheen = assetPBRMaterial.sheen;
        pbrMaterial.lightModel.useSheen = true;
        pbrMaterial.lightModel.sheenColorFactor = sheen.sheenColorFactor;
        pbrMaterial.lightModel.sheenRoughnessFactor = sheen.sheenRoughnessFactor;
        pbrMaterial.lightModel.setSheenLut(await AssetManager.fetchBuiltinTexture(device, AssetManager.BUILTIN_TEXTURE_SHEEN_LUT));
        if (sheen.sheenColorMap) {
          pbrMaterial.lightModel.setSheenColorMap(sheen.sheenColorMap.texture, sheen.sheenColorMap.sampler, sheen.sheenColorMap.texCoord, sheen.sheenColorMap.transform);
        }
        if (sheen.sheenRoughnessMap) {
          pbrMaterial.lightModel.setSheenRoughnessMap(sheen.sheenRoughnessMap.texture, sheen.sheenRoughnessMap.sampler, sheen.sheenRoughnessMap.texCoord, sheen.sheenRoughnessMap.transform)
        }
      }
      if (assetPBRMaterial.clearcoat) {
        const cc = assetPBRMaterial.clearcoat;
        pbrMaterial.lightModel.useClearcoat = true;
        pbrMaterial.lightModel.clearcoatIntensity = cc.clearCoatFactor;
        pbrMaterial.lightModel.clearcoatRoughnessFactor = cc.clearCoatRoughnessFactor;
        if (cc.clearCoatIntensityMap) {
          pbrMaterial.lightModel.setClearcoatIntensityMap(cc.clearCoatIntensityMap.texture, cc.clearCoatIntensityMap.sampler, cc.clearCoatIntensityMap.texCoord, cc.clearCoatIntensityMap.transform);
        }
        if (cc.clearCoatRoughnessMap) {
          pbrMaterial.lightModel.setClearcoatRoughnessMap(cc.clearCoatRoughnessMap.texture, cc.clearCoatRoughnessMap.sampler, cc.clearCoatRoughnessMap.texCoord, cc.clearCoatRoughnessMap.transform);
        }
        if (cc.clearCoatNormalMap) {
          pbrMaterial.lightModel.setClearcoatNormalMap(cc.clearCoatNormalMap.texture, cc.clearCoatNormalMap.sampler, cc.clearCoatNormalMap.texCoord, cc.clearCoatNormalMap.transform);
        }
      }
      pbrMaterial.vertexTangent = assetPBRMaterial.common.useTangent;
      pbrMaterial.vertexColor = assetPBRMaterial.common.vertexColor;
      if (assetPBRMaterial.common.alphaMode === 'blend') {
        pbrMaterial.alphaBlend = true;
      } else if (assetPBRMaterial.common.alphaMode === 'mask') {
        pbrMaterial.alphaCutoff = assetPBRMaterial.common.alphaCutoff;
      }
      if (assetPBRMaterial.common.doubleSided) {
        const rasterizerState = pbrMaterial.stateSet.useRasterizerState();
        rasterizerState.setCullMode(FaceMode.NONE);
      }
      pbrMaterial.vertexNormal = !!assetMaterial.common.vertexNormal;
      return pbrMaterial;
    }
  }
  /** @internal */
  private async _loadMaterial(gltf: GLTFContent, materialInfo: Material, vertexColor: boolean, vertexNormal: boolean, useTangent: boolean): Promise<StandardMaterial> {
    let assetMaterial: AssetMaterial = null;
    let pbrMetallicRoughness: AssetPBRMaterialMR = null;
    let pbrSpecularGlossness: AssetPBRMaterialSG = null;
    const pbrCommon: AssetMaterialCommon = {
      useTangent,
      vertexColor,
      vertexNormal,
      bumpScale: 1,
      emissiveColor: Vector3.zero(),
      emissiveStrength: 1,
      occlusionStrength: 1,
    };
    switch (materialInfo?.alphaMode) {
      case 'BLEND': {
        pbrCommon.alphaMode = 'blend';
        break;
      }
      case 'MASK': {
        pbrCommon.alphaMode = 'mask';
        pbrCommon.alphaCutoff = materialInfo.alphaCutoff ?? 0.5;
        break;
      }
    }
    if (materialInfo?.doubleSided) {
      pbrCommon.doubleSided = true;
    }
    if (materialInfo?.pbrMetallicRoughness || materialInfo?.extensions?.KHR_materials_pbrSpecularGlossiness) {
      pbrCommon.normalMap = materialInfo.normalTexture ? await this._loadTexture(gltf, materialInfo.normalTexture, false) : null;
      pbrCommon.bumpScale = materialInfo.normalTexture?.scale ?? 1;
      pbrCommon.occlusionMap = materialInfo.occlusionTexture ? await this._loadTexture(gltf, materialInfo.occlusionTexture, false) : null;
      pbrCommon.occlusionStrength = materialInfo.occlusionTexture?.strength ?? 1;
      pbrCommon.emissiveMap = materialInfo.emissiveTexture ? await this._loadTexture(gltf, materialInfo.emissiveTexture, false) : null;
      pbrCommon.emissiveStrength = materialInfo?.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1;
      pbrCommon.emissiveColor = materialInfo.emissiveFactor ? new Vector3(materialInfo.emissiveFactor) : Vector3.zero();
    }
    if (materialInfo?.pbrMetallicRoughness) {
      pbrMetallicRoughness = {
        type: 'pbrMetallicRoughness',
        ior: 1.5,
        common: pbrCommon,
      };
      pbrMetallicRoughness.diffuse = new Vector4(materialInfo.pbrMetallicRoughness.baseColorFactor ?? [1, 1, 1, 1]);
      pbrMetallicRoughness.metallic = materialInfo.pbrMetallicRoughness.metallicFactor ?? 1;
      pbrMetallicRoughness.roughness = materialInfo.pbrMetallicRoughness.roughnessFactor ?? 1;
      pbrMetallicRoughness.diffuseMap = materialInfo.pbrMetallicRoughness.baseColorTexture ? await this._loadTexture(gltf, materialInfo.pbrMetallicRoughness.baseColorTexture, true) : null;
      pbrMetallicRoughness.metallicMap = materialInfo.pbrMetallicRoughness.metallicRoughnessTexture ? await this._loadTexture(gltf, materialInfo.pbrMetallicRoughness.metallicRoughnessTexture, false) : null;
      pbrMetallicRoughness.metallicIndex = 2;
      pbrMetallicRoughness.roughnessIndex = 1;
    }
    if (materialInfo?.extensions?.KHR_materials_pbrSpecularGlossiness) {
      const sg = materialInfo.extensions?.KHR_materials_pbrSpecularGlossiness;
      pbrSpecularGlossness = {
        type: 'pbrSpecularGlossiness',
        ior: 1.5,
        common: pbrCommon,
      };
      pbrSpecularGlossness.diffuse = new Vector4(sg.diffuseFactor ?? [1, 1, 1, 1]);
      pbrSpecularGlossness.specular = new Vector3(sg.specularFactor ?? [1, 1, 1]);
      pbrSpecularGlossness.glossness = sg.glossnessFactor ?? 1;
      pbrSpecularGlossness.diffuseMap = sg.diffuseTexture ? await this._loadTexture(gltf, sg.diffuseTexture, true) : null;
      pbrSpecularGlossness.specularGlossnessMap = sg.specularGlossinessTexture ? await this._loadTexture(gltf, sg.specularGlossinessTexture, true) : null;
    }
    assetMaterial = pbrSpecularGlossness || pbrMetallicRoughness;
    if (!assetMaterial || materialInfo?.extensions?.KHR_materials_unlit) {
      if (materialInfo?.extensions?.KHR_materials_unlit) {
        assetMaterial = {
          type: 'unlit',
          common: pbrCommon,
          diffuse: pbrMetallicRoughness?.diffuse ?? Vector4.one(),
          diffuseMap: pbrMetallicRoughness?.diffuseMap ?? null,
        } as AssetUnlitMaterial;
      } else {
        assetMaterial = {
          type: 'pbrMetallicRoughness',
          common: pbrCommon,
          diffuse: Vector4.one(),
          metallic: 1,
          roughness: 1,
          diffuseMap: null,
          metallicMap: null,
          metallicIndex: 2,
          roughnessIndex: 1,
        } as AssetPBRMaterialMR;
      }
    }
    if (assetMaterial.type !== 'unlit' && materialInfo?.extensions?.KHR_materials_ior) {
      (assetMaterial as AssetPBRMaterialCommon).ior = materialInfo.extensions.KHR_materials_ior.ior ?? 1.5;
    }
    if (assetMaterial.type === 'pbrMetallicRoughness') {
      pbrMetallicRoughness = assetMaterial;
      // KHR_materials_specular extension
      pbrMetallicRoughness.specularFactor = new Vector4(new Vector3(materialInfo?.extensions?.KHR_materials_specular?.specularColorFactor ?? [1, 1, 1]), materialInfo?.extensions?.KHR_materials_specular?.specularFactor ?? 1);
      pbrMetallicRoughness.specularMap = materialInfo?.extensions?.KHR_materials_specular?.specularTexture ? await this._loadTexture(gltf, materialInfo.extensions.KHR_materials_specular.specularTexture, false) : null;
      pbrMetallicRoughness.specularColorMap = materialInfo?.extensions?.KHR_materials_specular?.specularColorTexture ? await this._loadTexture(gltf, materialInfo.extensions.KHR_materials_specular.specularColorTexture, true) : null;
      // KHR_materials_sheen
      const sheen = materialInfo?.extensions?.KHR_materials_sheen;
      if (sheen) {
        pbrMetallicRoughness.sheen = {
          sheenColorFactor: new Vector3(sheen.sheenColorFactor ?? [0, 0, 0]),
          sheenColorMap: sheen.sheenColorTexture ? await this._loadTexture(gltf, sheen.sheenColorTexture, true) : null,
          sheenRoughnessFactor: sheen.sheenRoughnessFactor ?? 0,
          sheenRoughnessMap: sheen.sheenRoughnessTexture ? await this._loadTexture(gltf, sheen.sheenRoughnessTexture, true) : null,
        };
      }
      // KHR_materials_clearcoat
      const cc = materialInfo?.extensions?.KHR_materials_clearcoat;
      if (cc) {
        pbrMetallicRoughness.clearcoat = {
          clearCoatFactor: cc.clearcoatFactor ?? 0,
          clearCoatIntensityMap: cc.clearcoatTexture ? await this._loadTexture(gltf, cc.clearcoatTexture, false) : null,
          clearCoatRoughnessFactor: cc.clearcoatRoughnessFactor ?? 0,
          clearCoatRoughnessMap: cc.clearcoatRoughnessTexture ? await this._loadTexture(gltf, cc.clearcoatRoughnessTexture, false) : null,
          clearCoatNormalMap: cc.clearcoatNormalTexture ? await this._loadTexture(gltf, cc.clearcoatNormalTexture, false) : null
        };
      }
    }
    return await this._createMaterial(gltf._manager.device, assetMaterial);
  }
  /** @internal */
  private async _loadTexture(gltf: GLTFContent, info: Partial<TextureInfo>, sRGB: boolean): Promise<MaterialTextureInfo> {
    const mt: MaterialTextureInfo = {
      texture: null,
      sampler: null,
      texCoord: info.texCoord ?? 0,
      transform: null
    };
    const textureInfo = gltf.textures[info.index];
    if (textureInfo) {
      if (info.extensions?.KHR_texture_transform) {
        const uvTransform = info.extensions.KHR_texture_transform;
        if (uvTransform.texCoord !== undefined) {
          mt.texCoord = uvTransform.texCoord;
        }
        const rotation = uvTransform.rotation !== undefined
          ? Matrix4x4.rotationZ(-uvTransform.rotation)
          : Matrix4x4.identity();
        const scale = uvTransform.scale !== undefined
          ? new Vector3(uvTransform.scale[0], uvTransform.scale[1], 1)
          : Vector3.one();
        const translation = uvTransform.offset !== undefined
          ? new Vector3(uvTransform.offset[0], uvTransform.offset[1], 0)
          : Vector3.zero();
        mt.transform = Matrix4x4.scaling(scale).multiplyLeft(rotation).translateLeft(translation);
      }
      let wrapS: TextureWrapping = TextureWrapping.Repeat;
      let wrapT: TextureWrapping = TextureWrapping.Repeat;
      let magFilter: TextureFilter = TextureFilter.Linear;
      let minFilter: TextureFilter = TextureFilter.Linear;
      let mipFilter: TextureFilter = TextureFilter.Linear;
      const samplerIndex: number = textureInfo.sampler;
      const sampler = gltf.samplers && gltf.samplers[samplerIndex];
      if (sampler) {
        switch (sampler.wrapS) {
          case 0x2901: // gl.REPEAT
            wrapS = TextureWrapping.Repeat;
            break;
          case 0x8370: // gl.MIRRORED_REPEAT
            wrapS = TextureWrapping.MirroredRepeat;
            break;
          case 0x812f: // gl.CLAMP_TO_EDGE
            wrapS = TextureWrapping.ClampToEdge;
            break;
        }
        switch (sampler.wrapT) {
          case 0x2901: // gl.REPEAT
            wrapT = TextureWrapping.Repeat;
            break;
          case 0x8370: // gl.MIRRORED_REPEAT
            wrapT = TextureWrapping.MirroredRepeat;
            break;
          case 0x812f: // gl.CLAMP_TO_EDGE
            wrapT = TextureWrapping.ClampToEdge;
            break;
        }
        switch (sampler.magFilter) {
          case 0x2600: // gl.NEAREST
            magFilter = TextureFilter.Nearest;
            break;
          case 0x2601: // gl.LINEAR
            magFilter = TextureFilter.Linear;
            break;
        }
        switch (sampler.minFilter) {
          case 0x2600: // gl.NEAREST
            minFilter = TextureFilter.Nearest;
            mipFilter = TextureFilter.None;
            break;
          case 0x2601: // gl.LINEAR
            minFilter = TextureFilter.Linear;
            mipFilter = TextureFilter.None;
            break;
          case 0x2700: // gl.NEAREST_MIPMAP_NEAREST
            minFilter = TextureFilter.Nearest;
            mipFilter = TextureFilter.Nearest;
            break;
          case 0x2701: // gl.LINEAR_MIPMAP_NEAREST
            minFilter = TextureFilter.Linear;
            mipFilter = TextureFilter.Nearest;
            break;
          case 0x2702: // gl.NEAREST_MIPMAP_LINEAR
            minFilter = TextureFilter.Nearest;
            mipFilter = TextureFilter.Linear;
            break;
          case 0x2703: // gl.LINEAR_MIPMAP_LINEAR
            minFilter = TextureFilter.Linear;
            mipFilter = TextureFilter.Linear;
            break;
        }
      }
      const imageIndex: number = textureInfo.source;
      const hash = `${imageIndex}:${!!sRGB}:${wrapS}:${wrapT}:${minFilter}:${magFilter}:${mipFilter}`;
      mt.texture = gltf._textureCache[hash];
      if (!mt.texture) {
        const image = gltf.images[imageIndex];
        if (image) {
          if (image.uri) {
            const imageUrl = this._normalizeURI(gltf._baseURI, image.uri);
            mt.texture = await gltf._manager.fetchTexture(imageUrl, null, sRGB);
            mt.texture.name = imageUrl;
          } else if (typeof image.bufferView === 'number' && image.mimeType) {
            const bufferView = gltf.bufferViews && gltf.bufferViews[image.bufferView];
            if (bufferView) {
              const arrayBuffer = gltf._loadedBuffers && gltf._loadedBuffers[bufferView.buffer];
              if (arrayBuffer) {
                const view = new Uint8Array(
                  arrayBuffer,
                  bufferView.byteOffset || 0,
                  bufferView.byteLength,
                );
                const mimeType = image.mimeType;
                const blob = new Blob([view], { type: mimeType });
                const sourceURI = URL.createObjectURL(blob);
                mt.texture = await gltf._manager.fetchTexture(sourceURI, mimeType, sRGB);
                URL.revokeObjectURL(sourceURI);
              }
            }
          }
        }
        if (mt.texture) {
          gltf._textureCache[hash] = mt.texture;
        }
      }
      if (mt.texture) {
        mt.sampler = gltf._manager.device.createSampler({
          addressU: wrapS,
          addressV: wrapT,
          magFilter: magFilter,
          minFilter: minFilter,
          mipFilter: mipFilter,
        });
      }
    }
    return mt;
  }
  /** @internal */
  private _primitiveType(type: number): PrimitiveType {
    switch (type) {
      case 0: // GL_POINTS
        return PrimitiveType.PointList;
      case 1: // GL_LINES
        return PrimitiveType.LineList;
      /* FIXME:
      case 2: // GL_LINE_LOOP
        return PrimitiveType.LineLoop;
      */
      case 3: // GL_LINE_STRIP
        return PrimitiveType.LineStrip;
      case 4: // GL_TRIANGLES
        return PrimitiveType.TriangleList;
      case 5: // GL_TRIANGLE_STRIP
        return PrimitiveType.TriangleStrip;
      case 6: // GL_TRIANGLE_FAN
        return PrimitiveType.TriangleFan;
      default:
        return PrimitiveType.Unknown;
    }
  }
  /** @internal */
  private _loadIndexBuffer(gltf: GLTFContent, accessorIndex: number, primitive: Primitive, meshData: AssetSubMeshData) {
    this._setBuffer(gltf, accessorIndex, primitive, -1, meshData);
  }
  /** @internal */
  private _loadVertexBuffer(
    gltf: GLTFContent,
    attribName: string,
    accessorIndex: number,
    primitive: Primitive,
    subMeshData: AssetSubMeshData
  ) {
    let semantic: number;
    switch (attribName) {
      case 'POSITION':
        semantic = VERTEX_ATTRIB_POSITION;
        break;
      case 'NORMAL':
        semantic = VERTEX_ATTRIB_NORMAL;
        break;
      case 'TANGENT':
        semantic = VERTEX_ATTRIB_TANGENT;
        break;
      case 'TEXCOORD_0':
        semantic = VERTEX_ATTRIB_TEXCOORD0;
        break;
      case 'TEXCOORD_1':
        semantic = VERTEX_ATTRIB_TEXCOORD1;
        break;
      case 'TEXCOORD_2':
        semantic = VERTEX_ATTRIB_TEXCOORD2;
        break;
      case 'TEXCOORD_3':
        semantic = VERTEX_ATTRIB_TEXCOORD3;
        break;
      case 'TEXCOORD_4':
        semantic = VERTEX_ATTRIB_TEXCOORD4;
        break;
      case 'TEXCOORD_5':
        semantic = VERTEX_ATTRIB_TEXCOORD5;
        break;
      case 'TEXCOORD_6':
        semantic = VERTEX_ATTRIB_TEXCOORD6;
        break;
      case 'TEXCOORD_7':
        semantic = VERTEX_ATTRIB_TEXCOORD7;
        break;
      case 'COLOR_0':
        semantic = VERTEX_ATTRIB_DIFFUSE;
        break;
      case 'JOINTS_0':
        semantic = VERTEX_ATTRIB_BLEND_INDICES;
        break;
      case 'WEIGHTS_0':
        semantic = VERTEX_ATTRIB_BLEND_WEIGHT;
        break;
      default:
        return;
    }
    this._setBuffer(gltf, accessorIndex, primitive, semantic, subMeshData);
  }
  /** @internal */
  private _setBuffer(gltf: GLTFContent, accessorIndex: number, primitive: Primitive, semantic: number, subMeshData: AssetSubMeshData) {
    const accessor = gltf._accessors[accessorIndex];
    const normalized = !!accessor.normalized;
    const hash = `${accessorIndex}:${semantic >= 0}:${Number(normalized)}`;
    let buffer = gltf._bufferCache[hash];
    if (!buffer) {
      let data = accessor.getTypedView(gltf);
      let ctype: number;
      let typeMask: number;
      if (data instanceof Int8Array) {
        ctype = ComponentType.BYTE;
        typeMask = I8_BITMASK;
      } else if (data instanceof Uint8Array) {
        ctype = ComponentType.UBYTE;
        typeMask = U8_BITMASK;
      } else if (data instanceof Int16Array) {
        ctype = ComponentType.SHORT;
        typeMask = I16_BITMASK;
      } else if (data instanceof Uint16Array) {
        ctype = ComponentType.USHORT;
        typeMask = U16_BITMASK;
      } else if (data instanceof Int32Array) {
        ctype = ComponentType.INT;
        typeMask = I32_BITMASK;
      } else if (data instanceof Uint32Array) {
        ctype = ComponentType.UINT;
        typeMask = U32_BITMASK;
      } else if (data instanceof Float32Array) {
        ctype = ComponentType.FLOAT;
        typeMask = F32_BITMASK;
      } else {
        throw new Error('invalid buffer data type');
      }
      const componentCount = accessor.getComponentCount(accessor.type);
      if (semantic >= 0 && ctype !== ComponentType.FLOAT) {
        const floatData = new Float32Array(data.length);
        floatData.set(data);
        ctype = ComponentType.FLOAT;
        typeMask = F32_BITMASK;
        data = floatData;
      }
      if (semantic < 0) {
        if (ctype !== ComponentType.UBYTE && ctype !== ComponentType.USHORT && ctype !== ComponentType.UINT) {
          throw new Error(`Invalid index buffer component type: ${ctype}`);
        }
        if (ctype === ComponentType.UINT && !gltf._manager.device.getMiscCaps().support32BitIndex) {
          throw new Error('Device does not support 32bit vertex index');
        }
        if (ctype === ComponentType.UBYTE) {
          const uint16Data = new Uint16Array(data.length);
          uint16Data.set(data);
          ctype = ComponentType.USHORT;
          typeMask = U16_BITMASK;
          data = uint16Data;
        }
      }
      if (semantic < 0) {
        buffer = gltf._manager.device.createIndexBuffer(data as Uint16Array | Uint32Array, GPUResourceUsageFlags.MANAGED);
      } else {
        const name = getVertexAttribName(semantic);
        const bufferType = new PBStructTypeInfo(null, 'packed', [{
          name: name,
          type: new PBArrayTypeInfo(PBPrimitiveTypeInfo.getCachedTypeInfo(makePrimitiveType(typeMask, 1, componentCount, 0)), data.length / componentCount),
        }]);
        buffer = gltf._manager.device.createStructuredBuffer(bufferType, GPUResourceUsageFlags.BF_VERTEX | GPUResourceUsageFlags.MANAGED, data);
      }
      gltf._bufferCache[hash] = buffer;
    }
    if (buffer) {
      if (semantic < 0) {
        primitive.setIndexBuffer(buffer as IndexBuffer);
        primitive.indexCount = (buffer as IndexBuffer).length;
      } else {
        primitive.setVertexBuffer(buffer as StructuredBuffer);
        if (semantic === VERTEX_ATTRIB_POSITION) {
          if (!primitive.getIndexBuffer()) {
            primitive.indexCount = Math.floor(buffer.byteLength / 12);
          }
          const data = accessor.getNormalizedDeinterlacedView(gltf);
          subMeshData.rawPositions = data as Float32Array;
          const min = accessor.min;
          const max = accessor.max;
          if (min && max) {
            primitive.setBoundingVolume(new BoundingBox(new Vector3(min), new Vector3(max)));
          } else {
            const numComponents = getVertexBufferAttribType((buffer as StructuredBuffer).structure, semantic).cols;
            const bbox = new BoundingBox();
            bbox.beginExtend();
            for (let i = 0; i < data.length; i++) {
              const v = new Vector3(
                data[i * numComponents],
                data[i * numComponents + 1],
                data[i * numComponents + 2],
              );
              bbox.extend(v);
            }
            if (bbox.isValid()) {
              primitive.setBoundingVolume(bbox);
            }
          }
        } else if (semantic === VERTEX_ATTRIB_BLEND_INDICES) {
          subMeshData.rawBlendIndices = accessor.getNormalizedDeinterlacedView(gltf);
        } else if (semantic === VERTEX_ATTRIB_BLEND_WEIGHT) {
          subMeshData.rawJointWeights = accessor.getNormalizedDeinterlacedView(gltf);
        }
      }
    }
    return buffer;
  }
  /** @internal */
  private isGLB(data: ArrayBuffer): boolean {
    if (data.byteLength > 12) {
      const p = new Uint32Array(data, 0, 3);
      if (p[0] === 0x46546C67 && p[1] === 2 && p[2] === data.byteLength) {
        return true;
      }
    }
    return false;
  }
  /** @internal */
  private getGLBChunkInfo(data: ArrayBuffer, offset: number): { start: number, length: number, type: number } {
    const header = new Uint32Array(data, offset, 2);
    const start = offset + 8;
    const length = header[0];
    const type = header[1];
    return { start, length, type };
  }
  /** @internal */
  private getGLBChunkInfos(data: ArrayBuffer): { start: number, length: number, type: number }[] {
    const infos: { start: number, length: number, type: number }[] = [];
    let offset = 12;
    while (offset < data.byteLength) {
      const info = this.getGLBChunkInfo(data, offset);
      infos.push(info);
      offset += info.length + 8;
    }
    return infos;
  }
}
