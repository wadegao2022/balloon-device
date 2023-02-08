import { PBPrimitiveType } from './builder/types';
import type { TypedArray, TypedArrayConstructor } from '../defs';
import type { StructuredValue, UniformBufferLayout, StructuredBuffer } from './gpuobject';


export class StructuredBufferData {
  protected _cache: ArrayBuffer;
  protected _buffer: StructuredBuffer;
  protected _size: number;
  protected _uniformMap: { [name: string]: TypedArray };
  protected _uniformPositions: { [name: string]: [number, number] };
  constructor(layout: UniformBufferLayout, buffer?: StructuredBuffer | ArrayBuffer) {
    this._size = (layout.byteSize + 15) & ~15;
    if (this._size <= 0) {
      throw new Error(`UniformBuffer(): invalid uniform buffer byte size: ${this._size}`);
    }
    // this._cache = new ArrayBuffer(size);
    this._uniformMap = {};
    this._uniformPositions = {};
    this._cache = buffer instanceof ArrayBuffer ? buffer : null;
    this._buffer = buffer instanceof ArrayBuffer ? null : buffer;
    this.init(layout, 0, '');
  }
  get byteLength(): number {
    return this._size;
  }
  get buffer(): ArrayBuffer {
    return this._cache;
  }
  get uniforms(): { [name: string]: TypedArray } {
    return this._uniformMap;
  }
  set(name: string, value: StructuredValue) {
    if (value !== undefined) {
      const view = this._uniformMap[name];
      if (view) {
        if (this._cache) {
          if (typeof value === 'number') {
            view[0] = value;
          } else if ((value as any)?._v) {
            view.set((value as any)._v);
          } else if (typeof (value as any)?.length === 'number') {
            view.set(value as any);
          } else {
            throw new Error('invalid uniform value');
          }
        } else {
          if (typeof value === 'number') {
            view[0] = value;
            this._buffer.bufferSubData(this._uniformPositions[name][0], view);
          } else if ((value as any)?._v) {
            this._buffer.bufferSubData(this._uniformPositions[name][0], (value as any)._v);
          } else if (typeof (value as any)?.length === 'number') {
            this._buffer.bufferSubData(this._uniformPositions[name][0], value as TypedArray);
          } else {
            throw new Error('invalid uniform value');
          }
        }
      } else {
        const proto = Object.getPrototypeOf(value);
        if (proto === Object.getPrototypeOf({})) {
          this.setStruct(name, value);
        } else {
          throw new Error('invalid uniform value');
        }
      }
    }
  }
  /** @internal */
  private setStruct(name: string, value: any) {
    for (const k in value) {
      this.set(`${name}.${k}`, value[k]);
    }
  }
  /** @internal */
  private init(layout: UniformBufferLayout, offset: number, prefix: string): number {
    for (const entry of layout.entries) {
      if (entry.subLayout) {
        offset = this.init(entry.subLayout, offset, `${prefix}${entry.name}.`);
      } else {
        const name = `${prefix}${entry.name}`;
        if (this._uniformPositions[name]) {
          throw new Error(`UniformBuffer(): duplicate uniform name: ${name}`);
        }
        if (entry.offset < offset || entry.byteSize < 0) {
          throw new Error('UniformBuffer(): invalid layout');
        }
        this._uniformPositions[name] = [entry.offset, entry.byteSize];
        let viewCtor: TypedArrayConstructor = null;
        switch (entry.type) {
          case PBPrimitiveType.F32:
            viewCtor = Float32Array;
            break;
          case PBPrimitiveType.U32:
          case PBPrimitiveType.BOOL:
            viewCtor = Uint32Array;
            break;
          case PBPrimitiveType.I32:
            viewCtor = Int32Array;
            break;
          case PBPrimitiveType.U16:
          case PBPrimitiveType.U16_NORM:
          case PBPrimitiveType.F16:
            viewCtor = Uint16Array;
            break;
          case PBPrimitiveType.I16:
          case PBPrimitiveType.I16_NORM:
            viewCtor = Int16Array;
            break;
          case PBPrimitiveType.U8:
          case PBPrimitiveType.U8_NORM:
            viewCtor = Uint8Array;
            break;
          case PBPrimitiveType.I8:
          case PBPrimitiveType.I8_NORM:
            viewCtor = Int8Array;
            break;
        }
        if (!viewCtor) {
          throw new Error(`UniformBuffer(): invalid data type for uniform: ${name}`);
        }
        if (entry.byteSize % viewCtor.BYTES_PER_ELEMENT) {
          throw new Error(`UniformBuffer(): invalid byte size for uniform: ${name}`);
        }
        if (this._cache) {
          this._uniformMap[name] = new viewCtor(this._cache, entry.offset, entry.byteSize / viewCtor.BYTES_PER_ELEMENT);
        } else {
          this._uniformMap[name] = new viewCtor(1);
        }
        offset = entry.offset + entry.byteSize;
      }
    }
    return offset;
  }
}
