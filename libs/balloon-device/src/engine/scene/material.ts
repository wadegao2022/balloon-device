import { Geometry, BindGroup, GPUProgram, RenderStateSet, Device, ProgramBuilder, BindGroupLayout, TextureSampler, TextureFilter } from '../device';
import { ShaderLib } from './materiallib/shaderlib';
import { List, ListIterator } from '../../shared';
import type { Matrix4x4 } from '../math';
import type { Drawable, DrawContext } from './drawable';

export type MaterialGCOptions = {
  disabled?: boolean,
  drawableCountThreshold?: number;
  materialCountThreshold?: number;
  inactiveTimeDuration?: number;
  verbose?: boolean,
}

type ProgramInfo = {
  programs: GPUProgram[],
  hash: string
};

class InstanceBindGroupPool {
  private _bindGroups: { bindGroup: BindGroup, freeSize: number }[];
  private _frameStamp: number;
  constructor() {
    this._bindGroups = [];
    this._frameStamp = -1;
  }
  apply(device: Device, hash: string, index: number, worldMatrices: Matrix4x4[]): number {
    const maxSize = device.getShaderCaps().maxUniformBufferSize;
    if (device.frameInfo.frameCounter !== this._frameStamp) {
      this._frameStamp = device.frameInfo.frameCounter;
      for (const bindGroup of this._bindGroups) {
        bindGroup.freeSize = maxSize;
      }
    }
    let bindGroupIndex = -1;
    for (let i = 0; i < this._bindGroups.length; i++) {
      if (this._bindGroups[i].freeSize >= worldMatrices.length * 64) {
        bindGroupIndex = i;
        break;
      }
    }
    if (bindGroupIndex < 0) {
      const program = Material.getProgramByHashIndex(hash, index);
      const bindGroup = program?.bindGroupLayouts[3] ? device.createBindGroup(program.bindGroupLayouts[3]) : null;
      this._bindGroups.push({ bindGroup: bindGroup, freeSize: maxSize });
      bindGroupIndex = this._bindGroups.length - 1;
    }
    const bindGroup = this._bindGroups[bindGroupIndex];
    const offset = (maxSize - bindGroup.freeSize) / 64;
    for (const matrix of worldMatrices) {
      bindGroup.bindGroup.setRawData('worldMatrix', maxSize - bindGroup.freeSize, matrix.getArray());
      bindGroup.freeSize -= 64;
    }
    device.setBindGroup(3, bindGroup.bindGroup);
    return offset;
  }
}

export class Material {
  /** @internal */
  private static _nextId = 0;
  /** @internal */
  protected static _programMap: {
    [hash: string]: ProgramInfo
  } = {};
  /** @internal */
  protected static _defaultBindGroupLayouts: { [env: string]: BindGroupLayout[] } = {};
  /** @internal */
  protected static _drawableLRU: List<Drawable> = new List<Drawable>();
  /** @internal */
  protected static _materialLRU: List<Material> = new List<Material>();
  /** @internal */
  protected static _gcOptions: MaterialGCOptions = {
    disabled: false,
    drawableCountThreshold: 500,
    materialCountThreshold: 200,
    inactiveTimeDuration: 30000,
  };
  /** @internal */
  protected static _boneMatrixTextureSampler: TextureSampler = null;
  /** @internal */
  protected static _instanceBindGroupPool: InstanceBindGroupPool = new InstanceBindGroupPool();
  /** @internal */
  protected static _drawableBindGroupMap: WeakMap<Drawable, {
    [hash: string]: {
      bindGroup: BindGroup[],
      xformTag: number[],
      bindGroupTag: number[]
    }
  }> = new WeakMap();
  /** @internal */
  protected _device: Device;
  /** @internal */
  protected _hash: string;
  /** @internal */
  protected _renderStateSet: RenderStateSet;
  /** @internal */
  protected _bindGroupMap: {
    [hash: string]: {
      materialBindGroup: BindGroup[],
      materialTag: number[],
      bindGroupTag: number[],
    }
  };
  /** @internal */
  protected _optionTag: number;
  /** @internal */
  protected _supportSharedUniforms: boolean;
  /** @internal */
  protected _materialBindGroup: BindGroup;
  /** @internal */
  protected _lruIterator: ListIterator<Material>;
  /** @internal */
  protected _lastRenderTimeStamp: number;
  /** @internal */
  protected _id: number;
  constructor(device: Device) {
    this._id = ++Material._nextId;
    this._device = device;
    this._hash = null;
    this._renderStateSet = device.createRenderStateSet();
    this._bindGroupMap = {};
    this._optionTag = 0;
    this._supportSharedUniforms = device.getMiscCaps().supportSharedUniforms;
    this._materialBindGroup = null;
    this._lruIterator = null;
    this._lastRenderTimeStamp = 0;
  }
  get id(): number {
    return this._id;
  }
  getLRUIterator(): ListIterator<Material> {
    return this._lruIterator;
  }
  setLRUIterator(iter: ListIterator<Material>): void {
    this._lruIterator = iter;
  }
  setLastRenderTimeStamp(val: number) {
    this._lastRenderTimeStamp = val;
  }
  getLastRenderTimeStamp(): number {
    return this._lastRenderTimeStamp;
  }
  getHash(): string {
    if (this._hash === null) {
      this._hash = this.createHash();
    }
    return this._hash;
  }
  get stateSet(): RenderStateSet {
    return this._renderStateSet;
  }
  set stateSet(stateset: RenderStateSet) {
    this._renderStateSet = stateset;
  }
  get device(): Device {
    return this._device;
  }
  isTransparent(): boolean {
    return false;
  }
  supportLighting(): boolean {
    return true;
  }
  draw(primitive: Geometry, ctx: DrawContext) {
    if (this.beginDraw(ctx)) {
      if (ctx.instanceData?.worldMatrices.length > 1) {
        primitive.drawInstanced(ctx.instanceData.worldMatrices.length);
      } else {
        primitive.draw();
      }
      this.endDraw();
    }
  }
  beginDraw(ctx: DrawContext): boolean {
    const numInstances = ctx.instanceData?.worldMatrices?.length || 1;
    const programInfo = this.getOrCreateProgram(ctx);
    if (programInfo) {
      const hash = programInfo.hash;
      if (!programInfo.programs[ctx.materialFunc]) {
        return null;
      }
      this._materialBindGroup = this.applyMaterialBindGroups(ctx, hash);
      if (numInstances > 1) {
        this.applyInstanceBindGroups(ctx, hash);
      } else {
        this.applyDrawableBindGroups(ctx, hash);
      }
      this._device.setRenderStates(this._renderStateSet);
      this._device.setProgram(programInfo.programs[ctx.materialFunc]);
      ctx.target.setLastRenderTimestamp(ctx.renderPass.renderTimeStamp);
      Material.lruPutDrawable(ctx.target);
      this.setLastRenderTimeStamp(ctx.renderPass.renderTimeStamp);
      Material.lruPutMaterial(this);
      return true;
    }
    return false;
  }
  endDraw(): void {
    this._materialBindGroup = null;
  }
  getMaterialBindGroup(): BindGroup {
    return this._materialBindGroup;
  }
  applyUniforms(bindGroup: BindGroup, ctx: DrawContext, needUpdate: boolean): void {
    if (needUpdate) {
      this._applyUniforms(bindGroup, ctx);
    }
  }
  getOrCreateProgram(ctx: DrawContext): ProgramInfo {
    const func = ctx.materialFunc;
    const programMap = Material._programMap;
    const hash = `${this.getHash()}:${!!ctx.target.getBoneMatrices()}:${Number(!!(ctx.instanceData?.worldMatrices.length > 1))}:${ctx.renderPassHash}`;
    let programInfo = programMap[hash];
    if (!programInfo || !programInfo.programs[func] || programInfo.programs[func].disposed) {
      console.time(hash);
      const program = this.createProgram(ctx, func);
      console.timeEnd(hash);
      if (!programInfo) {
        programInfo = {
          programs: [null, null, null],
          hash
        };
        programMap[hash] = programInfo;
      }
      programInfo.programs[func] = program;
    }
    return programInfo || null;
  }
  dispose(): void {
    this.clearBindGroupCache();
  }
  static initShader(pb: ProgramBuilder, ctx: DrawContext) {
    ctx.renderPass.setGlobalBindings(pb.globalScope, ctx);
    if (!ctx.instanceData || ctx.instanceData.worldMatrices.length === 1) {
      pb.globalScope.worldMatrix = pb.mat4().uniform(1).tag(ShaderLib.USAGE_WORLD_MATRIX);
    } else {
      pb.globalScope.instanceBufferOffset = pb.uint().uniform(1);
      pb.globalScope.worldMatrix = pb.defineStruct(null, 'std140', pb.mat4[ctx.renderPass.device.getShaderCaps().maxUniformBufferSize / 64]('matrices'))().uniform(3);
      pb.reflection.tag(ShaderLib.USAGE_WORLD_MATRIX, () => pb.globalScope.worldMatrix.matrices.at(pb.add(pb.globalScope.instanceBufferOffset, pb.uint(pb.globalScope.$builtins.instanceIndex))));
    }
    if (ctx.target.getBoneMatrices()) {
      // pb.globalScope.boneMatrices = pb.mat4[MAX_BONE_MATRIX_UNIFORM]().uniform(1).tag(ShaderLib.USAGE_BONE_MATRICIES);
      pb.globalScope.boneMatrices = pb.tex2D().uniform(1).sampleType('unfilterable-float').tag(ShaderLib.USAGE_BONE_MATRICIES);
      pb.globalScope.invBindMatrix = pb.mat4().uniform(1).tag(ShaderLib.USAGE_INV_BIND_MATRIX);
      pb.globalScope.boneTextureSize = pb.int().uniform(1).tag(ShaderLib.USAGE_BONE_TEXTURE_SIZE);
    }
  }
  static setGCOptions(opt: MaterialGCOptions) {
    this._gcOptions = Object.assign({}, this._gcOptions, opt || {});
  }
  static getGCOptions(): MaterialGCOptions {
    return this._gcOptions;
  }
  static garbageCollect(ts: number): number {
    let n = 0;
    ts -= this._gcOptions.inactiveTimeDuration;
    while (this._drawableLRU.length > this._gcOptions.drawableCountThreshold) {
      const iter = this._drawableLRU.begin();
      if (iter.data.getLastRenderTimeStamp() < ts) {
        const bindGroups = this._drawableBindGroupMap.get(iter.data);
        if (bindGroups) {
          for (const k in bindGroups) {
            for (const bindGroup of bindGroups[k].bindGroup) {
              if (bindGroup) {
                this.bindGroupGarbageCollect(bindGroup);
                n++;
              }
            }
          }
        }
        this._drawableBindGroupMap.delete(iter.data);
        iter.data.setLRUIterator(null);
        this._drawableLRU.remove(iter);
      } else {
        break;
      }
    }
    while (this._materialLRU.length > this._gcOptions.materialCountThreshold) {
      const iter = this._materialLRU.begin();
      const mat = iter.data as Material;
      if (mat.getLastRenderTimeStamp() < ts && mat._bindGroupMap) {
        n += mat.clearBindGroupCache();
        mat.setLRUIterator(null);
        this._materialLRU.remove(iter);
      } else {
        break;
      }
    }
    if (n > 0 && this._gcOptions.verbose) {
      console.log(`INFO: ${n} bind groups have been garbage collected`);
    }
    return n;
  }
  /** @internal */
  optionChanged(changeHash: boolean) {
    this._optionTag++;
    if (changeHash) {
      this._hash = null;
    }
  }
  /** @internal */
  static getProgramByHashIndex(hash: string, index: number) {
    return this._programMap[hash].programs[index]
  }
  /** @internal */
  private applyMaterialBindGroups(ctx: DrawContext, hash: string): BindGroup {
    const index = ctx.materialFunc;
    let bindGroupInfo = this._bindGroupMap[hash];
    if (!bindGroupInfo) {
      // bindGroups not created or have been garbage collected
      const materialBindGroup = [0, 1, 2].map(k => {
        const program = Material._programMap[hash].programs[k];
        return program?.bindGroupLayouts[2] ? this._device.createBindGroup(program.bindGroupLayouts[2]) : null;
      });
      bindGroupInfo = this._bindGroupMap[hash] = {
        materialBindGroup,
        bindGroupTag: [0, 0, 0],
        materialTag: [-1, -1, -1]
      };
    }
    const bindGroup = bindGroupInfo.materialBindGroup[index];
    if (bindGroup) {
      this.applyUniforms(bindGroup, ctx, bindGroupInfo.materialTag[index] < this._optionTag || bindGroupInfo.bindGroupTag[index] !== bindGroup.cid);
      bindGroupInfo.materialTag[index] = this._optionTag;
      bindGroupInfo.bindGroupTag[index] = bindGroup.cid;
      this._device.setBindGroup(2, bindGroup);
    } else {
      this._device.setBindGroup(2, null);
    }
    return bindGroup;
  }
  /** @internal */
  private getDrawableBindGroup(ctx: DrawContext, hash: string): {
    bindGroup: BindGroup[],
    xformTag: number[],
    bindGroupTag: number[]
  } {
    let drawableBindGroups = Material._drawableBindGroupMap.get(ctx.target);
    if (!drawableBindGroups) {
      drawableBindGroups = {};
      Material._drawableBindGroupMap.set(ctx.target, drawableBindGroups);
    }
    let drawableBindGroup = drawableBindGroups[hash];
    if (!drawableBindGroup) {
      const bindGroup = [0, 1, 2].map(k => {
        const program = Material._programMap[hash].programs[k];
        return program?.bindGroupLayouts[1] ? this._device.createBindGroup(program.bindGroupLayouts[1]) : null
      });
      drawableBindGroup = drawableBindGroups[hash] = {
        bindGroup,
        bindGroupTag: [0, 0, 0],
        xformTag: [-1, -1, -1],
      };
    }
    return drawableBindGroup;
  }
  /** @internal */
  private applyInstanceBindGroups(ctx: DrawContext, hash: string): void {
    const index = ctx.materialFunc;
    const offset = Material._instanceBindGroupPool.apply(this.device, hash, index, ctx.instanceData.worldMatrices);
    const bindGroup = this.getDrawableBindGroup(ctx, hash).bindGroup?.[index];
    if (bindGroup) {
      bindGroup.setValue('instanceBufferOffset', offset);
      this._device.setBindGroup(1, bindGroup);
    } else {
      this._device.setBindGroup(1, null);
    }
  }
  /** @internal */
  private applyDrawableBindGroups(ctx: DrawContext, hash: string): void {
    const index = ctx.materialFunc;
    const drawableBindGroup = this.getDrawableBindGroup(ctx, hash)
    if (drawableBindGroup.bindGroup) {
      const bindGroup = drawableBindGroup.bindGroup[index];
      if (drawableBindGroup.xformTag[index] < ctx.target.getXForm().getTag() || drawableBindGroup.bindGroupTag[index] !== bindGroup.cid) {
        bindGroup.setValue('worldMatrix', ctx.target.getXForm().worldMatrix);
        drawableBindGroup.xformTag[index] = ctx.target.getXForm().getTag();
        drawableBindGroup.bindGroupTag[index] = bindGroup.cid;
      }
      const boneMatrices = ctx.target.getBoneMatrices();
      if (boneMatrices) {
        if (!Material._boneMatrixTextureSampler) {
          Material._boneMatrixTextureSampler = this.device.createSampler({
            magFilter: TextureFilter.Nearest,
            minFilter: TextureFilter.Nearest,
            mipFilter: TextureFilter.None
          });
        }
        bindGroup.setTexture('boneMatrices', boneMatrices, Material._boneMatrixTextureSampler);
        bindGroup.setValue('boneTextureSize', boneMatrices.width);
        bindGroup.setValue('invBindMatrix', ctx.target.getInvBindMatrix());
      }
      this._device.setBindGroup(1, bindGroup);
    } else {
      this._device.setBindGroup(1, null);
    }
  }
  /** @internal */
  createHash(): string {
    return `${this.constructor.name}|${this._createHash()}`;
  }
  /** @internal */
  clearBindGroupCache(): number {
    let n = 0;
    for (const k in this._bindGroupMap) {
      for (const bindGroup of this._bindGroupMap[k].materialBindGroup) {
        if (bindGroup) {
          Material.bindGroupGarbageCollect(bindGroup);
          n++;
        }
      }
    }
    this._bindGroupMap = {};
    return n;
  }
  /** @internal */
  static bindGroupGarbageCollect(bindGroup: BindGroup) {
    const layout = bindGroup.getLayout();
    for (const entry of layout.entries) {
      if (entry.buffer) {
        const buffer = bindGroup.getBuffer(entry.name);
        if (buffer) {
          buffer.dispose();
          bindGroup.setBuffer(entry.name, null);
        }
      }
    }
  }
  /** @internal */
  private static lruPutDrawable(drawable: Drawable) {
    const iter = drawable.getLRUIterator();
    if (iter) {
      this._drawableLRU.removeAndAppend(iter);
    } else {
      drawable.setLRUIterator(this._drawableLRU.append(drawable));
    }
  }
  /** @internal */
  private static lruPutMaterial(material: Material) {
    const iter = material.getLRUIterator();
    if (iter) {
      this._materialLRU.removeAndAppend(iter);
    } else {
      material.setLRUIterator(this._materialLRU.append(material));
    }
  }
  /** @internal */
  protected createProgram(ctx: DrawContext, func: number): GPUProgram {
    const pb = new ProgramBuilder(this._device);
    return this._createProgram(pb, ctx, func);
  }
  /** @internal */
  protected _createProgram(pb: ProgramBuilder, ctx: DrawContext, func: number): GPUProgram {
    return null;
  }
  /** @internal */
  protected _applyUniforms(bindGroup: BindGroup, ctx: DrawContext) {
  }
  /** @internal */
  protected _createHash(): string {
    return '';
  }
}
