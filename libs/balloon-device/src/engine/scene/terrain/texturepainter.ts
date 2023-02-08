import { Device, FrameBuffer, GPUResourceUsageFlags, FaceMode, PrimitiveType, ProgramBuilder, RenderStateSet, Texture2D, TextureFormat, GPUProgram, BindGroup, makeVertexBufferType, ShaderType, TextureWrapping, TextureFilter } from '../../device';
import { Matrix4x4, Vector3, Vector4 } from '../../math';
import { Camera } from '../camera';
import { Primitive } from '../primitive';
import { MAX_DETAIL_TEXTURE_LEVELS } from './terrainmaterial';
import { ForwardRenderScheme } from '../renderers';
import { GraphNode } from '../graph_node';
import { Terrain } from './terrain';

export abstract class TerrainTexturePainter {
  protected _terrain: Terrain;
  protected _detailRange: number[];
  protected _detailTexture: Texture2D;
  protected _detailNormalTexture: Texture2D;
  protected _depthTexture: Texture2D;
  protected _framebuffer: FrameBuffer;
  protected _framebufferNormal: FrameBuffer;
  protected _threshold: number;
  protected _cellX: number;
  protected _cellZ: number;
  protected _camera: Camera;
  protected _textureSize: number;
  protected _buffer: Float32Array;
  protected _paintNormals: boolean;
  constructor(terrain: Terrain, textureSize: number, paintNormals: boolean, detailRange: number, numDetailLevels: number) {
    this._terrain = terrain;
    this._paintNormals = !!paintNormals;
    const terrainSize = terrain.getBoundingVolume().toAABB().extents;
    const maxSize = Math.max(terrainSize.x, terrainSize.z) * 2;
    if (numDetailLevels <= 1) {
      this._detailRange = [maxSize];
    } else {
      this._detailRange = Array.from({ length: numDetailLevels }).map((val, index) => detailRange * Math.pow(maxSize / detailRange, index / (numDetailLevels - 1)));
    }
    this._threshold = detailRange * 0.5;
    this._cellX = null;
    this._cellZ = null;
    this._textureSize = textureSize;
    this._detailTexture = terrain.scene.device.createTexture2D(TextureFormat.RGBA8UNORM, textureSize * numDetailLevels, textureSize, GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE);
    this._detailTexture.name = `TerrainDetailTextureAtlas-${this._detailTexture.uid}`;
    this._detailNormalTexture = paintNormals ? terrain.scene.device.createTexture2D(TextureFormat.RGBA8UNORM, textureSize * numDetailLevels, textureSize, GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE) : null;
    if (this._detailNormalTexture) {
      this._detailNormalTexture.name = `TerrainDetailNormalTextureAtlas-${this._detailNormalTexture.uid}`;
    }
    this._depthTexture = terrain.scene.device.createTexture2D(TextureFormat.D24S8, textureSize * numDetailLevels, textureSize, null);
    this._depthTexture.name = `TerrainDetailDepthTexture-${this._depthTexture.uid}`;
    if (paintNormals) {
      if (this._terrain.scene.device.getFramebufferCaps().maxDrawBuffers > 1) {
        this._framebuffer = terrain.scene.device.createFrameBuffer({ colorAttachments: [{ texture: this._detailTexture }, { texture: this._detailNormalTexture }], depthAttachment: { texture: this._depthTexture } });
        this._framebufferNormal = null;
      } else {
        this._framebuffer = terrain.scene.device.createFrameBuffer({ colorAttachments: [{ texture: this._detailTexture }], depthAttachment: { texture: this._depthTexture } });
        this._framebufferNormal = terrain.scene.device.createFrameBuffer({ colorAttachments: [{ texture: this._detailNormalTexture }], depthAttachment: { texture: this._depthTexture } });
      }
    } else {
      this._framebuffer = terrain.scene.device.createFrameBuffer({ colorAttachments: [{ texture: this._detailTexture }], depthAttachment: { texture: this._depthTexture } });
      this._framebufferNormal = null;
    }
    this._buffer = new Float32Array(4 * MAX_DETAIL_TEXTURE_LEVELS);
    this._camera = new Camera(terrain.scene);
  }
  get numDetailLevels(): number {
    return this._detailRange.length;
  }
  get textureSize(): number {
    return this._textureSize;
  }
  getDetailRectBuffer(): Float32Array {
    return this._buffer;
  }
  getDetailTexture(): Texture2D {
    return this._detailTexture;
  }
  getDetailNormalTexture(): Texture2D {
    return this._detailNormalTexture;
  }
  getFramebuffer(): FrameBuffer {
    return this._framebuffer;
  }
  requireFullUpdate(): void {
    this._cellX = null;
    this._cellZ = null;
  }
  update(viewPoint: Vector3): boolean {
    const terrainSize = this._terrain.getBoundingVolume().toAABB().extents;
    const terrainSizeX = terrainSize.x * 2;
    const terrainSizeZ = terrainSize.z * 2;
    const cellX = Math.floor(viewPoint.x / this._threshold);
    const cellZ = Math.floor(viewPoint.z / this._threshold);

    // for debug
    // this._cellX = null;
    // this._cellZ = null;
    //

    if (cellX !== this._cellX || cellZ !== this._cellZ) {
      this.paintTextures(cellX, cellZ, terrainSizeX, terrainSizeZ);
      this._cellX = cellX;
      this._cellZ = cellZ;
      return true;
    }
    return false;
  }
  paintTextures(cellX: number, cellZ: number, terrainSizeX: number, terrainSizeZ: number) {
    const saveRT = this._camera.scene.device.getFramebuffer();
    const saveViewport = this._camera.scene.device.getViewport();
    const saveScissor = this._camera.scene.device.getScissor();
    this._camera.scene.device.setFramebuffer(this._framebuffer);
    for (let i = 0; i < this._detailRange.length; i++) {
      if (i < this._detailRange.length - 1 || this._cellX === null) {
        this._camera.scene.device.setViewport(i * this._textureSize, 0, this._textureSize, this._textureSize);
        this._camera.scene.device.setScissor(i * this._textureSize, 0, this._textureSize, this._textureSize);
        this._camera.scene.device.clearFrameBuffer(Vector4.zero(), null, null);
        this.paintDetailTexture(cellX, cellZ, terrainSizeX, terrainSizeZ, i, true, this._paintNormals && !this._framebufferNormal);
      }
    }
    if (this._framebufferNormal) {
      this._camera.scene.device.setFramebuffer(this._framebufferNormal);
      for (let i = 0; i < this._detailRange.length; i++) {
        if (i < this._detailRange.length - 1 || this._cellX === null) {
          this._camera.scene.device.setViewport(i * this._textureSize, 0, this._textureSize, this._textureSize);
          this._camera.scene.device.setScissor(i * this._textureSize, 0, this._textureSize, this._textureSize);
          this._camera.scene.device.clearFrameBuffer(Vector4.zero(), null, null);
          this.paintDetailTexture(cellX, cellZ, terrainSizeX, terrainSizeZ, i, false, true);
        }
      }
    }
    this._camera.scene.device.setFramebuffer(saveRT);
    this._camera.scene.device.setViewport(saveViewport);
    this._camera.scene.device.setScissor(saveScissor);
  }
  paintDetailTexture(cellX: number, cellZ: number, terrainSizeX: number, terrainSizeZ: number, detailLevel: number, paintAlbedo: boolean, paintNormals: boolean) {
    const cx = (cellX + 0.5) * this._threshold;
    const cz = (cellZ + 0.5) * this._threshold;
    const detailRange = this._detailRange[detailLevel];
    let minx = cx - detailRange * 0.5;
    let maxx = minx + detailRange;
    if (minx < 0) {
      minx = 0;
      maxx = Math.min(terrainSizeX, detailRange);
    } else if (maxx > terrainSizeX) {
      minx = Math.max(0, terrainSizeX - detailRange);
      maxx = terrainSizeX;
    }
    let minz = cz - detailRange * 0.5;
    let maxz = minz + detailRange;
    if (minz < 0) {
      minz = 0;
      maxz = Math.min(terrainSizeZ, detailRange);
    } else if (maxz > terrainSizeZ) {
      minz = Math.max(0, terrainSizeZ - detailRange);
      maxz = terrainSizeZ;
    }
    const vx = (minx + maxx) * 0.5;
    const vz = (minz + maxz) * 0.5;
    const terrainBounds = this._terrain.getWorldBoundingVolume().toAABB();
    const n = terrainBounds.maxPoint.y + 10;
    const f = terrainBounds.minPoint.y - 10;
    this._buffer[detailLevel * 4 + 0] = minx / terrainSizeX;
    this._buffer[detailLevel * 4 + 1] = minz / terrainSizeZ;
    this._buffer[detailLevel * 4 + 2] = maxx / terrainSizeX;
    this._buffer[detailLevel * 4 + 3] = maxz / terrainSizeZ;
    this._camera.setProjectionMatrix(Matrix4x4.ortho(minx - vx, maxx - vx, minz - vz, maxz - vz, 0, n - f));
    const atPoint = this._terrain.worldMatrix.transformPointAffine(new Vector3(vx, n, vz));
    const dstPoint = this._terrain.worldMatrix.transformPointAffine(new Vector3(vx, f, vz));
    const up = this._terrain.worldMatrix.transformVectorAffine(Vector3.axisNZ());
    this._camera.lookAt(atPoint, dstPoint, up);
    this.doPaintTexture(this._camera, detailLevel, paintAlbedo, paintNormals, minx, minz, maxx, maxz, terrainSizeX, terrainSizeZ);
  }
  renderTerrainSnapshot(texture: Texture2D, verticalFlip = false) {
    const device = texture.device;
    const depthTexture = device.createTexture2D(TextureFormat.D24S8, texture.width, texture.height);
    const fb = device.createFrameBuffer({
      colorAttachments: [{ texture }],
      depthAttachment: { texture: depthTexture }
    });
    const saveRT = device.getFramebuffer();
    const saveViewport = device.getViewport();
    const saveScissor = device.getScissor();
    const terrainBounds = this._terrain.getWorldBoundingVolume().toAABB();
    const center = terrainBounds.center;
    const extents = terrainBounds.extents;
    const vx = center.x;
    const vz = center.z;
    const n = terrainBounds.maxPoint.y + 10;
    const f = terrainBounds.minPoint.y - 10;
    const camera = new Camera(this._terrain.scene, Matrix4x4.ortho(-extents.x, extents.x, -extents.z, extents.z, 0, n - f));
    const atPoint = this._terrain.worldMatrix.transformPointAffine(new Vector3(vx, n, vz));
    const dstPoint = this._terrain.worldMatrix.transformPointAffine(new Vector3(vx, f, vz));
    const up = this._terrain.worldMatrix.transformVectorAffine(Vector3.axisNZ());
    camera.lookAt(atPoint, dstPoint, up);
    const renderScheme = new ForwardRenderScheme(device);
    renderScheme.scenePass.verticalFlip = !!verticalFlip;
    renderScheme.scenePass.cullVisitor.addFilter(target => !(target instanceof GraphNode) || target instanceof Terrain);
    renderScheme.scenePass.clearColor = new Vector4(1, 0, 0, 1);
    renderScheme.scenePass.enableClear(true, true);
    renderScheme.renderSceneToTexture(this._terrain.scene, camera, fb);
    device.setFramebuffer(saveRT);
    device.setViewport(saveViewport);
    device.setScissor(saveScissor);
    fb.dispose();
    depthTexture.dispose();
  }
  protected abstract doPaintTexture(camera: Camera, detailLevel: number, paintAlbedo: boolean, paintNormals: boolean, minx: number, minz: number, maxx: number, maxz: number, terrainSizeX: number, terrainSizeZ: number);
}

export class DefaultTexturePainter extends TerrainTexturePainter {
  constructor(terrain: Terrain) {
    const terrainSize = terrain.getBoundingVolume().toAABB().extents;
    const maxSize = Math.max(terrainSize.x, terrainSize.z) * 2;
    super(terrain, 32, false, maxSize, 1);
  }
  protected doPaintTexture(camera: Camera) {
    camera.scene.device.clearFrameBuffer(Vector4.one(), null, null);
  }
}

export class DebugTexturePainter extends TerrainTexturePainter {
  private _clearColors: Vector4[];
  constructor(terrain: Terrain, detailRange: number, numDetailLevels: number) {
    super(terrain, 128, false, detailRange, numDetailLevels);
    this._clearColors = [new Vector4(1, 0, 0, 1), new Vector4(0, 1, 0, 1), new Vector4(0, 0, 1, 1), new Vector4(1, 1, 0, 1), new Vector4(1, 0, 1, 1)];
  }
  protected doPaintTexture(camera: Camera, detailLevel: number) {
    detailLevel = detailLevel >= this._clearColors.length ? this._clearColors.length - 1 : detailLevel;
    camera.scene.device.clearFrameBuffer(this._clearColors[detailLevel], null, null);
  }
}

export class SimpleTexturePainter extends TerrainTexturePainter {
  protected _program: GPUProgram;
  protected _bindGroup: BindGroup;
  protected _primitive: Primitive;
  protected _texture: Texture2D;
  private _renderStates: RenderStateSet;
  constructor(terrain: Terrain, textureSize: number, detailRange: number, numDetailLevels: number, texture: Texture2D, flip?: boolean) {
    super(terrain, textureSize, false, detailRange, numDetailLevels);
    this._texture = texture;
    this.init(!!flip);
  }
  get texture(): Texture2D {
    return this._texture;
  }
  set texture(tex: Texture2D) {
    if (tex !== this._texture) {
      this._texture = tex;
      this.requireFullUpdate();
    }
  }
  private init(flip: boolean) {
    const device = this._terrain.scene.device;
    const bbox = this._terrain.getWorldBoundingVolume().toAABB();
    const minx = bbox.minPoint.x;
    const miny = bbox.minPoint.y;
    const minz = bbox.minPoint.z;
    const maxx = bbox.maxPoint.x;
    const maxy = bbox.maxPoint.y;
    const maxz = bbox.maxPoint.z;
    const y = (miny + maxy) * 0.5;
    const vertexbuffer = device.createStructuredBuffer(
      makeVertexBufferType(4, 'position_f32x3', 'tex0_f32x2'),
      GPUResourceUsageFlags.BF_VERTEX | GPUResourceUsageFlags.MANAGED,
      flip
        ? new Float32Array([minx, y, maxz, 0, 0, maxx, y, maxz, 1, 0, minx, y, minz, 0, 1, maxx, y, minz, 1, 1])
        : new Float32Array([minx, y, maxz, 0, 1, maxx, y, maxz, 1, 1, minx, y, minz, 0, 0, maxx, y, minz, 1, 0]));
    this._primitive = new Primitive(device);
    this._primitive.setVertexBuffer(vertexbuffer);
    this._primitive.indexStart = 0;
    this._primitive.indexCount = 4;
    this._primitive.primitiveType = PrimitiveType.TriangleStrip;
    const pb = new ProgramBuilder(device);
    this._program = pb.buildRenderProgram({
      vertex() {
        this.$inputs.pos = pb.vec3().attrib('position');
        this.$inputs.uv = pb.vec2().attrib('texCoord0');
        this.mvpMatrix = pb.mat4().uniform(0);
        this.$outputs.uv = pb.vec2();
        this.$mainFunc(function () {
          this.$builtins.position = pb.mul(this.mvpMatrix, pb.vec4(this.$inputs.pos, 1));
          if (pb.getDeviceType() === 'webgpu') {
            this.$builtins.position.y = pb.neg(this.$builtins.position.y);
          }
          this.$outputs.uv = this.$inputs.uv;
        });
      },
      fragment() {
        this.tex = pb.tex2D().uniform(0);
        this.$outputs.color = pb.vec4();
        this.$mainFunc(function () {
          this.$outputs.color = pb.textureSampleLevel(this.tex, this.$inputs.uv, 0);
        });
      }
    });
    this._bindGroup = device.createBindGroup(this._program.bindGroupLayouts[0]);
    this._renderStates = device.createRenderStateSet();
    this._renderStates.useRasterizerState().setCullMode(FaceMode.NONE);
    this._renderStates.useDepthState().enableTest(false).enableWrite(false);
  }
  protected doPaintTexture(camera: Camera) {
    const device = this._terrain.scene.device;
    device.clearFrameBuffer(new Vector4(1, 0, 0, 1), null, null);
    if (this._texture) {
      this._bindGroup.setValue('mvpMatrix', Matrix4x4.multiply(camera.viewProjectionMatrix, this._terrain.worldMatrix));
      this._bindGroup.setTexture('tex', this._texture);
      device.setProgram(this._program);
      device.setBindGroup(0, this._bindGroup);
      device.setBindGroup(1, null);
      device.setBindGroup(2, null);
      device.setRenderStates(this._renderStates);
      this._primitive.draw();
    }
  }
}


// eslint-disable-next-line @typescript-eslint/no-namespace
namespace SlopeBasedTexturePainter {
  export interface DetailTextureInfo {
    albedoTexture: Texture2D,
    normalTexture?: Texture2D,
    density: number,
    minSlope: number;
    maxSlope: number;
  }
}

export class SlopeBasedTexturePainter extends TerrainTexturePainter {
  protected _program: GPUProgram;
  protected _programNormals: GPUProgram;
  protected _bindGroup: BindGroup;
  protected _bindGroupNormals: BindGroup;
  protected _primitive: Primitive;
  protected _renderStates: RenderStateSet;
  protected _defaultNormalTexture: Texture2D;
  constructor(terrain: Terrain, textureSize: number, detailRange: number, numDetailLevels: number, detailTextureInfos: SlopeBasedTexturePainter.DetailTextureInfo[]) {
    const hasNormal = detailTextureInfos.findIndex(val => !!val.normalTexture) >= 0;
    super(terrain, textureSize, hasNormal, detailRange, numDetailLevels);
    this._defaultNormalTexture = this.createDefaultNormalTexture(this._terrain.scene.device);
    if (hasNormal) {
      for (const detail of detailTextureInfos) {
        if (!detail.normalTexture) {
          detail.normalTexture = this._defaultNormalTexture;
        }
      }
    }
    this.init(detailTextureInfos, false);
  }
  init(detailTextureInfos: SlopeBasedTexturePainter.DetailTextureInfo[], flip: boolean) {
    const device = this._terrain.scene.device;
    const bbox = this._terrain.getWorldBoundingVolume().toAABB();
    const minx = bbox.minPoint.x;
    const miny = bbox.minPoint.y;
    const minz = bbox.minPoint.z;
    const maxx = bbox.maxPoint.x;
    const maxy = bbox.maxPoint.y;
    const maxz = bbox.maxPoint.z;
    const y = (miny + maxy) * 0.5;
    const vertexbuffer = device.createStructuredBuffer(
      makeVertexBufferType(4, 'position_f32x3', 'tex0_f32x2'),
      GPUResourceUsageFlags.BF_VERTEX | GPUResourceUsageFlags.MANAGED,
      flip
        ? new Float32Array([minx, y, maxz, 0, 0, maxx, y, maxz, 1, 0, minx, y, minz, 0, 1, maxx, y, minz, 1, 1])
        : new Float32Array([minx, y, maxz, 0, 1, maxx, y, maxz, 1, 1, minx, y, minz, 0, 0, maxx, y, minz, 1, 0]));
    this._primitive = new Primitive(device);
    this._primitive.setVertexBuffer(vertexbuffer);
    this._primitive.indexStart = 0;
    this._primitive.indexCount = 4;
    this._primitive.primitiveType = PrimitiveType.TriangleStrip;
    if (this._paintNormals && !this._framebufferNormal) {
      this._program = this.createProgram(device, detailTextureInfos, true, true);
      this._programNormals = null;
    } else {
      this._program = this.createProgram(device, detailTextureInfos, true, false);
      this._programNormals = this._paintNormals ? this.createProgram(device, detailTextureInfos, false, true) : null;
    }
    console.log(this._program.getShaderSource(ShaderType.Vertex));
    console.log(this._program.getShaderSource(ShaderType.Fragment));
    this._bindGroup = device.createBindGroup(this._program.bindGroupLayouts[0]);
    this._bindGroupNormals = this._programNormals ? device.createBindGroup(this._programNormals.bindGroupLayouts[0]) : null;
    for (let i = 0; i < detailTextureInfos.length; i++) {
      const sampler = device.createSampler({
        addressU: TextureWrapping.MirroredRepeat,
        addressV: TextureWrapping.MirroredRepeat,
        magFilter: TextureFilter.Linear,
        minFilter: TextureFilter.Linear,
        mipFilter: detailTextureInfos[i].albedoTexture.mipLevelCount > 1 ? TextureFilter.Linear : TextureFilter.None
      });
      this._bindGroup.setTexture(`detail${i}`, detailTextureInfos[i].albedoTexture, sampler);
      if (this._paintNormals) {
        const sampler = device.createSampler({
          addressU: TextureWrapping.MirroredRepeat,
          addressV: TextureWrapping.MirroredRepeat,
          magFilter: TextureFilter.Linear,
          minFilter: TextureFilter.Linear,
          mipFilter: detailTextureInfos[i].normalTexture.mipLevelCount > 1 ? TextureFilter.Linear : TextureFilter.None
        });
        (this._bindGroupNormals || this._bindGroup).setTexture(`normal${i}`, detailTextureInfos[i].normalTexture, sampler);
      }
    }
    this._renderStates = device.createRenderStateSet();
    this._renderStates.useRasterizerState().setCullMode(FaceMode.NONE);
    this._renderStates.useDepthState().enableTest(false).enableWrite(false);
  }
  protected createDefaultNormalTexture(device: Device): Texture2D {
    const tex = device.createTexture2D(TextureFormat.RGBA8UNORM, 1, 1, GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE);
    tex.update(new Uint8Array([127, 127, 255, 255]), 0, 0, 1, 1);
    return tex;
  }
  protected createProgram(device: Device, detailTextureInfos: SlopeBasedTexturePainter.DetailTextureInfo[], paintDetail: boolean, paintNormals: boolean): GPUProgram {
    const pb = new ProgramBuilder(device);
    return pb.buildRenderProgram({
      vertex() {
        this.$inputs.pos = pb.vec3().attrib('position');
        this.$inputs.uv = pb.vec2().attrib('texCoord0');
        this.mvpMatrix = pb.mat4().uniform(0);
        this.$outputs.uv = pb.vec2();
        this.$mainFunc(function () {
          this.$builtins.position = pb.mul(this.mvpMatrix, pb.vec4(this.$inputs.pos, 1));
          if (pb.getDeviceType() === 'webgpu') {
            this.$builtins.position.y = pb.neg(this.$builtins.position.y);
          }
          this.$outputs.uv = this.$inputs.uv;
        });
      },
      fragment() {
        this.tex = pb.tex2D().uniform(0);
        for (let i = 0; i < detailTextureInfos.length; i++) {
          if (paintDetail) {
            this[`detail${i}`] = pb.tex2D().uniform(0);
          }
          if (paintNormals) {
            this[`normal${i}`] = pb.tex2D().uniform(0);
          }
        }
        if (paintDetail) {
          this.$outputs.color = pb.vec4();
        }
        if (paintNormals) {
          this.$outputs.normal = pb.vec4();
        }
        this.$mainFunc(function () {
          this.normal = pb.sub(pb.mul(pb.textureSample(this.tex, this.$inputs.uv).xyz, 2), pb.vec3(1));
          this.slope = pb.abs(pb.sub(1, this.normal.y));
          let lastBound = 0;
          for (let i = 0; i < detailTextureInfos.length; i++) {
            const detailInfo = detailTextureInfos[i];
            let low = detailInfo.minSlope;
            const hi = i == detailTextureInfos.length - 1 ? detailInfo.maxSlope : Math.min(detailInfo.maxSlope, detailTextureInfos[i + 1].minSlope);
            if (detailInfo.minSlope < lastBound) {
              this.$if(pb.and(pb.greaterThanEqual(this.slope, detailInfo.minSlope), pb.lessThan(this.slope, lastBound)), function () {
                this.$l.tilingUV0 = pb.mul(this.$inputs.uv, detailTextureInfos[i - 1].density);
                this.$l.tilingUV1 = pb.mul(this.$inputs.uv, detailInfo.density);
                if (paintDetail) {
                  this.$l.t0 = pb.mul(pb.add(pb.textureSample(this[`detail${i - 1}`], this.tilingUV0).xyz, pb.textureSample(this[`detail${i - 1}`], pb.mul(this.tilingUV0, 0.7)).xyz), 0.5);
                  this.$l.t1 = pb.mul(pb.add(pb.textureSample(this[`detail${i}`], this.tilingUV1).xyz, pb.textureSample(this[`detail${i}`], pb.mul(this.tilingUV1, 0.7)).xyz), 0.5);
                  this.$outputs.color = pb.vec4(pb.mix(this.t0, this.t1, pb.div(pb.sub(this.slope, detailInfo.minSlope), lastBound - detailInfo.minSlope)), 1);
                }
                if (paintNormals) {
                  this.$l.n0 = pb.mul(pb.add(pb.textureSample(this[`normal${i - 1}`], this.tilingUV0).xyz, pb.textureSample(this[`normal${i - 1}`], pb.mul(this.tilingUV0, 0.7)).xyz), 0.5);
                  this.$l.n1 = pb.mul(pb.add(pb.textureSample(this[`normal${i}`], this.tilingUV1).xyz, pb.textureSample(this[`normal${i}`], pb.mul(this.tilingUV1, 0.7)).xyz), 0.5);
                  this.$outputs.normal = pb.vec4(pb.mix(this.n0, this.n1, pb.div(pb.sub(this.slope, detailInfo.minSlope), lastBound - detailInfo.minSlope)), 1);
                }
              });
              low = lastBound;
            }
            this.$if(pb.and(pb.greaterThanEqual(this.slope, low), pb.lessThan(this.slope, hi)), function () {
              this.$l.tilingUV = pb.mul(this.$inputs.uv, detailInfo.density);
              if (paintDetail) {
                this.$outputs.color = pb.vec4(pb.mul(pb.add(pb.textureSample(this[`detail${i}`], this.tilingUV).xyz, pb.textureSample(this[`detail${i}`], pb.mul(this.tilingUV, 0.7)).xyz), 0.5), 1);
              }
              if (paintNormals) {
                this.$outputs.normal = pb.vec4(pb.mul(pb.add(pb.textureSample(this[`normal${i}`], this.tilingUV).xyz, pb.textureSample(this[`normal${i}`], pb.mul(this.tilingUV, 0.7)).xyz), 0.5), 1);
              }
            });
            lastBound = detailInfo.maxSlope;
          }
        });
      }
    });
  }
  protected doPaintTexture(camera: Camera, detailLevel: number, paintAlbedo: boolean, paintNormals: boolean) {
    const device = this._terrain.scene.device;
    device.clearFrameBuffer(new Vector4(1, 0, 0, 1), null, null);
    const bindGroup = paintNormals ? (this._bindGroupNormals || this._bindGroup) : this._bindGroup;
    const program = paintNormals ? (this._programNormals || this._program) : this._program;
    bindGroup.setValue('mvpMatrix', Matrix4x4.multiply(camera.viewProjectionMatrix, this._terrain.worldMatrix));
    bindGroup.setTexture('tex', this._terrain.normalMap);
    device.setProgram(program);
    device.setBindGroup(0, bindGroup);
    device.setBindGroup(1, null);
    device.setBindGroup(2, null);
    device.setRenderStates(this._renderStates);
    this._primitive.draw();
  }
}
