import { WebGPUBuffer } from "./buffer_webgpu";
import { StructuredBufferData } from "../uniformdata";
import { GPUResourceUsageFlags, StructuredBuffer, StructuredValue } from "../gpuobject";
import * as typeinfo from '../builder/types';
import type { TypedArray } from "../../../shared";
import type { WebGPUDevice } from './device';

const vertexFormatTable: { [id: string]: GPUVertexFormat } = {
  [typeinfo.typeU8Vec2_Norm.typeId]: 'unorm8x2',
  [typeinfo.typeU8Vec4_Norm.typeId]: 'unorm8x4',
  [typeinfo.typeI8Vec2_Norm.typeId]: 'snorm8x2',
  [typeinfo.typeI8Vec4_Norm.typeId]: 'snorm8x4',
  [typeinfo.typeU16Vec2.typeId]: 'uint16x2',
  [typeinfo.typeU16Vec4.typeId]: 'uint16x4',
  [typeinfo.typeI16Vec2.typeId]: 'sint16x2',
  [typeinfo.typeI16Vec4.typeId]: 'sint16x4',
  [typeinfo.typeU16Vec2_Norm.typeId]: 'unorm16x2',
  [typeinfo.typeU16Vec4_Norm.typeId]: 'unorm16x4',
  [typeinfo.typeI16Vec2_Norm.typeId]: 'snorm16x2',
  [typeinfo.typeI16Vec4_Norm.typeId]: 'snorm16x4',
  [typeinfo.typeF16Vec2.typeId]: 'float16x2',
  [typeinfo.typeF16Vec4.typeId]: 'float16x4',
  [typeinfo.typeF32.typeId]: 'float32',
  [typeinfo.typeF32Vec2.typeId]: 'float32x2',
  [typeinfo.typeF32Vec3.typeId]: 'float32x3',
  [typeinfo.typeF32Vec4.typeId]: 'float32x4',
  [typeinfo.typeU32.typeId]: 'uint32',
  [typeinfo.typeU32Vec2.typeId]: 'uint32x2',
  [typeinfo.typeU32Vec3.typeId]: 'uint32x3',
  [typeinfo.typeU32Vec4.typeId]: 'uint32x4',
  [typeinfo.typeI32.typeId]: 'sint32',
  [typeinfo.typeI32Vec2.typeId]: 'sint32x2',
  [typeinfo.typeI32Vec3.typeId]: 'sint32x3',
  [typeinfo.typeI32Vec4.typeId]: 'sint32x4',
}

export class WebGPUStructuredBuffer extends WebGPUBuffer implements StructuredBuffer {
  private _structure: typeinfo.PBStructTypeInfo;
  private _data: StructuredBufferData;
  constructor(device: WebGPUDevice, structure: typeinfo.PBStructTypeInfo, usage: number, source?: TypedArray) {
    if (!(structure?.isStructType())) {
      throw new Error('invalid structure type');
    }
    if (usage & GPUResourceUsageFlags.BF_INDEX) {
      throw new Error('structured buffer must not have Index usage flag');
    }
    if ((usage & GPUResourceUsageFlags.BF_READ) || (usage & GPUResourceUsageFlags.BF_WRITE)) {
      throw new Error('structured buffer must not have Read or Write usage flags');
    }
    if (usage & GPUResourceUsageFlags.BF_VERTEX) {
      if (structure.structMembers.length !== 1 || !structure.structMembers[0].type.isArrayType()) {
        throw new Error('structured buffer for vertex usage must have only one array member');
      }
    }
    if ((usage & GPUResourceUsageFlags.BF_UNIFORM) || (usage & GPUResourceUsageFlags.BF_STORAGE)) {
      usage |= GPUResourceUsageFlags.DYNAMIC;
    }
    const layout = structure.toBufferLayout(0, structure.layout);
    if (source && layout.byteSize !== source.byteLength) {
      throw new Error(`create structured buffer failed: invalid source size: ${source.byteLength}, should be ${layout.byteSize}`);
    }
    super(device, usage, source || layout.byteSize);
    this._data = new StructuredBufferData(layout, this);
    this._structure = structure;
  }
  set(name: string, value: StructuredValue) {
    this._data.set(name, value);
  }
  get structure(): typeinfo.PBStructTypeInfo {
    return this._structure;
  }
  set structure(st: typeinfo.PBStructTypeInfo) {
    if (st?.typeId !== this._structure.typeId) {
      const layout = st.toBufferLayout(0, st.layout);
      if (layout.byteSize > this.byteLength) {
        throw new Error(`set structure type failed: new structure type is too large: ${layout.byteSize}`);
      }
      this._data = new StructuredBufferData(layout, this);
      this._structure = st;
    }
  }
  static getGPUVertexFormat(type: typeinfo.PBTypeInfo): GPUVertexFormat {
    return vertexFormatTable[type.typeId];
  }
}
