import { GPUResourceUsageFlags, StructuredBuffer, IndexBuffer, VertexStepMode, getVertexBufferStride, MAX_VERTEX_ATTRIBUTES, getVertexAttribByName, VertexAttribName } from './gpuobject';
import { PBArrayTypeInfo } from './builder/types';

export class VertexData {
  /** @internal */
  private _vertexBuffers: {
    buffer: StructuredBuffer;
    offset: number;
    stepMode: VertexStepMode;
  }[];
  /** @internal */
  private _indexBuffer: IndexBuffer;
  /** @internal */
  private _drawOffset: number;
  /** @internal */
  private _tag: number;
  constructor() {
    this._vertexBuffers = [];
    this._tag = 0;
    for (let i = 0; i < MAX_VERTEX_ATTRIBUTES; i++) {
      this._vertexBuffers.push(null);
    }
    this._indexBuffer = null;
    this._drawOffset = 0;
  }
  clone(): VertexData {
    const newVertexData = new VertexData();
    newVertexData._vertexBuffers = this._vertexBuffers.slice();
    newVertexData._indexBuffer = this._indexBuffer;
    newVertexData._drawOffset = this._drawOffset;
    return newVertexData;
  }
  updateTag() {
    this._tag++;
  }
  getTag(): number {
    return this._tag;
  }
  get vertexBuffers() {
    return this._vertexBuffers;
  }
  get indexBuffer() {
    return this._indexBuffer;
  }
  getDrawOffset(): number {
    return this._drawOffset;
  }
  setDrawOffset(offset: number) {
    if (offset !== this._drawOffset) {
      this._drawOffset = offset;
      this.updateTag();
    }
  }
  getVertexBuffer(location: number): StructuredBuffer {
    return this._vertexBuffers[location]?.buffer || null;
  }
  getIndexBuffer(): IndexBuffer {
    return this._indexBuffer || null;
  }
  setVertexBuffer(buffer: StructuredBuffer, stepMode?: VertexStepMode): StructuredBuffer {
    if (!buffer || !(buffer.usage & GPUResourceUsageFlags.BF_VERTEX)) {
      throw new Error('setVertexBuffer() failed: buffer is null or buffer has not Vertex usage flag');
    }
    stepMode = stepMode || 'vertex';
    const vertexType = (buffer.structure.structMembers[0].type as PBArrayTypeInfo).elementType;
    if (vertexType.isStructType()) {
      let offset = 0;
      for (const attrib of vertexType.structMembers) {
        const loc = getVertexAttribByName(attrib.name as VertexAttribName);
        this.internalSetVertexBuffer(loc, buffer, offset, stepMode);
        offset += attrib.size;
      }
    } else {
      const loc = getVertexAttribByName(buffer.structure.structMembers[0].name as VertexAttribName);
      this.internalSetVertexBuffer(loc, buffer, 0, stepMode);
    }
    return buffer;
  }
  removeVertexBuffer(buffer: StructuredBuffer): boolean {
    let removed = false;
    for (let loc = 0; loc < this._vertexBuffers.length; loc++) {
      const info = this._vertexBuffers[loc];
      const remove = info?.buffer === buffer;
      if (remove) {
        this._vertexBuffers[loc] = null;
        removed = true;
      }
    }
    if (removed) {
      this.updateTag();
    }
    return removed;
  }
  setIndexBuffer(buffer: IndexBuffer): IndexBuffer {
    if (buffer !== this._indexBuffer) {
      this._indexBuffer = buffer || null;
      this.updateTag();
    }
    return buffer;
  }
  /** @internal */
  private internalSetVertexBuffer(loc: number, buffer: StructuredBuffer, offset?: number, stepMode?: VertexStepMode): StructuredBuffer {
    if (loc < 0 || loc >= MAX_VERTEX_ATTRIBUTES) {
      throw new Error(`setVertexBuffer() failed: location out of bounds: ${loc}`);
    }
    this.updateTag();
    offset = Number(offset) || 0;
    stepMode = stepMode || 'vertex';
    const old = this._vertexBuffers[loc];
    if (!old
      || old.buffer !== buffer
      || old.offset !== offset
      || old.stepMode !== stepMode) {
      this._vertexBuffers[loc] = {
        buffer: buffer,
        offset: offset,
        stepMode: stepMode,
      };
      return buffer;
    }
    return null;
  }
}
