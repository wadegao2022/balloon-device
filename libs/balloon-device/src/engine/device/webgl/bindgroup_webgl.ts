import { WebGLBaseTexture } from './basetexture_webgl';
import { WebGLGPUProgram } from './gpuprogram_webgl';
import { GPUResourceUsageFlags, StructuredValue } from '../gpuobject';
import { WebGLStructuredBuffer } from './structuredbuffer_webgl';
import { WebGLTextureSampler } from './sampler_webgl';
import { WebGLGPUObject } from './gpuobject_webgl';
import type { PBStructTypeInfo } from '../builder';
import type { WebGLDevice } from './device_webgl';
import type { BindGroupLayout, BaseTexture, StructuredBuffer, TextureSampler, BindGroup, BindGroupLayoutEntry } from '../gpuobject';
import type { TypedArray } from '../../defs';

export class WebGLBindGroup extends WebGLGPUObject<unknown> implements BindGroup {
  private _layout: BindGroupLayout;
  private _resources: { [name: string]: WebGLStructuredBuffer | [WebGLBaseTexture, WebGLTextureSampler] };
  constructor(device: WebGLDevice, layout: BindGroupLayout) {
    super(device);
    this._device = device;
    this._layout = layout;
    this._resources = {};
    this._object = {};
  }
  getLayout(): BindGroupLayout {
    return this._layout;
  }
  getBuffer(name: string): StructuredBuffer {
    return this._getBuffer(name, true);
  }
  setBuffer(name: string, buffer: StructuredBuffer) {
    for (const entry of this._layout.entries) {
      if (entry.name === name) {
        if (!entry.buffer) {
          console.log(`setBuffer() failed: resource '${name}' is not buffer`);
        } else {
          if (buffer && !(buffer.usage & GPUResourceUsageFlags.BF_UNIFORM)) {
            console.log(`setBuffer() failed: buffer resource '${name}' must be type '${entry.buffer.type}'`);
          } else if (buffer !== this._resources[entry.name]) {
            this._resources[entry.name] = buffer as WebGLStructuredBuffer;
          }
        }
        return;
      }
    }
    console.log(`setBuffer() failed: no buffer resource named '${name}'`);
  }
  setRawData(name: string, byteOffset: number, data: TypedArray, srcPos?: number, srcLength?: number) {
    const mappedName = this._layout.nameMap?.[name];
    if (mappedName) {
      this.setRawData(mappedName, byteOffset, data, srcPos, srcLength);
    } else {
      const buffer = this._getBuffer(name, false);
      if (buffer) {
        buffer.bufferSubData(byteOffset, data, srcPos, srcLength);
      } else {
        console.log(`set(): no uniform buffer named '${name}'`);
      }
    }
  }
  setValue(name: string, value: StructuredValue) {
    const mappedName = this._layout.nameMap?.[name];
    if (mappedName) {
      this.setValue(mappedName, { [name]: value });
    } else {
      const buffer = this._getBuffer(name, false);
      if (buffer) {
        if ((value as any)?.BYTES_PER_ELEMENT) {
          buffer.bufferSubData(0, value as TypedArray);
        } else {
          for (const k in value as any) {
            buffer.set(k, value[k]);
          }
        }
      } else {
        console.log(`set(): no uniform buffer named '${name}'`);
      }
    }
  }
  setTextureView(name: string, value: BaseTexture, level: number, face: number) {
    throw new Error('setTextureView() not supported for webgl device');
  }
  getTexture(name: string): BaseTexture {
    const entry = this._findTextureLayout(name);
    if (entry) {
      return this._resources[name]?.[0] as BaseTexture || null;
    } else {
      throw new Error(`getTexture() failed:${name} is not a texture`);
    }
  }
  setTexture(name: string, texture: BaseTexture, sampler?: TextureSampler) {
    const entry = this._findTextureLayout(name);
    if (entry) {
      this._resources[name] = [
        texture as unknown as WebGLBaseTexture,
        (sampler || texture.getDefaultSampler(!!entry.texture?.autoBindSamplerComparison)) as WebGLTextureSampler];
    } else {
      console.log(`setTexture() failed: no texture uniform named '${name}'`)
    }
  }
  setSampler(name: string, value: TextureSampler) {
    // no sampler uniform support for webgl
  }
  apply(program: WebGLGPUProgram, offsets?: Iterable<number>) {
    const webgl2 = this._device.isWebGL2;
    let dynamicOffsetIndex = 0;
    for (let i = 0; i < this._layout.entries.length; i++) {
      const entry = this._layout.entries[i];
      const res = this._resources[entry.name];
      if (res instanceof WebGLStructuredBuffer) {
        if (webgl2) {
          if (entry.buffer.hasDynamicOffset) {
            const offset = offsets?.[dynamicOffsetIndex] || 0;
            dynamicOffsetIndex++;
            program.setBlock(res.structure.structName, res, offset);
          } else {
            program.setBlock(res.structure.structName, res, 0);
          }
        } else {
          program.setUniform(entry.name, res.getUniformData().uniforms);
        }
      } else if (res) {
        if (res[0].isTextureVideo()) {
          res[0].updateVideoFrame();
        }
        res[0].sampler = res[1];
        program.setUniform(entry.name, res);
      }
    }
  }
  destroy(): void {
    this._resources = {};
    this._object = null;
  }
  async restore(): Promise<void> {
    this._object = {};
  }
  isBindGroup(): this is BindGroup {
    return true;
  }
  private _getBuffer(name: string, nocreate = false) {
    for (const entry of this._layout.entries) {
      if (entry.buffer && entry.name === name) {
        let buffer = this._resources[entry.name] as WebGLStructuredBuffer;
        if (!buffer && !nocreate) {
          buffer = this._device.createStructuredBuffer(entry.type as PBStructTypeInfo, GPUResourceUsageFlags.BF_UNIFORM) as WebGLStructuredBuffer;
          this._resources[entry.name] = buffer;
        }
        return buffer;
      }
    }
    return null;
  }
  private _findTextureLayout(name: string): BindGroupLayoutEntry {
    for (const entry of this._layout.entries) {
      if ((entry.texture || entry.storageTexture || entry.externalTexture) && entry.name === name) {
        return entry;
      }
    }
    return null;
  }
}
