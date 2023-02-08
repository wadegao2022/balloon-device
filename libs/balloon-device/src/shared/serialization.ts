/* eslint-disable @typescript-eslint/no-explicit-any */
import {GenConstructor, superClassOf, assert} from './utils';

interface SerializableClass extends GenConstructor<unknown> {
  __serializationInfo: ISerializeInfo;
}

type SerializationFactory = {
  [name: string]: SerializableClass;
};

/*
export class Utils {
    static debug: boolean = false;
    static isNumber (obj: unknown): obj is number {
        return typeof obj === 'number';
    }
    static isInt (obj: unknown): boolean{
        return this.isNumber(obj) && obj % 1 === 0;
    }
    static isBoolean (obj: unknown): obj is boolean {
        return typeof obj === 'boolean';
    }
    static isString (obj: unknown): obj is string {
        return typeof obj === 'string';
    }
    static isUndefined (obj: unknown): obj is undefined {
        return typeof obj === 'undefined';
    }
    static isNull (obj: unknown): obj is null {
        return obj === null;
    }
    static isObject (obj: unknown): obj is {[name:string]:unknown} {
        return Object.prototype.toString.call(obj) === '[object Object]';
    }
    static isStringObject (obj: unknown): obj is String {
        return typeof obj === 'object' && Object.prototype.toString.call(obj) === '[object String]' && obj.constructor === String;
    }
    static isBooleanObject (obj: unknown): obj is Boolean {
        return typeof obj === 'object' && Object.prototype.toString.call(obj) === '[object Boolean]' && obj.constructor === Boolean;
    }
    static isNumberObject (obj: unknown): obj is Number {
        return typeof obj === 'object' && Object.prototype.toString.call(obj) === '[object Number]' && obj.constructor === Number;
    }
    static isArray<T = unknown> (obj: unknown): obj is Array<T> {
        return Object.prototype.toString.call(obj) === '[object Array]';
    }
    static isMap<K = unknown, V = unknown> (obj: unknown): obj is Map<K,V> {
        return Object.prototype.toString.call(obj) === '[object Map]';
    }
    static isSet<T = unknown> (obj: unknown): obj is Set<T> {
        return Object.prototype.toString.call(obj) === '[object Set]';
    }
    static isRegExp (obj: unknown): obj is RegExp {
        return Object.prototype.toString.call(obj) === '[object RegExp]';
    }
    static isArrayBuffer (obj: unknown): obj is ArrayBuffer {
        return Object.prototype.toString.call(obj) === '[object ArrayBuffer]';
    }
    static isDate (obj: unknown): obj is Date {
        return Object.prototype.toString.call(obj) === '[object Date]';
    }
    static isFunction (obj: unknown): obj is Function {
        return Object.prototype.toString.call(obj) === '[object Function]';
    }
    static isPrimitive (obj: unknown) {
        return this.isNumber(obj) || this.isString(obj) || this.isBoolean(obj) || this.isNull(obj) || this.isUndefined(obj);
    }
    static deepCopy (obj: unknown) {
        return this.isPrimitive(obj) ? obj : JSON.parse(JSON.stringify(obj));
    }
    static equals (obj1: unknown, obj2: unknown) {
        for (let propName in obj1 as any) {
            if (obj1.hasOwnProperty(propName) !== obj2.hasOwnProperty(propName)) {
                return false;
            } else if (typeof obj1[propName] !== typeof obj2[propName]) {
                return false;
            }
        }
        for (let propName in obj2 as any) {
            if (obj1.hasOwnProperty(propName) !== obj2.hasOwnProperty(propName)) {
                return false;
            } else if (typeof obj1[propName] !== typeof obj2[propName]) {
                return false;
            }
            if (!obj1.hasOwnProperty(propName)) {
                continue;
            }
            if (obj1[propName] instanceof Array && obj2[propName] instanceof Array) {
                if (!this.equals(obj1[propName], obj2[propName])) {
                    return false;
                }
            } else if (obj1[propName] instanceof Object && obj2[propName] instanceof Object) {
                if (!this.equals(obj1[propName], obj2[propName])) {
                    return false;
                }
            } else if (obj1[propName] !== obj2[propName]) {
                return false;
            }
        }
        return true;
    }
    static trimLeft (str:string) {
        return str.replace(/(^\s*)/g, '');
    }
    static trimRight (str:string) {
        return str.replace(/(\s*$)/g, '');
    }
    static trim (str:string) {
        return str.replace(/(^\s*)|(\s*$)/g, '');
    }
    static mergeBlank = function(str: string) {
        return str.replace(/\s+/g, ' ');
    }
    static toUnicode (str:string): string {
        return str.replace (/[\u007F-\uFFFF]/g, function(chr) {
            return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
        })
    }
    static fromUnicode (str:string): string {
        return str.replace (/\\u[0-9|a-f|A-F]{4}/g, function (s) {
            return String.fromCharCode(parseInt(s.slice(2), 16));
        });
    }
    static safeParseNumber (value: unknown) {
        const n = Number(value);
        return isNaN(n) ? null : n;
    }
    static safeParseInt (value: unknown, defaultValue?: unknown) {
        const n = this.safeParseNumber (value);
        if (this.isNumber(n) && n === (n|0)) {
            return n;
        }
        return null;
    }
    static isMD5 (str: unknown) {
        return this.isString(str) && /^[0-9a-f]{32}$/.test(str);
    }
    static patch (a: unknown, diff: unknown): unknown {
        if (this.isObject(diff)) {
            if (diff.type === 'R') {
                return diff.diff;
            } else if (diff.type === 'A') {
                if (!this.isArray(a) || !this.isArray(diff.diff)) {
                    throw new Error('Invalid patch for array type');
                }
                return this.patchArray (a, diff.diff);
            } else if (diff.type === 'U') {
                if (!this.isObject(a)) {
                    throw new Error('Invalid patch for object type');
                }
                return this.patchObject (a, diff.diff);
            }
        } else {
            throw new Error('patch: Invalid diff object type');
        }
    }
    static diff (a: unknown, b: unknown):unknown {
        if (this.isObject(a) && this.isObject(b)) {
            const d = this.diffObject (a, b);
            return d ? { type: 'U', diff: d } : null;
        } else if (this.isArray(a) && this.isArray(b)) {
            const d = this.diffArray (a, b);
            return d ? { type: 'A', diff: d } : null;
        } else if (this.isPrimitive(a) && this.isPrimitive(b)) {
            return a === b ? null : { type: 'R', diff: b };
        } else {
            return { type: 'R', diff: b };
        }
    }
    static diffObject (obj1: unknown, obj2: unknown): unknown {
        const f1 = Object.getOwnPropertyNames(obj1);
        const f2 = Object.getOwnPropertyNames(obj2);
        const result: unknown = {};
        for (const f of f1) {
            if (f2.indexOf (f) >= 0) {
                const d = this.diff (obj1[f], obj2[f]);
                if (d) {
                    result[f] = d;
                }
            } else {
                result[f] = { type: 'D' };
            }
        }
        for (const f of f2) {
            if (f1.indexOf(f) < 0) {
                result[f] = { type: 'N', diff: obj2[f] };
            }
        }
        return  Object.getOwnPropertyNames(result).length > 0 ? result : null;
    }
    static patchObject (obj: unknown, diff: unknown): unknown {
        if (!this.isObject(diff)) {
            throw new Error (`Invalid patch: ${diff}`);
        }
        for (const f in diff) {
            if (diff.hasOwnProperty (f)) {
                const d = diff[f];
                if (!this.isObject(d) || this.isUndefined(d.type)) {
                    throw new Error (`Invalid patch: ${diff}`);
                }
                switch (d.type) {
                    case 'N':
                        if (obj.hasOwnProperty(f)) {
                            throw new Error (`Newly created field <${f}> already exists`);
                        }
                        obj[f] = d.diff;
                        break;
                    case 'R':
                        if (!obj.hasOwnProperty(f)) {
                            throw new Error (`Replaced field <${f}> not exists`);
                        }
                        obj[f] = d.diff;
                        break;
                    case 'U':
                    case 'A':
                        if (!obj.hasOwnProperty(f)) {
                            throw new Error (`Updated field <${f}> not exists`);
                        }
                        obj[f] = this.patch (obj[f], d);
                        break;
                    case 'D':
                        if (!obj.hasOwnProperty(f)) {
                            throw new Error (`Deleted field <${f}> not exists`);
                        }
                        delete obj[f];
                        break;
                    default:
                        throw new Error (`Invalid diff type ${d.type} for object`);
                }
            }
        }
        return obj;
    }
    static diffArray (arr1: unknown[], arr2: unknown[]): unknown {
        const len1 = arr1.length;
        const len2 = arr2.length;
        const details: unknown[] = [];
        for (let i = 0; i < len1; i++) {
            if (i < len2) {
                const d = this.diff (arr1[i], arr2[i]);
                if (d) {
                    details.push({ index:i, diff:d });
                }
            } else {
                details.push({ index:i, diff: { type: 'D' }});
                break;
            }
        }
        for (let i = len1; i < len2; i++) {
            details.push({ index:i, diff: { type: 'N', diff: arr2[i] } });
        }
        return details.length > 0 ? details : null;
    }
    static patchArray (arr: unknown[], diff: unknown[]): unknown[] {
        if (this.isArray(diff)) {
            for (const d of diff) {
                if (!this.isObject(d) || !this.isObject(d.diff) || !this.isNumber(d.index)) {
                    throw new Error ('patchArray: Invalid diff object');
                }
                if (d.diff.type === 'D') {
                    arr.length = d.index;
                    break;
                } else if (d.diff.type === 'N') {
                    arr.push (d.diff.diff);
                } else {
                    arr[d.index] = this.patch (arr[d.index], d.diff);
                }
            }
        }
        return arr;
    }
}
*/

type IPrimitiveData = number | string | null | undefined | boolean;

interface ISerializedBaseObject {
  props?: {[k: string]: ISerializedData};
}

interface ISerializedRefObject extends ISerializedBaseObject {
  type: 'refobj';
  value: number;
}

interface ISerializedNumberObject extends ISerializedBaseObject {
  type: 'number';
  value: number;
}

interface ISerializedBooleanObject extends ISerializedBaseObject {
  type: 'boolean';
  value: boolean;
}

interface ISerializedStringObject extends ISerializedBaseObject {
  type: 'string';
  value: string;
}

interface ISerializedMapObject extends ISerializedBaseObject {
  type: 'map';
  value: Array<[ISerializedData, ISerializedData]>;
}

interface ISerializedSetObject extends ISerializedBaseObject {
  type: 'set';
  value: Array<ISerializedData>;
}

interface ISerializedDateObject extends ISerializedBaseObject {
  type: 'date';
  value: number;
}

interface ISerializedRegExpObject extends ISerializedBaseObject {
  type: 'regexp';
  value: string;
}

interface ISerializedPlainObject {
  type: 'object';
  value: {[k: string]: ISerializedData};
}

interface ISerializedUserObject {
  type: 'object';
  value: {[k: string]: ISerializedData};
  classname: string;
}

export interface IPersistentData {
  objects: ISerializedData[];
  root: ISerializedData;
}

type ISerializedObject =
  | ISerializedRefObject
  | ISerializedNumberObject
  | ISerializedBooleanObject
  | ISerializedStringObject
  | ISerializedMapObject
  | ISerializedSetObject
  | ISerializedDateObject
  | ISerializedRegExpObject
  | ISerializedPlainObject
  | ISerializedUserObject;
type ISerializedData = IPrimitiveData | Array<ISerializedData> | ISerializedObject;

function isPrimitive(obj: unknown): obj is number | string | boolean | null | undefined {
  return (
    typeof obj === 'number' ||
    typeof obj === 'string' ||
    typeof obj === 'boolean' ||
    obj === null ||
    obj === undefined
  );
}

function isArray<T = unknown>(obj: unknown): obj is Array<T> {
  return (
    typeof obj === 'object' &&
    Object.prototype.toString.call(obj) === '[object Array]' &&
    obj.constructor === Array
  );
}

function isStringObject(obj: unknown): obj is String {
  return (
    typeof obj === 'object' &&
    Object.prototype.toString.call(obj) === '[object String]' &&
    obj.constructor === String
  );
}
function isBooleanObject(obj: unknown): obj is Boolean {
  return (
    typeof obj === 'object' &&
    Object.prototype.toString.call(obj) === '[object Boolean]' &&
    obj.constructor === Boolean
  );
}
function isNumberObject(obj: unknown): obj is Number {
  return (
    typeof obj === 'object' &&
    Object.prototype.toString.call(obj) === '[object Number]' &&
    obj.constructor === Number
  );
}
function isMap<K = unknown, V = unknown>(obj: unknown): obj is Map<K, V> {
  return Object.prototype.toString.call(obj) === '[object Map]';
}
function isSet<T = unknown>(obj: unknown): obj is Set<T> {
  return Object.prototype.toString.call(obj) === '[object Set]';
}
function isRegExp(obj: unknown): obj is RegExp {
  return Object.prototype.toString.call(obj) === '[object RegExp]';
}
function isDate(obj: unknown): obj is Date {
  return Object.prototype.toString.call(obj) === '[object Date]';
}
function isObject(obj: unknown): obj is {[name: string]: unknown} {
  return Object.prototype.toString.call(obj) === '[object Object]';
}

function isPrimitiveData(data: unknown): data is IPrimitiveData {
  return isPrimitive(data);
}

function isArrayData(data: ISerializedData): data is Array<ISerializedData> {
  return isArray(data);
}

function isNumberData(data: ISerializedData): data is ISerializedNumberObject {
  return !isArrayData(data) && !isPrimitiveData(data) && data.type === 'number';
}

function isStringData(data: ISerializedData): data is ISerializedStringObject {
  return !isArrayData(data) && !isPrimitiveData(data) && data.type === 'string';
}

function isBooleanData(data: ISerializedData): data is ISerializedBooleanObject {
  return !isArrayData(data) && !isPrimitiveData(data) && data.type === 'boolean';
}

function isMapData(data: ISerializedData): data is ISerializedMapObject {
  return !isArrayData(data) && !isPrimitiveData(data) && data.type === 'map';
}

function isSetData(data: ISerializedData): data is ISerializedSetObject {
  return !isArrayData(data) && !isPrimitiveData(data) && data.type === 'set';
}

function isDateData(data: ISerializedData): data is ISerializedDateObject {
  return !isArrayData(data) && !isPrimitiveData(data) && data.type === 'date';
}

function isRegExpData(data: ISerializedData): data is ISerializedRegExpObject {
  return !isArrayData(data) && !isPrimitiveData(data) && data.type === 'regexp';
}

function isRefData(data: ISerializedData): data is ISerializedRefObject {
  return !isArrayData(data) && !isPrimitiveData(data) && data.type === 'refobj';
}

function isObjectData(data: ISerializedData): data is ISerializedObject {
  return !isArrayData(data) && !isPrimitiveData(data) && data.type === 'object';
}

function isPlainObjectData(data: ISerializedData): data is ISerializedPlainObject {
  return isObjectData(data) && !('classname' in data);
}

function isUserObjectData(data: ISerializedData): data is ISerializedUserObject {
  return isObjectData(data) && !isPlainObjectData(data);
}

export class SerializationInternalError extends Error {
  constructor(msg?: string) {
    super(msg || 'Serialization/Deserialization: internal error');
  }
}

export class SerializationUnresolvedError extends Error {
  constructor(msg?: string) {
    super(msg || 'Serialization/Deserialization: cannot resolve circular reference');
  }
}

export class SerializationTypeError extends Error {
  constructor(msg?: string) {
    super(msg || 'Serialization/Deserialization: invalid data type');
  }
}

export class SerializeContext {
  /** @internal */
  private _objectPool: {object: unknown; data: ISerializedData}[];
  constructor() {
    this._objectPool = [];
  }
  get persistentObject(): ISerializedData[] {
    return this._objectPool.map((val) => val.data);
  }
  /** @internal */
  private _getSerializedObjectIndex(obj: unknown) {
    for (let i = 0; i < this._objectPool.length; i++) {
      if (this._objectPool[i].object === obj) {
        return i;
      }
    }
    return -1;
  }
  /** @internal */
  private _serializeObject(obj: unknown): ISerializedData {
    if (isArray(obj)) {
      return obj.map((val) => this.serializeObject(val));
    }
    if (isNumberObject(obj)) {
      return {type: 'number', value: obj.valueOf()};
    }
    if (isStringObject(obj)) {
      return {type: 'string', value: obj.valueOf()};
    }
    if (isBooleanObject(obj)) {
      return {type: 'boolean', value: obj.valueOf()};
    }
    if (isMap(obj)) {
      const result: ISerializedMapObject = {type: 'map', value: []};
      for (const kv of obj.entries()) {
        const key = this.serializeObject(kv[0]);
        const val = this.serializeObject(kv[1]);
        result.value.push([key, val]);
      }
      return result;
    }
    if (isSet(obj)) {
      const result: ISerializedSetObject = {type: 'set', value: []};
      for (const v of obj.values()) {
        result.value.push(this.serializeObject(v));
      }
      return result;
    }
    if (isRegExp(obj)) {
      return {type: 'regexp', value: obj.valueOf() as string};
    }
    if (isDate(obj)) {
      return {type: 'date', value: obj.valueOf()};
    }
    if (isObject(obj)) {
      // const data: ISerializedPlainObject|ISerializedUserObject = { type:'object', value:{} };
      if (
        obj.constructor === undefined ||
        obj.constructor ===
          (function () {
            return {};
          })().constructor
      ) {
        // plain object
        const data: ISerializedPlainObject = {type: 'object', value: {}};
        for (const prop in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, prop)) {
            data.value[prop] = this.serializeObject(obj[prop]);
          }
        }
        return data;
      } else {
        let info = (obj.constructor as SerializableClass).__serializationInfo;
        if (info) {
          const data: ISerializedUserObject = {
            type: 'object',
            value: {},
            classname: info.name,
          };
          while (info) {
            const proplist = info.properties;
            for (const prop in proplist) {
              if (proplist[prop].options.serialize) {
                data.value[prop] = proplist[prop].options.serialize(obj, obj[prop], this);
              } else {
                data.value[prop] = this.serializeObject(obj[prop]);
              }
            }
            info = info.super;
          }
          return data;
        }
      }
    }
    throw new SerializationTypeError();
  }
  serializeObject(obj: unknown): ISerializedData {
    if (isPrimitiveData(obj)) {
      return obj;
    }
    let index = this._getSerializedObjectIndex(obj);
    if (index < 0) {
      index = this._objectPool.length;
      this._objectPool.push({object: obj, data: null});
      this._objectPool[index].data = this._serializeObject(obj);
    }
    return {type: 'refobj', value: index};
  }
  serialize(obj: unknown): IPersistentData {
    this._objectPool = [];
    const root = this.serializeObject(obj);
    const objects = this._objectPool.map((val) => val.data);
    return {objects, root};
  }
}

export class DeserializeContext {
  /** @internal */
  private _objectPool: {object: unknown; data: ISerializedData}[];
  /** @internal */
  private _deserializingObjects: Set<unknown>;
  constructor() {
    this._objectPool = [];
    this._deserializingObjects = null;
  }
  /** @internal */
  private _beginDeserializingObject(obj: unknown) {
    assert(obj && !this._isDeserializing(obj));
    this._deserializingObjects.add(obj);
  }
  /** @internal */
  private _isDeserializing(obj: unknown) {
    return this._deserializingObjects.has(obj);
  }
  /** @internal */
  private _endDeserializingObject(obj: unknown) {
    assert(this._isDeserializing(obj));
    this._deserializingObjects.delete(obj);
  }
  /** @internal */
  private _checkComplete(data: ISerializedData): boolean {
    if (isRefData(data)) {
      const entry = this._objectPool[data.value];
      if (!entry.object || this._isDeserializing(entry.object)) {
        return false;
      }
    } else if (isArrayData(data)) {
      for (const val of data) {
        if (!this._checkComplete(val)) {
          return false;
        }
      }
    } else if (isMapData(data)) {
      for (const kv of data.value) {
        if (!this._checkComplete(kv[0]) || !this._checkComplete(kv[1])) {
          return false;
        }
      }
    } else if (isSetData(data)) {
      for (const v of data.value) {
        if (!this._checkComplete(v)) {
          return false;
        }
      }
    } else if (isPlainObjectData(data) || isUserObjectData(data)) {
      for (const f in data.value) {
        if (!this._checkComplete(data.value[f])) {
          return false;
        }
      }
    }
    return true;
  }
  /** @internal */
  private _deserializeObject(factory: SerializationFactory, index: number): unknown {
    const entry = this._objectPool[index];
    const data = entry.data;
    assert(!entry.object);
    if (isArrayData(data)) {
      const arr = (entry.object = []);
      this._beginDeserializingObject(arr);
      for (const val of data) {
        arr.push(this.deserializeObject(factory, val, false));
      }
      this._endDeserializingObject(arr);
    } else if (isMapData(data)) {
      const map = (entry.object = new Map());
      this._beginDeserializingObject(map);
      for (const kv of data.value) {
        const key = this.deserializeObject(factory, kv[0], false);
        const val = this.deserializeObject(factory, kv[1], false);
        map.set(key, val);
      }
      this._endDeserializingObject(map);
    } else if (isSetData(data)) {
      const set = (entry.object = new Set());
      this._beginDeserializingObject(set);
      for (const v of data.value) {
        set.add(this.deserializeObject(factory, v, false));
      }
      this._endDeserializingObject(set);
    } else if (isRegExpData(data)) {
      entry.object = new RegExp(data.value);
    } else if (isDateData(data)) {
      entry.object = new Date(data.value);
    } else if (isNumberData(data)) {
      entry.object = new Number(data.value);
    } else if (isBooleanData(data)) {
      entry.object = new Boolean(data.value);
    } else if (isStringData(data)) {
      entry.object = new String(data.value);
    } else if (isPlainObjectData(data)) {
      entry.object = {};
      this._beginDeserializingObject(entry.object);
      for (const f in data.value) {
        entry.object[f] = this.deserializeObject(factory, data.value[f], false);
      }
      this._endDeserializingObject(entry.object);
    } else if (isUserObjectData(data)) {
      const cls = factory[data.classname];
      entry.object = new cls();
      this._beginDeserializingObject(entry.object);
      cls.__serializationInfo.deserialize(entry.object, data, this);
      this._endDeserializingObject(entry.object);
    }
    if (!entry.object) {
      throw new SerializationTypeError();
    } else {
      return entry.object;
    }
  }
  deserializeObject(factory: SerializationFactory, data: ISerializedData, complete: boolean) {
    if (isPrimitiveData(data)) {
      return data;
    }
    if (!isRefData(data)) {
      throw new SerializationInternalError();
    }
    const index: number = data.value;
    if (index >= 0 && index < this._objectPool.length) {
      if (!this._objectPool[index].object) {
        this._objectPool[index].object = this._deserializeObject(factory, index);
      }
      if (complete && !this._checkComplete(this._objectPool[index].data)) {
        throw new SerializationUnresolvedError();
      }
      return this._objectPool[index].object;
    }
    return null;
  }
  deserialize(factory: SerializationFactory, data: IPersistentData): unknown {
    this._objectPool = data.objects.map((val) => {
      return {object: null, data: val};
    });
    this._deserializingObjects = new Set();
    return this.deserializeObject(factory, data.root, true);
  }
}

interface IPersistent {
  deserialize?: (container: unknown, data: ISerializedData, context: DeserializeContext) => void;
  serialize?: (container: unknown, obj: unknown, context: SerializeContext) => ISerializedData;
}

interface ISerailizable {
  pre?: (obj: unknown, data: unknown) => void;
  post?: (obj: unknown, data: unknown) => void;
}

interface ISerializeInfo {
  properties: {[name: string]: {options: IPersistent}};
  name: string;
  super: ISerializeInfo;
  options?: ISerailizable;
  deserialize: (obj: unknown, data: ISerializedUserObject, context: DeserializeContext) => void;
}

export function persistent(options?: IPersistent) {
  return function (target: InstanceType<SerializableClass>, propertyKey: string) {
    if (!Object.prototype.hasOwnProperty.call(target.constructor, '__serializable_properties')) {
      (target.constructor as any).__serializable_properties = {};
    }
    (target.constructor as any).__serializable_properties[propertyKey] = {
      options: options || {},
    };
  };
}

export function serializable(factory: SerializationFactory, options?: ISerailizable) {
  return function serializableDecorator<T extends GenConstructor<any> >(ctor: T) {
    let postfix = 1;
    let name = `${ctor.name}-${postfix++}`;
    while (factory[name]) {
      name = `${ctor.name}-${postfix++}`;
    }
    const properties = (ctor as any).__serializable_properties || {};
    delete (ctor as any).__serializable_properties;
    factory[name] = class extends ctor {
      static __serializationInfo: ISerializeInfo = {
        properties: properties,
        name: name,
        super: superClassOf(ctor).__serializationInfo,
        options: options,
        deserialize: function (
          obj: unknown,
          data: ISerializedUserObject,
          context: DeserializeContext,
        ) {
          if (this.super) {
            this.super.deserialize(obj, data, context);
          }
          this.options && this.options.pre && this.options.pre(obj, data);
          const proplist = this.properties;
          for (const prop in proplist) {
            if (proplist[prop].options.deserialize) {
              proplist[prop].options.deserialize(obj, data.value[prop], context);
            } else {
              obj[prop] = context.deserializeObject(factory, data.value[prop], false);
            }
          }
          this.options && this.options.post && this.options.post(obj, data);
        },
      };
    };
    return factory[name];
  };
}
