import { CompareFunc, PrimitiveType } from "../base_types";
import { ProgramBuilder } from "../builder";
import { FaceMode, StencilOp } from "../render_states";
import { Vector4 } from "../../math";
import type { WebGPUProgram } from "./gpuprogram_webgpu";
import type { WebGPUBaseTexture } from "./basetexture_webgpu";
import type { WebGPUBindGroup } from "./bindgroup_webgpu";
import type { WebGPURenderStateSet } from "./renderstates_webgpu";
import type { WebGPUDevice } from "./device";
import type { FrameBufferInfo } from "./pipeline_cache";
import type { WebGPURenderPass } from "./renderpass_webgpu";

export class WebGPUClearQuad {
  private static _clearPrograms: WebGPUProgram[] = [];
  private static _clearBindGroup: WebGPUBindGroup = null;
  private static _clearStateSet: WebGPURenderStateSet = null;
  private static _defaultClearColor = new Vector4(0, 0, 0, 1);

  static drawClearQuad(renderPass: WebGPURenderPass, clearColor: Vector4, clearDepth: number, clearStencil: number) {
    if (!this._clearBindGroup) {
      this.initClearQuad(renderPass);
    }
    const numColorAttachments = renderPass.getFrameBufferInfo().colorFormats.length;
    const program = this._clearPrograms[numColorAttachments];
    const bClearColor = !!clearColor;
    const bClearDepth = !(clearDepth === null || clearDepth === undefined);
    const bClearStencil = !(clearStencil === null || clearStencil === undefined);
    this._clearBindGroup.setValue('clearValues', {
      color: bClearColor ? clearColor.getArray() : this._defaultClearColor.getArray(),
      depth: bClearDepth ? clearDepth : 1
    });
    this._clearStateSet.useDepthState().enableWrite(bClearDepth);
    this._clearStateSet.useColorState().setColorMask(bClearColor, bClearColor, bClearColor, bClearColor);
    this._clearStateSet.useStencilState().enable(bClearStencil).setReference(bClearStencil ? clearStencil : 0);
    renderPass.draw(program, null, this._clearStateSet, [this._clearBindGroup], null, PrimitiveType.TriangleStrip, 0, 4, 1);
  }
  private static initClearQuad(renderPass: WebGPURenderPass): void {
    this._clearPrograms[0] = this.createClearQuadProgram(renderPass, 1);
    this._clearPrograms[1] = this.createClearQuadProgram(renderPass, 2);
    this._clearPrograms[2] = this.createClearQuadProgram(renderPass, 3);
    this._clearPrograms[3] = this.createClearQuadProgram(renderPass, 4);
    this._clearBindGroup = renderPass.getDevice().createBindGroup(this._clearPrograms[0].bindGroupLayouts[0]) as WebGPUBindGroup;
    this._clearStateSet = renderPass.getDevice().createRenderStateSet() as WebGPURenderStateSet;
    this._clearStateSet.useDepthState().enableTest(false);
    this._clearStateSet.useRasterizerState().setCullMode(FaceMode.NONE);
    this._clearStateSet.useStencilState()
      .enable(false)
      .enableStencilTwoside(true)
      .setFrontOp(StencilOp.REPLACE, StencilOp.REPLACE, StencilOp.REPLACE)
      .setBackOp(StencilOp.REPLACE, StencilOp.REPLACE, StencilOp.REPLACE)
      .setFrontCompareFunc(CompareFunc.Always)
      .setBackCompareFunc(CompareFunc.Always);
  }
  private static createClearQuadProgram(renderPass: WebGPURenderPass, numColorAttachments: number): WebGPUProgram {
    const pb = new ProgramBuilder(renderPass.getDevice());
    const colorOutputNames = Array.from<string>({ length: numColorAttachments }).map((val, index) => `color${index}`);
    const uniformStruct = pb.defineStruct(null, 'std140', pb.vec4('color'), pb.float('depth'));
    return pb.buildRenderProgram({
      label: 'ClearQuad',
      vertex() {
        this.clearValues = uniformStruct().uniform(0);
        this.coords = [pb.vec2(-1, 1), pb.vec2(1, 1), pb.vec2(-1, -1), pb.vec2(1, -1)];
        this.$mainFunc(function () {
          this.$builtins.position = pb.vec4(this.coords.at(this.$builtins.vertexIndex), this.clearValues.depth, 1);
        });
      },
      fragment() {
        this.clearValues = uniformStruct().uniform(0);
        colorOutputNames.forEach(name => this.$outputs[name] = pb.vec4());
        this.$mainFunc(function () {
          for (const c of colorOutputNames) {
            this.$outputs[c] = this.clearValues.color;
          }
        });
      }
    }) as WebGPUProgram;
  }
}

export class WebGPUMipmapGenerator {
  static _frameBufferInfo: FrameBufferInfo = null;
  static _mipmapGenerationProgram: WebGPUProgram = null;
  static _mipmapGenerationBindGroup: WeakMap<WebGPUBaseTexture, WebGPUBindGroup[][]> = new WeakMap();
  static _mipmapGenerationStateSet: WebGPURenderStateSet = null;
  static generateMipmap(device: WebGPUDevice, tex: WebGPUBaseTexture) {
    if (!this._mipmapGenerationProgram) {
      this.initMipmapGeneration(device);
    }
    const cmdEncoder = device.device.createCommandEncoder();
    const miplevels = tex.mipLevelCount;
    const numLayers = tex.isTextureCube() ? 6 : tex.isTexture2DArray() ? tex.depth : 1;
    let tmpTex = tex.object;
    if (!tex.isRenderable()) {
      tmpTex = device.gpuCreateTexture({
        size: {
          width: tex.width,
          height: tex.height,
          depthOrArrayLayers: numLayers
        },
        format: tex.gpuFormat,
        mipLevelCount: tex.mipLevelCount,
        sampleCount: 1,
        dimension: '2d',
        usage: GPUTextureUsage.TEXTURE_BINDING
          | GPUTextureUsage.RENDER_ATTACHMENT
          | GPUTextureUsage.COPY_SRC,
      });
    }
    tex.setMipmapDirty(false);
    for (let face = 0; face < numLayers; face++) {
      for (let level = 1; level < miplevels; level++) {
        this.generateMiplevel(device, cmdEncoder, tex, tmpTex, tex.gpuFormat, tmpTex === tex.object ? level : level - 1, level, face);
      }
    }
    if (tmpTex !== tex.object) {
      let width = tex.width;
      let height = tex.height;
      for (let level = 1; level < miplevels; level++) {
        cmdEncoder.copyTextureToTexture({
          texture: tmpTex,
          mipLevel: level - 1
        }, {
          texture: tex.object,
          mipLevel: level
        }, {
          width: width,
          height: height,
          depthOrArrayLayers: numLayers
        });
        width = Math.ceil(width / 2);
        height = Math.ceil(height / 2);
      }
    }
    device.device.queue.submit([cmdEncoder.finish()]);
    if (tmpTex !== tex.object) {
      tmpTex.destroy();
    }
  }
  static generateMipmapsForBindGroups(device: WebGPUDevice, bindGroups: WebGPUBindGroup[]) {
    for (const bindGroup of bindGroups) {
      if (bindGroup) {
        for (const tex of bindGroup.textureList) {
          if (!tex.disposed && tex.isMipmapDirty()) {
            WebGPUMipmapGenerator.generateMipmap(device, tex);
          }
        }
      }
    }
  }
  private static generateMiplevel(device: WebGPUDevice, commandEncoder: GPUCommandEncoder, srcTex: WebGPUBaseTexture, dstTex: GPUTexture, format: GPUTextureFormat, dstLevel: number, srcLevel: number, face: number) {
    const renderPassEncoder = this.beginMipmapGenerationPass(commandEncoder, dstTex, format, dstLevel, face);
    renderPassEncoder.setBindGroup(0, this.getMipmapGenerationBindGroup(device, srcTex, srcLevel, face).bindGroup);
    const pipeline = device.pipelineCache.fetchRenderPipeline(this._mipmapGenerationProgram, null, this._mipmapGenerationStateSet, PrimitiveType.TriangleStrip, this._frameBufferInfo);
    if (pipeline) {
      renderPassEncoder.setPipeline(pipeline);
      renderPassEncoder.draw(4, 1, 0);
    }
    renderPassEncoder.end();
  }
  private static beginMipmapGenerationPass(encoder: GPUCommandEncoder, texture: GPUTexture, format: GPUTextureFormat, level: number, face: number): GPURenderPassEncoder {
    const passDesc: GPURenderPassDescriptor = {
      colorAttachments: [{
        view: texture.createView({
          dimension: '2d',
          baseMipLevel: level || 0,
          mipLevelCount: 1,
          baseArrayLayer: face || 0,
          arrayLayerCount: 1,
        }),
        loadOp: 'clear',
        clearValue: [0, 0, 0, 0],
        storeOp: 'store',
      }],
    }
    this._frameBufferInfo = {
      colorFormats: [format],
      depthFormat: null,
      sampleCount: 1,
      hash: null,
    };
    this._frameBufferInfo.hash = `${this._frameBufferInfo.colorFormats.join('-')}:${this._frameBufferInfo.depthFormat}:${this._frameBufferInfo.sampleCount}`;
    const renderPassEncoder = encoder.beginRenderPass(passDesc);
    renderPassEncoder.insertDebugMarker('MipmapGeneration');
    return renderPassEncoder;
  }
  private static getMipmapGenerationBindGroup(device: WebGPUDevice, texture: WebGPUBaseTexture, level: number, face: number): WebGPUBindGroup {
    let faceGroups = this._mipmapGenerationBindGroup.get(texture);
    if (!faceGroups) {
      faceGroups = [];
      this._mipmapGenerationBindGroup.set(texture, faceGroups);
    }
    let levelGroups = faceGroups[face];
    if (!levelGroups) {
      levelGroups = [];
      faceGroups[face] = levelGroups;
    }
    let levelGroup = levelGroups[level];
    if (!levelGroup) {
      levelGroup = device.createBindGroup(this._mipmapGenerationProgram.bindGroupLayouts[0]) as WebGPUBindGroup;
      levelGroup.setTextureView('tex', texture, level - 1, face, 1);
      levelGroups[level] = levelGroup;
    }
    return levelGroup;
  }
  private static initMipmapGeneration(device: WebGPUDevice): void {
    const pb = new ProgramBuilder(device);
    this._mipmapGenerationProgram = pb.buildRenderProgram({
      label: 'MipmapGeneration',
      vertex() {
        this.$outputs.outUV = pb.vec2();
        this.coords = [pb.vec2(-1, 1), pb.vec2(1, 1), pb.vec2(-1, -1), pb.vec2(1, -1)];
        this.uv = [pb.vec2(0, 0), pb.vec2(1, 0), pb.vec2(0, 1), pb.vec2(1, 1)];
        this.$mainFunc(function () {
          this.$builtins.position = pb.vec4(this.coords.at(this.$builtins.vertexIndex), 0, 1);
          this.$outputs.outUV = this.uv.at(this.$builtins.vertexIndex);
        });
      },
      fragment() {
        this.$outputs.color = pb.vec4();
        this.tex = pb.tex2D().uniform(0);
        this.$mainFunc(function () {
          this.$outputs.color = pb.textureSampleLevel(this.tex, this.$inputs.outUV, 0);
        });
      }
    }) as WebGPUProgram;
    this._mipmapGenerationStateSet = device.createRenderStateSet() as WebGPURenderStateSet;
    this._mipmapGenerationStateSet.useDepthState().enableTest(false).enableWrite(false);
    this._mipmapGenerationStateSet.useRasterizerState().setCullMode(FaceMode.NONE);
  }
}
