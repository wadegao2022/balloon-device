import { PrimitiveType } from '../base_types';
import { StructuredBuffer, VertexInputLayout, IndexBuffer, getVertexBufferStride, getVertexBufferAttribType } from '../gpuobject';
import { vertexFormatToHash } from './constants_webgpu';
import { WebGPUObject } from './gpuobject_webgpu';
import { WebGPUStructuredBuffer } from './structuredbuffer_webgpu';
import type { WebGPUDevice } from './device';
import type { VertexData } from '../vertexdata';
import type { WebGPUBuffer } from './buffer_webgpu';

export class WebGPUVertexInputLayout extends WebGPUObject<unknown> implements VertexInputLayout<unknown> {
  private static _hashCounter = 0;
  private _vertexData: VertexData;
  private _hash: string;
  private _layouts: { [hash: string]: { layoutHash: string, buffers: { buffer: WebGPUBuffer, offset: number }[] } };
  constructor(device: WebGPUDevice, vertexData: VertexData) {
    super(device);
    this._vertexData = vertexData.clone();
    this._hash = String(++WebGPUVertexInputLayout._hashCounter);
    this._layouts = {};
  }
  destroy() {
    this._object = null;
  }
  async restore(): Promise<void> {
    this._object = {};
  }
  get hash(): string {
    return this._hash;
  }
  get vertexBuffers() {
    return this._vertexData.vertexBuffers;
  }
  get indexBuffer() {
    return this._vertexData.indexBuffer;
  }
  getDrawOffset(): number {
    return this._vertexData.getDrawOffset();
  }
  getVertexBuffer(location: number): StructuredBuffer {
    return this._vertexData.getVertexBuffer(location);
  }
  getIndexBuffer(): IndexBuffer {
    return this._vertexData.getIndexBuffer();
  }
  getLayouts(attributes: string): { layoutHash: string, buffers: { buffer: WebGPUBuffer, offset: number }[] } {
    if (!attributes) {
      return null;
    }
    let layout = this._layouts[attributes];
    if (!layout) {
      layout = this.calcHash(attributes);
      this._layouts[attributes] = layout;
    }
    return layout;
  }
  private calcHash(attribHash: string): { layoutHash: string, buffers: { buffer: WebGPUStructuredBuffer, offset: number }[] } {
    const layouts: string[] = [];
    const layoutVertexBuffers: { buffer: WebGPUStructuredBuffer, offset: number }[] = [];
    const vertexBuffers = this._vertexData.vertexBuffers;
    const drawOffset = this._vertexData.getDrawOffset();
    const attributes = attribHash.split(':').map(val => Number(val));
    for (let idx = 0; idx < attributes.length; idx++) {
      const attrib = attributes[idx];
      const bufferInfo = vertexBuffers[attrib];
      const buffer = bufferInfo?.buffer;
      if (!buffer) {
        console.log(`ERROR: No vertex buffer set for location ${idx}`);
        continue;
      }
      const vertexType = getVertexBufferAttribType(buffer.structure, attrib);
      if (!vertexType) {
        console.log(`ERROR: No vertex attrib ${attrib} found for vertex buffer`);
        return null;
      }
      const gpuFormat = WebGPUStructuredBuffer.getGPUVertexFormat(vertexType);
      if (!gpuFormat) {
        throw new Error('Invalid vertex buffer format');
      }
      const index = layoutVertexBuffers.findIndex(val => val.buffer === buffer);
      const stride = getVertexBufferStride(bufferInfo.buffer.structure);
      if (index >= 0 && stride * drawOffset !== layoutVertexBuffers[index].offset) {
        throw new Error('WebGPUVertexData.createLayouts() failed: inconsistent stride for interleaved vertex buffer');
      }
      let layout = index >= 0 ? layouts[index] : `${stride}-${Number(bufferInfo.stepMode === 'instance')}`;
      layout += `-${vertexFormatToHash[gpuFormat]}-${bufferInfo.offset}-${idx}`;
      if (index >= 0) {
        layouts[index] = layout;
      } else {
        layouts.push(layout);
        layoutVertexBuffers.push({ buffer: buffer as WebGPUStructuredBuffer, offset: stride * drawOffset });
      }
    }
    return {
      layoutHash: layouts.join(':'),
      buffers: layoutVertexBuffers,
    };
  }
  bind(): void {
    this._device.setVertexData(this);
  }
  draw(primitiveType: PrimitiveType, first: number, count: number): void {
    this.bind();
    this._device.draw(primitiveType, first, count);
  }
  drawInstanced(
    primitiveType: PrimitiveType,
    first: number,
    count: number,
    numInstances: number,
  ) {
    this.bind();
    this._device.drawInstanced(primitiveType, first, count, numInstances);
  }
}
