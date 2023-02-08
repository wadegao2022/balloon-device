import type { StructuredBuffer, PBStructTypeInfo } from "../device";

export class BufferPool {
  private static _uniformBufferFreeList: StructuredBuffer[] = [];
  private static _storageBufferFreeList: StructuredBuffer[] = [];
  static allocUniformBuffer(size: number): StructuredBuffer {
    return this.allocBuffer(this._uniformBufferFreeList, size);
  }
  static freeUniformBuffer(buffer: StructuredBuffer): void {
    return this.freeBuffer(this._uniformBufferFreeList, buffer);
  }
  static allocStorageBuffer(size: number): StructuredBuffer {
    return this.allocBuffer(this._storageBufferFreeList, size);
  }
  static freeStorageBuffer(buffer: StructuredBuffer): void {
    return this.freeBuffer(this._storageBufferFreeList, buffer);
  }
  static purgeUniformBuffers(): void {
    for (const buffer of this._uniformBufferFreeList) {
      buffer.dispose();
    }
    this._uniformBufferFreeList = [];
  }
  static purgeStorageBuffers(): void {
    for (const buffer of this._storageBufferFreeList) {
      buffer.dispose();
    }
    this._storageBufferFreeList = [];
  }
  static allocBuffer(freeList: StructuredBuffer[], size: number): StructuredBuffer {
    const index = this.findLeastSize(freeList, size);
    if (index >= 0) {
      const buffer = freeList[index];
      freeList.splice(index, 1);
      return buffer;
    }
    return null;
  }
  static freeBuffer(freeList: StructuredBuffer[], buffer: StructuredBuffer): void {
    const index = freeList.length > 0 ? this.findLeastSize(freeList, buffer.byteLength) : -1;
    if (index >= 0) {
      freeList.splice(index, 0, buffer);
    } else {
      freeList.push(buffer);
    }
  }
  private static findLeastSize(list: StructuredBuffer[], size: number): number {
    let left = 0;
    let right = list.length - 1;
    while (left < right) {
      const mid = (left + right) >> 1;
      const midSize = list[mid].byteLength;
      if (midSize >= size) {
        right = mid;
      } else {
        left = mid + 1;
      }
    }
    return list[left].byteLength >= size ? left : -1;
  }
}
