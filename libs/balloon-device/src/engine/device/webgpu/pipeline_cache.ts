import { compareFuncMap, stencilOpMap, primitiveTypeMap, faceModeMap, blendEquationMap, blendFuncMap } from './constants_webgpu';
import { PrimitiveType, CompareFunc } from '../base_types';
import { StencilOp, BlendEquation, BlendFunc } from '../render_states';
import * as rs from './renderstates_webgpu';
import { typeU16 } from '../builder';
import type { WebGPUVertexInputLayout } from './vertexinputlayout_webgpu';
import type { WebGPUProgram } from './gpuprogram_webgpu';
import type { WebGPUDevice } from './device';
import type { WebGPURenderStateSet } from './renderstates_webgpu';
import type { BindGroupLayout } from '../gpuobject';

const stencilFormats = ['stencil8', 'depth24plus-stencil8', 'depth24unorm-stencil8', 'depth32float-stencil8'];
const depthFormats = ['depth16unorm', 'depth24plus', 'depth24plus-stencil8', 'depth32float', 'depth24unorm-stencil8', 'depth32float-stencil8'];
export type FrameBufferInfo = { colorFormats: GPUTextureFormat[], depthFormat: GPUTextureFormat, sampleCount: number, hash: string };
export class PipelineCache {
  private _device: WebGPUDevice;
  private _renderPipelines: { [hash: string]: GPURenderPipeline };
  private _computePipelines: { [hash: string]: GPUComputePipeline };
  constructor(device: WebGPUDevice) {
    this._device = device;
    this._renderPipelines = {};
    this._computePipelines = {};
  }
  wipeCache() {
    this._renderPipelines = {};
    this._computePipelines = {};
  }
  fetchComputePipeline(program: WebGPUProgram): GPUComputePipeline {
    const hash = this.getComputePipelineHash(program);
    let pipeline = this._computePipelines[hash];
    if (pipeline === undefined) {
      const shaderModule = program.getShaderModule();
      const desc: GPUComputePipelineDescriptor = {
        layout: shaderModule.pipelineLayout,
        compute: {
          module: shaderModule.csModule,
          entryPoint: 'main',
        },
      };
      pipeline = this._device.gpuCreateComputePipeline(desc);
      this._computePipelines[hash] = pipeline;
    }
    return pipeline;
  }
  fetchRenderPipeline(program: WebGPUProgram, vertexData: WebGPUVertexInputLayout, stateSet: WebGPURenderStateSet, primitiveType: PrimitiveType, frameBufferInfo: FrameBufferInfo): GPURenderPipeline {
    if (!frameBufferInfo.hash) {
      return null;
    }
    if (!program.vertexAttributes) {
      // no vertex data needed for this pipeline
      vertexData = null;
    }
    const hash = this.getRenderPipelineHash(frameBufferInfo.hash, program, vertexData, stateSet, primitiveType);
    let pipeline = this._renderPipelines[hash];
    if (pipeline === undefined) {
      const bufferLayouts = vertexData ? this._device.fetchVertexLayout(vertexData.getLayouts(program.vertexAttributes).layoutHash) : null;
      const shaderModule = program.getShaderModule();
      const vertex: GPUVertexState = {
        module: shaderModule.vsModule,
        entryPoint: 'main'
      };
      if (bufferLayouts) {
        vertex.buffers = bufferLayouts;
      }
      const primitiveState = this.createPrimitiveState(vertexData, stateSet, primitiveType);
      const depthStencilState = this.createDepthStencilState(frameBufferInfo.depthFormat, stateSet);
      const colorTargetStates = frameBufferInfo.colorFormats.map(val => this.createColorTargetState(stateSet, val));
      const desc: GPURenderPipelineDescriptor = {
        label: hash,
        layout: shaderModule.pipelineLayout,
        vertex,
        primitive: primitiveState,
        depthStencil: depthStencilState,
        multisample: {
          count: frameBufferInfo.sampleCount,
        },
        fragment: {
          module: shaderModule.fsModule,
          entryPoint: 'main',
          targets: colorTargetStates
        }
      };
      pipeline = this._device.gpuCreateRenderPipeline(desc);
      this._renderPipelines[hash] = pipeline;
    }
    return pipeline;
  }
  private createPrimitiveState(vertexData: WebGPUVertexInputLayout, stateSet: WebGPURenderStateSet, primitiveType: PrimitiveType): GPUPrimitiveState {
    const topology = primitiveTypeMap[primitiveType];
    if (!topology) {
      throw new Error(`createPrimitiveState() failed: invalid primitive type: ${primitiveType}`);
    }
    const stateOverridden = this._device.getRenderStatesOverridden();
    const rasterizerState = stateOverridden?.rasterizerState || stateSet?.rasterizerState || rs.WebGPURasterizerState.defaultState as rs.WebGPURasterizerState;
    const cullMode = faceModeMap[rasterizerState.cullMode];
    if (!cullMode) {
      throw new Error(`createPrimitiveState() failed: invalid cull mode: ${rasterizerState.cullMode}`);
    }
    const frontFace = this._device.isWindingOrderReversed() ? 'cw' : 'ccw';
    const state: GPUPrimitiveState = {
      topology,
      frontFace,
      cullMode
    };
    if (topology === 'triangle-strip' || topology === 'line-strip') {
      state.stripIndexFormat = vertexData?.getIndexBuffer()?.indexType === typeU16 ? 'uint16' : 'uint32';
    }
    return state;
  }
  private createDepthStencilState(depthFormat: GPUTextureFormat, stateSet: WebGPURenderStateSet): GPUDepthStencilState {
    if (!depthFormat) {
      return undefined;
    }
    const stateOverridden = this._device.getRenderStatesOverridden();
    const depthState = stateOverridden?.depthState || stateSet?.depthState || rs.WebGPUDepthState.defaultState as rs.WebGPUDepthState;
    const stencilState = stateOverridden?.stencilState || stateSet?.stencilState || rs.WebGPUStencilState.defaultState as rs.WebGPUStencilState;
    const hasStencil = stencilFormats.indexOf(depthFormat) >= 0;
    const hasDepth = depthFormats.indexOf(depthFormat) >= 0;
    const depthWriteEnabled = hasDepth ? depthState.writeEnabled : false;
    const depthCompare: GPUCompareFunction = (hasDepth && depthState.testEnabled) ? compareFuncMap[depthState.compareFunc] : 'always';
    const state: GPUDepthStencilState = {
      format: depthFormat,
      depthWriteEnabled,
      depthCompare,
    };
    if (hasStencil) {
      const stencilFront = stencilState.enabled ? this.createStencilFaceState(stencilState.func, stencilState.failOp, stencilState.zFailOp, stencilState.passOp) : undefined;
      const stencilBack = stencilState.enabled ? this.createStencilFaceState(stencilState.funcBack, stencilState.failOpBack, stencilState.zFailOpBack, stencilState.passOpBack) : undefined;
      const stencilReadMask = stencilState.enabled ? stencilState.valueMask : undefined;
      const stencilWriteMask = stencilState.enabled ? stencilState.writeMask : undefined;
      state.stencilFront = stencilFront;
      state.stencilBack = stencilBack;
      state.stencilReadMask = stencilReadMask;
      state.stencilWriteMask = stencilWriteMask;
    }
    return state;
  }
  private createStencilFaceState(func: CompareFunc, failOp: StencilOp, zFailOp: StencilOp, passOp: StencilOp): GPUStencilFaceState {
    return {
      compare: compareFuncMap[func],
      failOp: stencilOpMap[failOp],
      depthFailOp: stencilOpMap[zFailOp],
      passOp: stencilOpMap[passOp],
    };
  }
  private createColorTargetState(stateSet: WebGPURenderStateSet, format: GPUTextureFormat) {
    const stateOverridden = this._device.getRenderStatesOverridden();
    const blendingState = stateOverridden?.blendingState || stateSet?.blendingState || rs.WebGPUBlendingState.defaultState as rs.WebGPUBlendingState;
    const colorState = stateOverridden?.colorState || stateSet?.colorState || rs.WebGPUColorState.defaultState as rs.WebGPUColorState;
    const r = colorState.redMask ? GPUColorWrite.RED : 0;
    const g = colorState.greenMask ? GPUColorWrite.GREEN : 0;
    const b = colorState.blueMask ? GPUColorWrite.BLUE : 0;
    const a = colorState.alphaMask ? GPUColorWrite.ALPHA : 0;
    const state: GPUColorTargetState = {
      format: format,
      writeMask: r | g | b | a
    };
    if (blendingState.enabled) {
      state.blend = this.createBlendState(blendingState);
    }
    return state;
  }
  private createBlendState(blendingState: rs.WebGPUBlendingState): GPUBlendState {
    return {
      color: this.createBlendComponent(blendingState.rgbEquation, blendingState.srcBlendRGB, blendingState.dstBlendRGB),
      alpha: this.createBlendComponent(blendingState.alphaEquation, blendingState.srcBlendAlpha, blendingState.dstBlendAlpha)
    }
  }
  private createBlendComponent(op: BlendEquation, srcFunc: BlendFunc, dstFunc: BlendFunc): GPUBlendComponent {
    const operation = blendEquationMap[op];
    if (!operation) {
      throw new Error(`createBlendComponent() failed: invalid blend op: ${op}`);
    }
    const srcFactor = blendFuncMap[srcFunc];
    if (!srcFactor) {
      throw new Error(`createBlendComponent() failed: invalid source blend func ${srcFunc}`);
    }
    const dstFactor = blendFuncMap[dstFunc];
    if (!dstFactor) {
      throw new Error(`createBlendComponent() failed: invalid dest blend func ${dstFunc}`);
    }
    return {
      operation,
      srcFactor,
      dstFactor
    };
  }
  private getRenderPipelineHash(fbHash: string, program: WebGPUProgram, vertexData: WebGPUVertexInputLayout, stateSet: WebGPURenderStateSet, primitiveType: PrimitiveType): string {
    const programHash = program.hash;
    const vertexHash = vertexData?.getLayouts(program.vertexAttributes).layoutHash || '';
    const stateHash = stateSet?.hash || '';
    const stateOverriddenHash = this._device.getRenderStatesOverridden()?.hash || '';
    return `${programHash}:${vertexHash}:${fbHash}:${primitiveType}:${stateHash}:${stateOverriddenHash}:${Number(this._device.isWindingOrderReversed())}`;
  }
  private getComputePipelineHash(program: WebGPUProgram): string {
    return program.hash;
  }
}
