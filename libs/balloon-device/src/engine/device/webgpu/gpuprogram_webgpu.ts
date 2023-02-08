/* eslint-disable @typescript-eslint/no-explicit-any */
import { WebGPUObject } from './gpuobject_webgpu';
import { ShaderType } from '../base_types';
import type { GPUProgram, BindGroupLayout, BindPointInfo } from '../gpuobject';
import type { GPUProgramConstructParams, RenderProgramConstructParams, ComputeProgramConstructParams } from '../device';
import type { WebGPUDevice } from './device';

export class WebGPUProgram extends WebGPUObject<unknown> implements GPUProgram {
  private static _hashCounter = 0;
  private _type: 'render' | 'compute';
  private _vs: string;
  private _fs: string;
  private _cs: string;
  private _label: string;
  private _hash: string;
  private _error: string;
  private _bindGroupLayouts: BindGroupLayout[];
  private _vertexAttributes: string;
  private _csModule: GPUShaderModule;
  private _vsModule: GPUShaderModule;
  private _fsModule: GPUShaderModule;
  private _pipelineLayout: GPUPipelineLayout;
  constructor(device: WebGPUDevice, params: GPUProgramConstructParams) {
    super(device);
    this._type = params.type;
    this._label = params.label;
    this._bindGroupLayouts = [...params.params.bindGroupLayouts];
    this._error = '';
    if (params.type === 'render') {
      const renderParams = params.params as RenderProgramConstructParams;
      this._vs = renderParams.vs;
      this._fs = renderParams.fs;
      this._vertexAttributes = renderParams.vertexAttributes ? renderParams.vertexAttributes.join(':') : '';
    } else {
      const computeParams = params.params as ComputeProgramConstructParams;
      this._cs = computeParams.source;
    }
    this._load();
    this._hash = String(++WebGPUProgram._hashCounter);
  }
  get type(): 'render' | 'compute' {
    return this._type;
  }
  get label(): string {
    return this._label;
  }
  getCompileError(): string {
    return this._error;
  }
  getShaderSource(shaderType: ShaderType): string {
    switch (shaderType) {
      case ShaderType.Vertex: return this._vs;
      case ShaderType.Fragment: return this._fs;
      case ShaderType.Compute: return this._cs;
    }
  }
  getBindingInfo(name: string): BindPointInfo {
    for (let group = 0; group < this._bindGroupLayouts.length; group++) {
      const layout = this._bindGroupLayouts[group];
      for (let binding = 0; binding < layout.entries.length; binding++) {
        const bindingPoint = layout.entries[binding];
        if (bindingPoint.name === name) {
          return {
            group: group,
            binding: binding,
            type: bindingPoint.type
          };
        }
      }
    }
    return null;
  }
  get bindGroupLayouts(): BindGroupLayout[] {
    return this._bindGroupLayouts;
  }
  get vertexAttributes(): string {
    return this._vertexAttributes;
  }
  get hash(): string {
    return this._hash;
  }
  getPipelineLayout(): GPUPipelineLayout {
    return this._pipelineLayout;
  }
  getShaderModule(): { vsModule: GPUShaderModule, fsModule: GPUShaderModule, csModule: GPUShaderModule, pipelineLayout: GPUPipelineLayout } {
    return {
      vsModule: this._vsModule,
      fsModule: this._fsModule,
      csModule: this._csModule,
      pipelineLayout: this._pipelineLayout
    };
  }
  get fsModule(): GPUShaderModule {
    return this._fsModule;
  }
  destroy() {
    this._vsModule = null;
    this._fsModule = null;
    this._pipelineLayout = null;
    this._object = null;
  }
  async restore() {
    if (!this._object) {
      this._load();
    }
  }
  isProgram(): boolean {
    return true;
  }
  private _load() {
    if (this._type === 'render') {
      this._vsModule = this.createShaderModule(this._vs);
      this._fsModule = this.createShaderModule(this._fs);
    } else {
      this._csModule = this.createShaderModule(this._cs);
    }
    this._pipelineLayout = this.createPipelineLayout(this._bindGroupLayouts);
    this._object = {};
  }
  private createPipelineLayout(bindGroupLayouts: BindGroupLayout[]): GPUPipelineLayout {
    const layouts: GPUBindGroupLayout[] = [];
    bindGroupLayouts.forEach(val => {
      layouts.push(this._device.fetchBindGroupLayout(val));
    });
    return this._device.device.createPipelineLayout({
      bindGroupLayouts: layouts
    });
  }
  private createShaderModule(code: string): GPUShaderModule {
    const t0 = Date.now();
    let sm = this._device.device.createShaderModule({ code });
    if (sm && sm.compilationInfo) {
      sm.compilationInfo().then(compilationInfo => {
        const elapsed = Date.now() - t0;
        if (elapsed > 1000) {
          console.log(`compile shader took ${elapsed}ms: \n${code}`);
        }
        let err = false;
        if (compilationInfo?.messages?.length > 0) {
          let msg = '';
          for (const message of compilationInfo.messages) {
            if (message.type === 'error') {
              err = true;
            }
            msg += `${message.type}: ${message.message} (${message.lineNum}/${message.linePos})\n`;
          }
          if (msg) {
            this._error += msg;
            console.log(msg);
          }
        }
        if (err) {
          sm = null;
        }
      });
    }
    return sm;
  }
  use(): void {
    this._device.setProgram(this);
  }
}

