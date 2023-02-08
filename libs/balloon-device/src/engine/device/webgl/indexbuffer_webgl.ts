import { WebGLGPUBuffer } from "./buffer_webgl";
import { PBPrimitiveTypeInfo, typeU16, typeU32 } from "../builder";
import { GPUResourceUsageFlags, IndexBuffer } from "../gpuobject";
import type { WebGLDevice } from './device_webgl';

export class WebGLIndexBuffer extends WebGLGPUBuffer implements IndexBuffer {
  readonly indexType: PBPrimitiveTypeInfo;
  readonly length: number;
  constructor(device: WebGLDevice, data: Uint16Array | Uint32Array, usage?: number) {
    if (!(data instanceof Uint16Array) && !(data instanceof Uint32Array)) {
      throw new Error('invalid index data');
    }
    super(device, GPUResourceUsageFlags.BF_INDEX | usage, data);
    this.indexType = data instanceof Uint16Array ? typeU16 : typeU32;
    this.length = data.length;
  }
}
