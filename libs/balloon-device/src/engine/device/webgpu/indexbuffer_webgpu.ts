import { WebGPUBuffer } from "./buffer_webgpu";
import { PBPrimitiveTypeInfo, typeU16, typeU32 } from "../builder";
import { GPUResourceUsageFlags, IndexBuffer } from "../gpuobject";
import type { WebGPUDevice } from "./device";

export class WebGPUIndexBuffer extends WebGPUBuffer implements IndexBuffer {
  readonly indexType: PBPrimitiveTypeInfo;
  readonly length: number;
  constructor(device: WebGPUDevice, data: Uint16Array | Uint32Array, usage?: number) {
    if (!(data instanceof Uint16Array) && !(data instanceof Uint32Array)) {
      throw new Error('invalid index data');
    }
    super(device, GPUResourceUsageFlags.BF_INDEX | usage, data);
    this.indexType = data instanceof Uint16Array ? typeU16 : typeU32;
    this.length = data.length;
  }
}
