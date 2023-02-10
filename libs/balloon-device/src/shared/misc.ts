export type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array;

export type TypedArrayConstructor<T extends TypedArray = any> = {
  new(): T;
  new(size: number): T;
  new(elements: number[]): T;
  new(buffer: ArrayBuffer): T;
  new(buffer: ArrayBuffer, byteOffset: number): T;
  new(buffer: ArrayBuffer, byteOffset: number, length: number): T;
  BYTES_PER_ELEMENT: number;
}

export class IterableWrapper implements Iterable<number> {
  protected _v: Float32Array;
  [Symbol.iterator](): Iterator<number> {
    return this._v[Symbol.iterator]();
  }
  constructor(nOrArray: number | Float32Array) {
    if (typeof nOrArray === 'number') {
      this._v = new Float32Array(nOrArray);
    } else {
      this._v = nOrArray;
    }
  }
  get size() {
    return this._v.length;
  }
  assign(other: ArrayLike<number>) {
    this._v.set((other as any)._v || other);
    return this;
  }
  getArray(): Float32Array {
    return this._v;
  }
  setArray(arr: Float32Array): this {
    if (!arr || arr.length !== this._v.length) {
      throw new Error(`IterableWrapper.setArray() failed: invalid array or array length: ${arr?.length}`);
    }
    this._v = arr;
    return this;
  }
}

export function formatNumber(
  val: number,
  fractLength: number,
  totalLength?: number,
  fillchar?: string,
): string {
  const fixed = val === (val | 0) ? String(val) : val.toFixed(fractLength);
  const ch = fillchar || '0';
  const tl = totalLength || 0;
  return tl > 0 ? (Array(totalLength).join(ch) + fixed).substr(-totalLength) : fixed;
}

const f = new Float32Array(1);
export function toFloat32(a: number): number {
  f[0] = a;
  return f[0];
}

export function numberEquals(a: number, b: number, epsl?: number) {
  a = toFloat32(a);
  b = toFloat32(b);
  // const e = typeof epsl === 'number' ? epsl : Math.max(measureEpsl(a), measureEpsl(b));
  const e = (typeof epsl === 'number' ? epsl : 0.0001) * Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= e;
}

export function numberClamp(value: number, low: number, high: number) {
  return value < low ? low : value > high ? high : value;
}

export function isPowerOf2(value: number) {
  return value % 1 === 0 && value >= 0 && (value & (value - 1)) === 0;
}

export function nextPowerOf2(value: number) {
  value--;
  value |= value >> 1;
  value |= value >> 2;
  value |= value >> 4;
  value |= value >> 8;
  value |= value >> 16;
  value++;
  return value;
}

export function isNumber(obj: unknown): obj is number {
  return typeof obj === 'number';
}
export function isInt(obj: unknown): boolean {
  return isNumber(obj) && obj % 1 === 0;
}
export function isBoolean(obj: unknown): obj is boolean {
  return typeof obj === 'boolean';
}
export function isString(obj: unknown): obj is string {
  return Object.prototype.toString.call(obj) === '[object String]';
}
export function isUndefined(obj: unknown): obj is undefined {
  return Object.prototype.toString.call(obj) === '[object Undefined]';
}
export function isNull(obj: unknown): obj is null {
  return Object.prototype.toString.call(obj) === '[object Null]';
}
export function isObject(obj: unknown): obj is { [name: string]: unknown } {
  return Object.prototype.toString.call(obj) === '[object Object]';
}
export function isBooleanObject(obj: unknown): obj is boolean {
  return Object.prototype.toString.call(obj) === '[object Boolean]';
}
export function isNumberObject(obj: unknown): obj is number {
  return Object.prototype.toString.call(obj) === '[object Number]';
}
export function isArray(obj: unknown): obj is Array<unknown> {
  return Object.prototype.toString.call(obj) === '[object Array]';
}
export function isMap(obj: unknown): obj is Map<unknown, unknown> {
  return Object.prototype.toString.call(obj) === '[object Map]';
}
export function isSet(obj: unknown): obj is Set<unknown> {
  return Object.prototype.toString.call(obj) === '[object Set]';
}
export function isRegExp(obj: unknown): obj is RegExp {
  return Object.prototype.toString.call(obj) === '[object RegExp]';
}
export function isArrayBuffer(obj: unknown): obj is ArrayBuffer {
  return Object.prototype.toString.call(obj) === '[object ArrayBuffer]';
}
export function isDate(obj: unknown): obj is Date {
  return Object.prototype.toString.call(obj) === '[object Date]';
}
export function isPrimitive(obj: unknown) {
  return isNumber(obj) || isString(obj) || isBoolean(obj) || isNull(obj) || isUndefined(obj);
}
export function radixSort(arr: unknown[], sortkey: (a: unknown) => number) {
  for (let shift = 0; shift < 32; shift += 8) {
    const piles = [];
    for (const n of arr) {
      const p = (sortkey(n) >> shift) & 0xff;
      (piles[p] || (piles[p] = [])).push(n);
    }
    for (let i = 0, ai = 0; i < piles.length; ++i) {
      if (piles[i]) {
        for (const p of piles[i]) {
          arr[ai++] = p;
        }
      }
    }
  }
}

export function makeObservableTypedArray<T extends TypedArray>(ctor: TypedArrayConstructor<T>): TypedArrayConstructor<T> {
  const notifyFuncs = (function () {
    const funcs = {} as any;
    ['set', 'copyWithin', 'fill', 'reverse', 'sort'].forEach(name => {
      funcs[name] = function (this: any, ...args: unknown[]) {
        const ret = this[name](...args);
        this.modified();
        return ret;
      };
    });
    funcs[Symbol.iterator] = function (this: any, ...args: unknown[]) {
      return this[Symbol.iterator](...args);
    };
    ['subarray'].forEach(name => {
      funcs[name] = function (this: any) {
        return this.forbidden(name);
      };
    });
    return funcs;
  }());
  return class ObservableTypedArray extends (ctor as TypedArrayConstructor) {
    protected _array: T;
    constructor(n: number) {
      super(n);
      const target = this;
      this._array = this as unknown as T;
      const readProps = {} as any;
      for (const f of Reflect.ownKeys(notifyFuncs)) {
        readProps[f] = () => notifyFuncs[f].bind(target);
      }
      return new Proxy(this, {
        get(target: ObservableTypedArray, prop: string) {
          const val = readProps[prop];
          return val ? val() : target[prop];
        },
        set(target: ObservableTypedArray, prop: string, value: unknown) {
          target[prop] = value;
          if (Number.isInteger(Number(prop))) {
            target.modified();
          }
          return true;
        }
      });
    }
    protected modified() {
      console.log('modified');
    }
    protected forbidden(name: string) {
      console.log(`'${name}' function call not allowed for observable typed array`);
    }
  } as unknown as TypedArrayConstructor<T>;
}

export const ObservableVector2 = makeObservableTypedArray(Float32Array);
export const ObservableVector3 = makeObservableTypedArray(Float32Array);
export const ObservableVector4 = makeObservableTypedArray(Float32Array);
export const ObservableVector16 = makeObservableTypedArray(Float32Array);

