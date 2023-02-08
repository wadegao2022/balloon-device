/* eslint-disable @typescript-eslint/no-explicit-any */

import { DeviceType, Device } from '../device';
import { ShaderType } from '../base_types';
import {
  MAX_BINDING_GROUPS,
  GPUProgram,
  BindGroupLayout,
  BindGroupLayoutEntry,
  getVertexAttribByName,
  VertexAttribName,
} from '../gpuobject';
import { PBReflection, PBReflectionTagGetter } from './reflection';
import * as AST from './ast';
import * as errors from './errors';
import { PBAddressSpace, PBArrayTypeInfo, PBFunctionTypeInfo, PBPointerTypeInfo, PBPrimitiveType, PBPrimitiveTypeInfo, PBSamplerAccessMode, PBStructLayout, PBStructTypeInfo, PBTextureTypeInfo, PBTypeInfo, typeBool, typeF32, typeFrexpResult, typeFrexpResultVec2, typeFrexpResultVec3, typeFrexpResultVec4, typeI32, typeTex2D, typeTexCube, typeU32, typeVoid } from './types';

const COMPUTE_UNIFORM_NAME = 'ch_compute_block';
const VERTEX_UNIFORM_NAME = 'ch_vertex_block';
const FRAGMENT_UNIFORM_NAME = 'ch_fragment_block';
const SHARED_UNIFORM_NAME = 'ch_shared_block';
interface UniformInfo {
  group: number;
  binding: number;
  mask: number;
  block?: {
    name: string;
    dynamicOffset: boolean;
    exp: PBShaderExp;
  };
  texture?: {
    autoBindSampler: 'sample' | 'comparison';
    exp: PBShaderExp;
  }
  sampler?: PBShaderExp;
}

let currentProgramBuilder: ProgramBuilder = null;

export type ExpValueNonArrayType = number | boolean | PBShaderExp;
export type ExpValueType = ExpValueNonArrayType | Array<ExpValueType>;
export type ShaderTypeFunc = {
  (...args: any[]): PBShaderExp;
  ptr: ShaderTypeFunc;
  [dim: number]: ShaderTypeFunc;
};

const input_prefix = 'ch_input_';
const output_prefix = 'ch_output_';
const constructorCache: Map<ShaderTypeFunc, Record<string | symbol, ShaderTypeFunc>> = new Map();

/** @internal */
export function makeConstructor(typeFunc: ShaderTypeFunc, elementType: PBTypeInfo): ShaderTypeFunc {
  const wrappedTypeFunc = new Proxy(typeFunc, {
    get: function (target, prop) {
      if (typeof prop === 'symbol' || prop in target) {
        return target[prop];
      }
      let entries = constructorCache.get(typeFunc);
      if (!entries) {
        entries = {};
        constructorCache.set(typeFunc, entries);
      }
      let ctor = entries[prop];
      if (!ctor) {
        if (elementType.isPrimitiveType() || elementType.isStructType() || elementType.isArrayType()) {
          if (prop === 'ptr') {
            const pointerType = new PBPointerTypeInfo(elementType, PBAddressSpace.FUNCTION);
            ctor = function pointerCtor(this: ProgramBuilder, ...args: any[]) {
              if (args.length === 1 && typeof args[0] === 'string') {
                return new PBShaderExp(args[0], pointerType);
              } else {
                throw new Error(`Invalid pointer type constructor`);
              }
            } as ShaderTypeFunc;
          } else {
            const dim = Number(prop);
            if (Number.isInteger(dim) && dim >= 0) {
              const arrayType = new PBArrayTypeInfo(elementType, dim);
              const arrayTypeFunc = function arrayCtor(this: ProgramBuilder, ...args: any[]) {
                if (args.length === 1 && typeof args[0] === 'string') {
                  return new PBShaderExp(args[0], arrayType);
                } else {
                  const exp = new PBShaderExp('', arrayType);
                  exp.$ast = new AST.ASTShaderExpConstructor(exp.$typeinfo, args.map(arg => arg instanceof PBShaderExp ? arg.$ast : arg));
                  return exp;
                }
              }
              ctor = makeConstructor(arrayTypeFunc as ShaderTypeFunc, arrayType);
            }
          }
        }
      }
      if (ctor) {
        entries[prop] = ctor;
      }
      return ctor;
    },
  });
  return wrappedTypeFunc;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ProgramBuilder {
  export type VertexAttribSet = { [attrib: number]: PBShaderExp };
  export type VaryingSet = { [name: string]: PBShaderExp };
  export type ColorOutputs = PBShaderExp[];
  export type BuildRenderResult = [string, string, BindGroupLayout[], number[]];
  export type BuildComputeResult = [string, BindGroupLayout[]];
  export type RenderOptions = {
    label?: string,
    vertex: (this: PBGlobalScope) => void,
    fragment: (this: PBGlobalScope) => void
  };
  export type ComputeOptions = {
    label?: string,
    workgroupSize: [number, number, number],
    compute: (this: PBGlobalScope) => void,
  };
  export interface ShaderExpTagRecord {
    [name: string]: ShaderExpTagValue;
  }
  export type ShaderExpTagValue = string[] | string | ShaderExpTagRecord;
}

type StructDef = {
  structs: { [name: string]: ShaderTypeFunc };
  types: AST.ASTStructDefine[];
};

export class ProgramBuilder {
  /** @internal */
  _device: Device;
  /** @internal */
  _workgroupSize: [number, number, number];
  /** @internal */
  _scopeStack: PBScope[] = [];
  /** @internal */
  _shaderType: ShaderType = ShaderType.Vertex | ShaderType.Fragment | ShaderType.Compute;
  /** @internal */
  _deviceType: DeviceType;
  /** @internal */
  _structInfo: { [type: number]: StructDef };
  /** @internal */
  _uniforms: UniformInfo[];
  /** @internal */
  _globalScope: PBGlobalScope;
  /** @internal */
  _builtinScope: PBBuiltinScope;
  /** @internal */
  _inputScope: PBInputScope;
  /** @internal */
  _outputScope: PBOutputScope;
  /** @internal */
  _inputs: [string, AST.ASTDeclareVar][];
  /** @internal */
  _outputs: [string, AST.ASTDeclareVar][];
  /** @internal */
  _vertexAttributes: number[];
  /** @internal */
  _depthRangeCorrection: boolean;
  /** @internal */
  _emulateDepthClamp: boolean;
  /** @internal */
  _lastError: string;
  /** @internal */
  _reflection: PBReflection;
  /** @internal */
  _autoStructureTypeIndex: number;
  /** @internal */
  _nameMap: { [name: string]: string }[];
  constructor(device: Device | DeviceType) {
    this._device = typeof device === 'string' ? null : device;
    this._deviceType = typeof device === 'string' ? device : device.getDeviceType();
    this._workgroupSize = null;
    this._structInfo = {};
    this._uniforms = [];
    this._scopeStack = [];
    this._globalScope = null;
    this._builtinScope = null;
    this._inputScope = null;
    this._outputScope = null;
    this._inputs = [];
    this._outputs = [];
    this._vertexAttributes = [];
    this._depthRangeCorrection = this._deviceType === 'webgpu';
    this._emulateDepthClamp = false;
    this._lastError = null;
    this._reflection = new PBReflection(this);
    this._autoStructureTypeIndex = 0;
    this._nameMap = [];
  }
  get lastError(): string {
    return this._lastError;
  }
  get shaderType(): ShaderType {
    return this._shaderType;
  }
  get globalScope(): PBGlobalScope {
    return this._globalScope;
  }
  get builtinScope(): PBBuiltinScope {
    return this._builtinScope;
  }
  get inputScope(): PBInputScope {
    return this._inputScope;
  }
  get outputScope(): PBOutputScope {
    return this._outputScope;
  }
  get depthRangeCorrection(): boolean {
    return this._depthRangeCorrection;
  }
  set depthRangeCorrection(val: boolean) {
    this._depthRangeCorrection = !!val;
  }
  get emulateDepthClamp(): boolean {
    return this._emulateDepthClamp;
  }
  set emulateDepthClamp(val: boolean) {
    if (val && !this.device?.getShaderCaps().supportFragmentDepth) {
      console.error('can not enable depth clamp emulation');
    } else {
      this._emulateDepthClamp = !!val;
    }
  }
  get reflection(): PBReflection {
    return this._reflection;
  }
  get device(): Device {
    return this._device;
  }
  reset(): void {
    this._workgroupSize = null;
    this._structInfo = {};
    this._uniforms = [];
    this._scopeStack = [];
    this._globalScope = null;
    this._builtinScope = null;
    this._inputScope = null;
    this._outputScope = null;
    this._inputs = [];
    this._outputs = [];
    this._vertexAttributes = [];
    this._depthRangeCorrection = this._deviceType === 'webgpu';
    this._reflection = new PBReflection(this);
    this._autoStructureTypeIndex = 0;
    this._nameMap = [];
  }
  queryGlobal(name: string): PBShaderExp {
    return this.reflection.tag(name);
  }
  isVertexShader(): boolean {
    return this._shaderType === ShaderType.Vertex;
  }
  isFragmentShader(): boolean {
    return this._shaderType === ShaderType.Fragment;
  }
  isComputeShader(): boolean {
    return this._shaderType === ShaderType.Compute;
  }
  pushScope(scope: PBScope) {
    this._scopeStack.unshift(scope);
  }
  popScope(): PBScope {
    return this._scopeStack.shift();
  }
  currentScope(): PBScope {
    return this._scopeStack[0];
  }
  buildRender(options: ProgramBuilder.RenderOptions): ProgramBuilder.BuildRenderResult {
    currentProgramBuilder = this;
    this._lastError = null;
    this.defineInternalStructs();
    const ret = this.buildRenderSource(options);
    currentProgramBuilder = null;
    this.reset();
    return ret;
  }
  buildCompute(options: ProgramBuilder.ComputeOptions): ProgramBuilder.BuildComputeResult {
    currentProgramBuilder = this;
    this._lastError = null;
    this._workgroupSize = options.workgroupSize;
    this.defineInternalStructs();
    const ret = this.buildComputeSource(options);
    currentProgramBuilder = null;
    this.reset();
    return ret;
  }
  buildRenderProgram(options: ProgramBuilder.RenderOptions): GPUProgram {
    const ret = this.buildRender(options);
    return ret ? this._device.createGPUProgram({
      type: 'render',
      label: options.label,
      params: {
        vs: ret[0],
        fs: ret[1],
        bindGroupLayouts: ret[2],
        vertexAttributes: ret[3]
      }
    }) : null;
  }
  buildComputeProgram(options: ProgramBuilder.ComputeOptions): GPUProgram {
    const ret = this.buildCompute(options);
    return ret ? this._device.createGPUProgram({
      type: 'compute',
      params: {
        source: ret[0],
        bindGroupLayouts: ret[1],
      },
    }) : null;
  }
  getDeviceType() {
    return this._deviceType;
  }
  addressOf(ref: PBShaderExp): PBShaderExp {
    if (this.getDeviceType() !== 'webgpu') {
      throw new errors.PBDeviceNotSupport('pointer shader type');
    }
    if (!ref.$ast.isReference()) {
      throw new errors.PBReferenceValueRequired(ref);
    }
    const exp = new PBShaderExp('', ref.$ast.getType());
    exp.$ast = new AST.ASTAddressOf(ref.$ast);
    return exp;
  }
  referenceOf(ptr: PBShaderExp): PBShaderExp {
    if (this.getDeviceType() !== 'webgpu') {
      throw new errors.PBDeviceNotSupport('pointer shader type');
    }
    if (!ptr.$ast.getType().isPointerType()) {
      throw new errors.PBPointerValueRequired(ptr);
    }
    const ast = new AST.ASTReferenceOf(ptr.$ast);
    const exp = new PBShaderExp('', ast.getType());
    exp.$ast = ast;
    return exp;
  }
  struct(structName: string, instanceName: string): PBShaderExp {
    let ctor: ShaderTypeFunc = null;
    for (const st of [ShaderType.Vertex, ShaderType.Fragment, ShaderType.Compute]) {
      if (st & this._shaderType) {
        const structInfo = this._structInfo[st];
        ctor = structInfo?.structs[structName];
        if (ctor) {
          break;
        }
      }
    }
    if (!ctor) {
      throw new errors.PBParamValueError('struct', 'structName', `Struct type ${structName} not exists`);
    }
    return ctor.call(this, instanceName);
  }
  /** @internal */
  isIdenticalStruct(a: PBStructTypeInfo, b: PBStructTypeInfo): boolean {
    if (a.structName && b.structName && a.structName !== b.structName) {
      return false;
    }
    if (a.structMembers.length !== b.structMembers.length) {
      return false;
    }
    for (let index = 0; index < a.structMembers.length; index++) {
      const val = a.structMembers[index];
      const other = b.structMembers[index];
      if (val.name !== other.name) {
        return false;
      }
      if (val.type.isStructType()) {
        if (!other.type.isStructType()) {
          return false;
        }
        if (!this.isIdenticalStruct(val.type, other.type)) {
          return false;
        }
      } else if (val.type.typeId !== other.type.typeId) {
        return false;
      }
    }
    return true;
  }
  /** @internal */
  generateStructureName(): string {
    return `ch_generated_struct_name${this._autoStructureTypeIndex++}`;
  }
  /** @internal */
  getVertexAttributes(): number[] {
    return this._vertexAttributes;
  }
  /** @internal */
  defineHiddenStruct(type: PBStructTypeInfo) {
    for (const shaderType of [ShaderType.Vertex, ShaderType.Fragment, ShaderType.Compute]) {
      let structInfo = this._structInfo[shaderType];
      if (!structInfo) {
        structInfo = { structs: {}, types: [] };
        this._structInfo[shaderType] = structInfo;
      }
      if (structInfo.structs[type.structName]) {
        throw new errors.PBParamValueError('defineStruct', 'structName', `cannot re-define struct '${type.structName}'`);
      }
      structInfo.types.push(new AST.ASTStructDefine(type, true));
    }
  }
  defineStruct(structName: string, layout: PBStructLayout, ...args: PBShaderExp[]): ShaderTypeFunc {
    layout = layout || 'default';
    const structType = new PBStructTypeInfo(structName || '', layout, args.map(arg => {
      if (!arg.$typeinfo.isPrimitiveType() && !arg.$typeinfo.isArrayType() && !arg.$typeinfo.isStructType()) {
        throw new Error(`invalid struct member type: '${arg.$str}'`);
      }
      return {
        name: arg.$str,
        type: arg.$typeinfo
      };
    }));
    for (const shaderType of [ShaderType.Vertex, ShaderType.Fragment, ShaderType.Compute]) {
      let structDef: AST.ASTStructDefine = null;
      let ctor: ShaderTypeFunc = null;
      const structInfo = this._structInfo[shaderType];
      if (structInfo) {
        if (currentProgramBuilder.shaderType === shaderType && structInfo.structs[structType.structName]) {
          throw new errors.PBParamValueError('defineStruct', 'structName', `cannot re-define struct '${structType.structName}'`);
        }
        for (const type of structInfo.types) {
          if (!type.builtin && this.isIdenticalStruct(type.getType(), structType)) {
            structDef = type;
            ctor = structInfo.structs[type.getType().structName];
            break;
          }
        }
      }
      if (structDef) {
        if (structDef.type.layout !== layout) {
          throw new Error(`Can not redefine struct ${structDef.type.structName} with different layout`);
        }
        if (shaderType !== currentProgramBuilder.shaderType) {
          if (!this._structInfo[currentProgramBuilder.shaderType]) {
            this._structInfo[currentProgramBuilder.shaderType] = { structs: {}, types: [] };
          }
          this._structInfo[currentProgramBuilder.shaderType].types.push(structDef);
          this._structInfo[currentProgramBuilder.shaderType].structs[structDef.getType().structName] = ctor;
        }
        return ctor;
      }
    }
    return this.internalDefineStruct(structName || this.generateStructureName(), layout, this._shaderType, false, ...args);
  }
  defineStructByType(structType: PBStructTypeInfo): ShaderTypeFunc {
    const typeCopy = structType.extends(structType.structName || this.generateStructureName(), []);
    for (const shaderType of [ShaderType.Vertex, ShaderType.Fragment, ShaderType.Compute]) {
      let structDef: AST.ASTStructDefine = null;
      let ctor: ShaderTypeFunc = null;
      const structInfo = this._structInfo[shaderType];
      if (structInfo) {
        if (currentProgramBuilder.shaderType === shaderType && structInfo.structs[typeCopy.structName]) {
          throw new errors.PBParamValueError('defineStruct', 'structName', `cannot re-define struct '${typeCopy.structName}'`);
        }
        for (const type of structInfo.types) {
          if (!type.builtin && this.isIdenticalStruct(type.getType(), typeCopy)) {
            structDef = type;
            ctor = structInfo.structs[type.getType().structName];
            break;
          }
        }
      }
      if (structDef) {
        if (structDef.type.layout !== typeCopy.layout) {
          throw new Error(`Can not redefine struct ${structDef.type.structName} with different layout`);
        }
        if (shaderType !== currentProgramBuilder.shaderType) {
          if (!this._structInfo[currentProgramBuilder.shaderType]) {
            this._structInfo[currentProgramBuilder.shaderType] = { structs: {}, types: [] };
          }
          this._structInfo[currentProgramBuilder.shaderType].types.push(structDef);
          this._structInfo[currentProgramBuilder.shaderType].structs[structDef.getType().structName] = ctor;
        }
        return ctor;
      }
    }
    return this.internalDefineStructByType(this._shaderType, false, typeCopy);
  }
  /** @internal */
  internalDefineStruct(structName: string, layout: PBStructLayout, shaderTypeMask: number, builtin: boolean, ...args: PBShaderExp[]): ShaderTypeFunc {
    const structType = new PBStructTypeInfo(structName, layout, args.map(arg => {
      if (!arg.$typeinfo.isPrimitiveType() && !arg.$typeinfo.isArrayType() && !arg.$typeinfo.isStructType()) {
        throw new Error(`invalid struct member type: '${arg.$str}'`);
      }
      return {
        name: arg.$str,
        type: arg.$typeinfo
      };
    }));
    return this.internalDefineStructByType(shaderTypeMask, builtin, structType);
  }
  /** @internal */
  internalDefineStructByType(shaderTypeMask: number, builtin: boolean, structType: PBStructTypeInfo): ShaderTypeFunc {
    const struct = makeConstructor(function structConstructor(...blockArgs: any[]) {
      let e: PBShaderExp;
      if (blockArgs.length === 1 && typeof blockArgs[0] === 'string') {
        e = new PBShaderExp(blockArgs[0], structType);
      } else {
        e = new PBShaderExp('', structType);
        e.$ast = new AST.ASTShaderExpConstructor(e.$typeinfo, blockArgs.map(arg => arg instanceof PBShaderExp ? arg.$ast : arg));
      }
      return e;
    } as ShaderTypeFunc, structType);
    for (const shaderType of [ShaderType.Vertex, ShaderType.Fragment, ShaderType.Compute]) {
      if (shaderTypeMask & shaderType) {
        let structInfo = this._structInfo[shaderType];
        if (!structInfo) {
          structInfo = { structs: {}, types: [] };
          this._structInfo[shaderType] = structInfo;
        }
        if (structInfo.structs[structType.structName]) {
          throw new errors.PBParamValueError('defineStruct', 'structName', `cannot re-define struct '${structType.structName}'`);
        }
        structInfo.types.push(new AST.ASTStructDefine(structType, builtin));
        structInfo.structs[structType.structName] = struct;
      }
    }
    // this.changeStructLayout(structType, layout);
    return struct;
  }
  /** @internal */
  getFunction(name: string): AST.ASTFunction {
    return this._globalScope ? this._globalScope.$getFunction(name) : null;
  }
  /** @internal */
  get structInfo(): StructDef {
    return this._structInfo[this._shaderType];
  }
  /** @internal */
  getBlockName(instanceName: string): string {
    return `ch_block_name_${instanceName}`;
  }
  /** @internal */
  defineBuiltinStruct(shaderType: ShaderType, inOrOut: 'in' | 'out'): [ShaderTypeFunc, PBShaderExp, string, PBShaderExp] {
    const structName = inOrOut === 'in' ? AST.getBuiltinInputStructName(shaderType) : AST.getBuiltinOutputStructName(shaderType);
    const instanceName = inOrOut === 'in' ? AST.getBuiltinInputStructInstanceName(shaderType) : AST.getBuiltinOutputStructInstanceName(shaderType);
    const stage = shaderType === ShaderType.Vertex
      ? 'vertex'
      : shaderType === ShaderType.Fragment
        ? 'fragment'
        : 'compute';
    const builtinVars = AST.builtinVariables['webgpu'];
    const args: { name: string, type: PBPrimitiveTypeInfo | PBArrayTypeInfo | PBStructTypeInfo }[] = [];
    const prefix: string[] = [];
    for (const k in builtinVars) {
      if (builtinVars[k].stage === stage && builtinVars[k].inOrOut === inOrOut) {
        args.push({ name: builtinVars[k].name, type: builtinVars[k].type });
        prefix.push(`@builtin(${builtinVars[k].semantic}) `);
      }
    }
    const inoutList = inOrOut === 'in' ? this._inputs : this._outputs;
    for (const k of inoutList) {
      // for debug only
      if (!(k[1] instanceof AST.ASTDeclareVar)) {
        throw new errors.PBInternalError('defineBuiltinStruct() failed: input/output is not declare var ast node');
      }
      const type = k[1].value.getType();
      if (!type.isPrimitiveType() && !type.isArrayType() && !type.isStructType()) {
        throw new Error(`invalid in/out variable type: '${k[1].value.name}'`);
      }
      args.push({ name: k[1].value.name, type: type });
      prefix.push(`@location(${k[1].value.value.$location}) `);
    }
    if (args.length > 0) {
      const st = this.findStructType(structName, shaderType);
      if (st) {
        st.getType().reset(structName, 'default', args);
        st.prefix = prefix;
        return null;
      } else {
        const structType = this.internalDefineStructByType(this._shaderType, false, new PBStructTypeInfo(structName, 'default', args));
        this.findStructType(structName, shaderType).prefix = prefix;
        const structInstance = this.struct(structName, instanceName);
        const structInstanceIN = inOrOut === 'in' ? this.struct(structName, 'ch_app_input') : structInstance;
        return [structType, structInstance, structName, structInstanceIN];
      }
    } else {
      return null;
    }
  }
  /** @internal */
  private defineInternalStructs() {
    this.defineHiddenStruct(typeFrexpResult);
    this.defineHiddenStruct(typeFrexpResultVec2);
    this.defineHiddenStruct(typeFrexpResultVec3);
    this.defineHiddenStruct(typeFrexpResultVec4);
  }
  /** @internal */
  private array(...args: ExpValueNonArrayType[]) {
    if (args.length === 0) {
      throw new errors.PBParamLengthError('array');
    }
    args = args.map(arg => this.normalizeExpValue(arg));
    let typeok = true;
    let type: PBTypeInfo = null;
    let isBool = true;
    let isFloat = true;
    let isInt = true;
    let isUint = true;
    let isComposite = false;
    for (const arg of args) {
      if (arg instanceof PBShaderExp) {
        const argType = arg.$ast.getType();
        if (!argType.isConstructible()) {
          typeok = false;
          break;
        }
        if (!type) {
          type = argType;
        } else if (argType.typeId !== type.typeId) {
          typeok = false;
        }
      }
    }
    if (typeok) {
      if (type && type.isPrimitiveType() && type.isScalarType()) {
        isBool = type.primitiveType === PBPrimitiveType.BOOL;
        isFloat = type.primitiveType === PBPrimitiveType.F32;
        isUint = type.primitiveType === PBPrimitiveType.U32;
        isInt = type.primitiveType === PBPrimitiveType.I32;
      } else if (type) {
        isBool = false;
        isFloat = false;
        isUint = false;
        isInt = false;
        isComposite = true;
      }
      for (const arg of args) {
        if (!(arg instanceof PBShaderExp) && isComposite) {
          typeok = false;
          break;
        }
        if (typeof arg === 'number') {
          isBool = false;
          if ((arg | 0) === arg) {
            if (arg < 0) {
              isUint = false;
              isInt = isInt && (arg >= (0x80000000 >> 0));
            } else {
              isUint = isUint && (arg <= 0xFFFFFFFF);
              isInt = isInt && (arg <= 0x7FFFFFFF);
            }
          }
        } else if (typeof arg === 'boolean') {
          isFloat = false;
          isInt = false;
          isUint = false;
        }
      }
    }
    if (typeok && !isComposite) {
      if (isBool) {
        type = typeBool;
      } else if (isInt) {
        type = typeI32;
      } else if (isUint) {
        type = typeU32;
      } else if (isFloat) {
        type = typeF32;
      }
      typeok = !!type;
    }
    if (!typeok) {
      throw new errors.PBParamTypeError('array');
    }
    if (!type.isPrimitiveType() && !type.isArrayType() && !type.isStructType()) {
      throw new errors.PBParamTypeError('array');
    }
    const arrayType = new PBArrayTypeInfo(type, args.length);
    const exp = new PBShaderExp('', arrayType);
    exp.$ast = new AST.ASTShaderExpConstructor(arrayType, args.map(arg => {
      if (arg instanceof PBShaderExp) {
        return arg.$ast;
      }
      if (!type.isPrimitiveType() || !type.isScalarType()) {
        throw new errors.PBTypeCastError(arg, typeof arg, type);
      }
      return new AST.ASTScalar(arg, type);
    }));
    return exp;
  }
  discard() {
    this.currentScope().$ast.statements.push(new AST.ASTDiscard());
  }
  /** @internal */
  tagShaderExp(getter: PBReflectionTagGetter, tagValue: ProgramBuilder.ShaderExpTagValue) {
    if (typeof tagValue === 'string') {
      this._reflection.tag(tagValue, getter);
    } else if (Array.isArray(tagValue)) {
      tagValue.forEach(tag => this.tagShaderExp(getter, tag));
    } else {
      for (const k of Object.keys(tagValue)) {
        this.tagShaderExp((scope: PBGlobalScope) => {
          const value = getter(scope);
          return value[k]
        }, tagValue[k]);
      }
    }
  }
  /** @internal */
  in(location: number, name: string, variable: PBShaderExp): void {
    if (this._inputs[location]) {
      throw new Error(`input location ${location} already declared`);
    }
    variable.$location = location;
    variable.$declareType = AST.DeclareType.DECLARE_TYPE_IN;
    variable.$inout = 'in';
    this._inputs[location] = [name, new AST.ASTDeclareVar(new AST.ASTPrimitive(variable))];
    Object.defineProperty(this._inputScope, name, {
      get: function (this: PBInputScope) {
        return variable;
      },
      set: function () {
        throw new Error(`cannot assign to readonly variable: ${name}`);
      }
    });
    variable.$tags.forEach(val => this.tagShaderExp(() => variable, val));
  }
  /** @internal */
  out(location: number, name: string, variable: PBShaderExp): void {
    if (this._outputs[location]) {
      throw new Error(`output location ${location} has already been used`);
    }
    variable.$location = location;
    variable.$declareType = AST.DeclareType.DECLARE_TYPE_OUT;
    variable.$inout = 'out';
    this._outputs[location] = [name, new AST.ASTDeclareVar(new AST.ASTPrimitive(variable))];
    Object.defineProperty(this._outputScope, name, {
      get: function (this: PBOutputScope) {
        return variable;
      },
      set: function (this: PBOutputScope, v) {
        currentProgramBuilder.currentScope().$ast.statements.push(new AST.ASTAssignment(new AST.ASTLValueScalar(variable.$ast), v instanceof PBShaderExp ? v.$ast : v));
      }
    });
  }
  /** @internal */
  getDefaultSampler(t: PBShaderExp, comparison: boolean): PBShaderExp {
    const u = this._uniforms.findIndex(val => val.texture?.exp === t);
    if (u < 0) {
      throw new Error('invalid texture uniform object');
    }
    const samplerType = comparison ? 'comparison' : 'sample';
    if (this._uniforms[u].texture.autoBindSampler && this._uniforms[u].texture.autoBindSampler !== samplerType) {
      throw new Error('multiple sampler not supported');
    }
    this._uniforms[u].texture.autoBindSampler = samplerType;
    if (this._deviceType === 'webgpu') {
      const samplerName = AST.genSamplerName(t.$str, comparison);
      if (!this.globalScope[samplerName]) {
        throw new Error(`failed to find sampler name ${samplerName}`);
      }
      return this.globalScope[samplerName];
    } else {
      return null;
    }
  }
  /** @internal */
  normalizeExpValue(value: ExpValueType): ExpValueNonArrayType {
    if (Array.isArray(value)) {
      const converted = value.map(val => Array.isArray(val) ? this.normalizeExpValue(val) : val);
      return this.array(...converted);
    } else {
      return value;
    }
  }
  /** @internal */
  guessExpValueType(value: ExpValueType): PBTypeInfo {
    const val = this.normalizeExpValue(value);
    if (typeof val === 'boolean') {
      return typeBool;
    } else if (typeof val === 'number') {
      if (!Number.isInteger(val)) {
        return typeF32;
      } else if (val >= (0x80000000 >> 1) && val <= 0x7FFFFFFF) {
        return typeI32;
      } else if (val >= 0 && val <= 0xFFFFFFFF) {
        return typeU32;
      } else {
        throw new errors.PBValueOutOfRange(val);
      }
    } else if (val instanceof PBShaderExp) {
      return val.$ast?.getType() || val.$typeinfo;
    }
  }
  /** @internal */
  findStructType(name: string, shaderType: number): AST.ASTStructDefine {
    for (const st of [ShaderType.Vertex, ShaderType.Fragment, ShaderType.Compute]) {
      if (st & shaderType) {
        const structInfo = this._structInfo[st];
        if (structInfo) {
          for (const t of structInfo.types) {
            if (t.type.structName === name) {
              return t;
            }
          }
        }
      }
    }
    return null;
  }
  /** @internal */
  findStructConstructor(name: string, shaderType: number): ShaderTypeFunc {
    for (const st of [ShaderType.Vertex, ShaderType.Fragment, ShaderType.Compute]) {
      if (st & shaderType) {
        const structInfo = this._structInfo[st];
        if (structInfo && structInfo.structs?.[name]) {
          return structInfo.structs[name];
        }
      }
    }
    return null;
  }
  /** @internal */
  private buildComputeSource(options: ProgramBuilder.ComputeOptions): ProgramBuilder.BuildComputeResult {
    try {
      this._lastError = null;
      this._shaderType = ShaderType.Compute
      this._scopeStack = [];
      this._globalScope = new PBGlobalScope();
      this._builtinScope = new PBBuiltinScope();
      this._inputs = [];
      this._outputs = [];
      this._inputScope = new PBInputScope();
      this._outputScope = new PBOutputScope();
      this._reflection.clear();
      this.generate(options.compute);
      // this.removeUnusedSamplerBindings(this._globalScope);
      this.mergeUniformsCompute(this._globalScope);
      this.updateUniformBindings([this._globalScope], [ShaderType.Compute]);
      return [
        this.generateComputeSource(this._globalScope, this._builtinScope),
        this.createBindGroupLayouts(options.label),
      ];
    } catch (err) {
      if (err instanceof errors.PBError) {
        this._lastError = err.getMessage(this.getDeviceType());
        console.error(this._lastError);
        return null;
      } else if (err instanceof Error) {
        this._lastError = err.toString();
        console.error(this._lastError);
        return null;
      } else {
        this._lastError = Object.prototype.toString.call(err);
        console.log(`Error: ${this._lastError}`);
        return null;
      }
    }
  }
  /** @internal */
  private buildRenderSource(options: ProgramBuilder.RenderOptions): ProgramBuilder.BuildRenderResult {
    try {
      this._lastError = null;

      this._shaderType = ShaderType.Vertex;
      this._scopeStack = [];
      this._globalScope = new PBGlobalScope();
      this._builtinScope = new PBBuiltinScope();
      this._inputs = [];
      this._outputs = [];
      this._inputScope = new PBInputScope();
      this._outputScope = new PBOutputScope();
      this._reflection.clear();
      this.generate(options.vertex);
      const vertexScope = this._globalScope;
      const vertexBuiltinScope = this._builtinScope;
      const vertexInputs = this._inputs;
      const vertexOutputs = this._outputs;
      if (this._deviceType === 'webgpu') {
        // this.removeUnusedSamplerBindings(vertexScope);
      }

      this._shaderType = ShaderType.Fragment;
      this._scopeStack = [];
      this._globalScope = new PBGlobalScope();
      this._builtinScope = new PBBuiltinScope();
      this._inputs = [];
      this._outputs = [];
      this._inputScope = new PBInputScope();
      this._outputScope = new PBOutputScope();
      this._reflection.clear();
      vertexOutputs.forEach((val, index) => {
        this.in(index, val[0], new PBShaderExp(val[1].value.name, val[1].value.getType()).tag(...val[1].value.value.$tags));
      });
      this.generate(options.fragment);
      const fragScope = this._globalScope;
      const fragBuiltinScope = this._builtinScope;
      const fragInputs = this._inputs;
      const fragOutputs = this._outputs;
      if (this._deviceType === 'webgpu') {
        // this.removeUnusedSamplerBindings(fragScope);
      }

      this.mergeUniforms(vertexScope, fragScope);
      this.updateUniformBindings([vertexScope, fragScope], [ShaderType.Vertex, ShaderType.Fragment]);

      return [
        this.generateRenderSource(ShaderType.Vertex, vertexScope, vertexBuiltinScope, vertexInputs.map(val => val[1]), vertexOutputs.map(val => val[1])),
        this.generateRenderSource(ShaderType.Fragment, fragScope, fragBuiltinScope, fragInputs.map(val => val[1]), fragOutputs.map(val => val[1])),
        this.createBindGroupLayouts(options.label),
        this._vertexAttributes,
      ];
    } catch (err) {
      if (err instanceof errors.PBError) {
        this._lastError = err.getMessage(this.getDeviceType());
        console.error(this._lastError);
        return null;
      } else if (err instanceof Error) {
        this._lastError = err.toString();
        console.error(this._lastError);
        return null;
      } else {
        this._lastError = Object.prototype.toString.call(err);
        console.log(`Error: ${this._lastError}`);
        return null;
      }
    }
  }
  /** @internal */
  private generate(
    body?: (this: PBGlobalScope) => void,
  ): void {
    this.pushScope(this._globalScope);
    if (this._emulateDepthClamp && this._shaderType === ShaderType.Vertex) {
      this._globalScope.$outputs.clamppedDepth = this.float().tag('CLAMPPED_DEPTH');
    }
    body && body.call(this._globalScope);
    this.popScope();
  }
  /** @internal */
  private generateRenderSource(shaderType: ShaderType, scope: PBGlobalScope, builtinScope: PBBuiltinScope, inputs: AST.ShaderAST[], outputs: AST.ShaderAST[]) {
    const context = {
      type: shaderType,
      mrt: shaderType === ShaderType.Fragment && outputs.length > 1,
      defines: [],
      extensions: new Set<string>(),
      builtins: [...builtinScope.$_usedBuiltins],
      types: this._structInfo[shaderType]?.types || [],
      typeReplacement: new Map(),
      inputs: inputs,
      outputs: outputs,
      global: scope,
      vertexAttributes: this._vertexAttributes,
      workgroupSize: null,
    };
    switch (this._deviceType) {
      case 'webgl':
        for (const u of this._uniforms) {
          if (u.texture) {
            const type = u.texture.exp.$ast.getType();
            if (type.isTextureType() && type.isDepthTexture()) {
              if (u.texture.autoBindSampler === 'comparison') {
                throw new errors.PBDeviceNotSupport('depth texture comparison');
              }
              if (u.texture.autoBindSampler === 'sample') {
                if (type.is2DTexture()) {
                  context.typeReplacement.set(u.texture.exp, typeTex2D);
                } else if (type.isCubeTexture()) {
                  context.typeReplacement.set(u.texture.exp, typeTexCube);
                }
              }
            }
          }
        }
        return scope.$ast.toWebGL('', context);
      case 'webgl2':
        for (const u of this._uniforms) {
          if (u.texture) {
            const type = u.texture.exp.$ast.getType();
            if (type.isTextureType() && type.isDepthTexture() && u.texture.autoBindSampler === 'sample') {
              if (type.is2DTexture()) {
                context.typeReplacement.set(u.texture.exp, typeTex2D);
              } else if (type.isCubeTexture()) {
                context.typeReplacement.set(u.texture.exp, typeTexCube);
              }
            }
          }
        }
        return scope.$ast.toWebGL2('', context);
      case 'webgpu':
        return scope.$ast.toWGSL('', context);
      default:
        return null;
    }
  }
  /** @internal */
  private generateComputeSource(scope: PBGlobalScope, builtinScope: PBBuiltinScope) {
    const context = {
      type: ShaderType.Compute,
      mrt: false,
      defines: [],
      extensions: new Set<string>(),
      builtins: [...builtinScope.$_usedBuiltins],
      types: this._structInfo[ShaderType.Compute]?.types || [],
      typeReplacement: null,
      inputs: [],
      outputs: [],
      global: scope,
      vertexAttributes: [],
      workgroupSize: this._workgroupSize,
    };
    return scope.$ast.toWGSL('', context);
  }
  /** @internal */
  private mergeUniformsCompute(globalScope: PBGlobalScope) {
    const uniformList: { members: PBShaderExp[], uniforms: number[] }[] = [];
    for (let i = 0; i < this._uniforms.length; i++) {
      const u = this._uniforms[i];
      if (u.block && u.block.exp.$declareType === AST.DeclareType.DECLARE_TYPE_UNIFORM) {
        const type = u.block.exp.$ast.getType();
        if (type.isStructType() && type.detail.layout === 'std140') {
          continue;
        }
        if (!uniformList[u.group]) {
          uniformList[u.group] = { members: [], uniforms: [] };
        }
        uniformList[u.group].members.push(new PBShaderExp(u.block.exp.$str, u.block.exp.$ast.getType()));
        uniformList[u.group].uniforms.push(i);
      }
    }
    const uniformLists = [uniformList];
    const nameList = [COMPUTE_UNIFORM_NAME];
    const maskList = [ShaderType.Compute];
    for (let i = 0; i < 1; i++) {
      for (const k in uniformLists[i]) {
        if (uniformLists[i][k]?.members.length > 0) {
          const uname = `${nameList[i]}_${k}`;
          const t = currentProgramBuilder.internalDefineStruct(this.generateStructureName(), 'std140', maskList[i], false, ...uniformLists[i][k].members);
          globalScope[uname] = t().uniform(Number(k));
          const index = this._uniforms.findIndex(val => val.block?.name === uname);
          this._uniforms[index].mask = maskList[i];
          let nameMap = this._nameMap[Number(k)];
          if (!nameMap) {
            nameMap = {};
            this._nameMap[Number(k)] = nameMap;
          }
          for (let j = uniformLists[i][k].uniforms.length - 1; j >= 0; j--) {
            const u = uniformLists[i][k].uniforms[j];
            const exp = this._uniforms[u].block.exp;
            nameMap[exp.$str] = uname;
            exp.$str = `${uname}.${exp.$str}`;
          }
        }
      }
    }
    this._uniforms = this._uniforms.filter(val => {
      if (!val.block || val.block.exp.$declareType !== AST.DeclareType.DECLARE_TYPE_UNIFORM) {
        return true;
      }
      const type = val.block.exp.$ast.getType();
      return type.isTextureType() || type.isSamplerType() || (type.isStructType() && type.detail.layout === 'std140');
    });
  }
  /** @internal */
  private mergeUniforms(globalScopeVertex: PBGlobalScope, globalScopeFragmet: PBGlobalScope) {
    const vertexUniformList: { members: PBShaderExp[], uniforms: number[] }[] = [];
    const fragUniformList: { members: PBShaderExp[], uniforms: number[] }[] = [];
    const sharedUniformList: { members: PBShaderExp[], uniforms: number[] }[] = [];
    for (let i = 0; i < this._uniforms.length; i++) {
      const u = this._uniforms[i];
      if (u.block && u.block.exp.$declareType === AST.DeclareType.DECLARE_TYPE_UNIFORM) {
        const type = u.block.exp.$ast.getType();
        if (type.isStructType() && type.detail.layout === 'std140') {
          continue;
        }
        const v = !!(u.mask & ShaderType.Vertex);
        const f = !!(u.mask & ShaderType.Fragment);
        if (v && f) {
          if (!sharedUniformList[u.group]) {
            sharedUniformList[u.group] = { members: [], uniforms: [] };
          }
          sharedUniformList[u.group].members.push(new PBShaderExp(u.block.exp.$str, u.block.exp.$ast.getType()));
          sharedUniformList[u.group].uniforms.push(i);
        } else if (v) {
          if (!vertexUniformList[u.group]) {
            vertexUniformList[u.group] = { members: [], uniforms: [] };
          }
          vertexUniformList[u.group].members.push(new PBShaderExp(u.block.exp.$str, u.block.exp.$ast.getType()));
          vertexUniformList[u.group].uniforms.push(i);
        } else if (f) {
          if (!fragUniformList[u.group]) {
            fragUniformList[u.group] = { members: [], uniforms: [] };
          }
          fragUniformList[u.group].members.push(new PBShaderExp(u.block.exp.$str, u.block.exp.$ast.getType()));
          fragUniformList[u.group].uniforms.push(i);
        }
      }
    }
    const uniformLists = [vertexUniformList, fragUniformList, sharedUniformList];
    const nameList = [VERTEX_UNIFORM_NAME, FRAGMENT_UNIFORM_NAME, SHARED_UNIFORM_NAME];
    const maskList = [ShaderType.Vertex, ShaderType.Fragment, ShaderType.Vertex | ShaderType.Fragment];
    for (let i = 0; i < 3; i++) {
      for (const k in uniformLists[i]) {
        if (uniformLists[i][k]?.members.length > 0) {
          const uname = `${nameList[i]}_${k}`;
          const structName = this.generateStructureName();
          const t = currentProgramBuilder.internalDefineStruct(structName, 'std140', maskList[i], false, ...uniformLists[i][k].members);
          if (maskList[i] & ShaderType.Vertex) {
            globalScopeVertex[uname] = t().uniform(Number(k));
          }
          if (maskList[i] & ShaderType.Fragment) {
            globalScopeFragmet[uname] = t().uniform(Number(k));
          }
          const index = this._uniforms.findIndex(val => val.block?.name === uname);
          this._uniforms[index].mask = maskList[i];
          let nameMap = this._nameMap[Number(k)];
          if (!nameMap) {
            nameMap = {};
            this._nameMap[Number(k)] = nameMap;
          }
          for (let j = uniformLists[i][k].uniforms.length - 1; j >= 0; j--) {
            const u = uniformLists[i][k].uniforms[j];
            const exp = this._uniforms[u].block.exp;
            nameMap[exp.$str] = uname;
            exp.$str = `${uname}.${exp.$str}`;
          }
        }
      }
    }
    this._uniforms = this._uniforms.filter(val => {
      if (!val.block || val.block.exp.$declareType !== AST.DeclareType.DECLARE_TYPE_UNIFORM) {
        return true;
      }
      const type = val.block.exp.$ast.getType();
      return type.isTextureType() || type.isSamplerType() || (type.isStructType() && type.detail.layout === 'std140');
    });
  }
  /** @internal */
  private updateUniformBindings(scopes: PBGlobalScope[], shaderTypes: ShaderType[]) {
    this._uniforms = this._uniforms.filter(val => !!val.mask);
    const bindings: number[] = Array.from<number>({ length: MAX_BINDING_GROUPS }).fill(0);
    for (const u of this._uniforms) {
      u.binding = bindings[u.group]++;
    }
    for (let i = 0; i < scopes.length; i++) {
      const scope = scopes[i];
      const type = shaderTypes[i];
      for (const u of this._uniforms) {
        if (u.mask & type) {
          const uniforms = (scope.$ast as AST.ASTGlobalScope).uniforms;
          const name = u.block ? u.block.name : u.texture ? u.texture.exp.$str : u.sampler.$str;
          const index = uniforms.findIndex(val => val.value.name === name);
          if (index < 0) {
            throw new Error(`updateUniformBindings() failed: unable to find uniform ${name}`);
          }
          (uniforms[index] as AST.ASTDeclareVar).binding = u.binding;
        }
      }
    }
  }
  /** @internal */
  private createBindGroupLayouts(label: string): BindGroupLayout[] {
    const layouts: BindGroupLayout[] = [];
    for (const uniformInfo of this._uniforms) {
      let layout = layouts[uniformInfo.group];
      if (!layout) {
        layout = {
          label: `${label || 'unknown'}[${uniformInfo.group}]`,
          entries: []
        };
        if (this._nameMap[uniformInfo.group]) {
          layout.nameMap = this._nameMap[uniformInfo.group];
        }
        layouts[uniformInfo.group] = layout;
      }
      const entry: BindGroupLayoutEntry = {
        binding: uniformInfo.binding,
        visibility: uniformInfo.mask,
        type: null,
        name: '',
      };
      if (uniformInfo.block) {
        entry.type = (uniformInfo.block.exp.$typeinfo as PBStructTypeInfo).clone(this.getBlockName(uniformInfo.block.name));
        entry.buffer = {
          type: uniformInfo.block.exp.$declareType === AST.DeclareType.DECLARE_TYPE_UNIFORM
            ? 'uniform'
            : (uniformInfo.block.exp.$ast as AST.ASTPrimitive).writable ? 'storage' : 'read-only-storage',
          hasDynamicOffset: uniformInfo.block.dynamicOffset,
          uniformLayout: entry.type.toBufferLayout(0, (entry.type as PBStructTypeInfo).layout),
        };
        entry.name = uniformInfo.block.name;
      } else if (uniformInfo.texture) {
        entry.type = uniformInfo.texture.exp.$typeinfo;
        if (!entry.type.isTextureType()) {
          throw new Error('internal error');
        }
        if (entry.type.isStorageTexture()) {
          entry.storageTexture = {
            access: 'write-only',
            viewDimension: entry.type.is1DTexture() ? '1d' : '2d',
            format: entry.type.storageTexelFormat,
          };
        } else if (entry.type.isExternalTexture()) {
          entry.externalTexture = {
            autoBindSampler: uniformInfo.texture.autoBindSampler ? AST.genSamplerName(uniformInfo.texture.exp.$str, false) : null,
          };
        } else {
          const sampleType = this._deviceType === 'webgpu' ? uniformInfo.texture.exp.$sampleType : (uniformInfo.texture.autoBindSampler && entry.type.isDepthTexture()) ? 'float' : uniformInfo.texture.exp.$sampleType;
          let viewDimension: typeof entry.texture.viewDimension;
          if (entry.type.isArrayTexture()) {
            viewDimension = entry.type.isCubeTexture() ? 'cube-array' : '2d-array';
          } else if (entry.type.is3DTexture()) {
            viewDimension = '3d';
          } else if (entry.type.isCubeTexture()) {
            viewDimension = 'cube';
          } else if (entry.type.is1DTexture()) {
            viewDimension = '1d';
          } else {
            viewDimension = '2d';
          }
          entry.texture = {
            sampleType: sampleType,
            viewDimension: viewDimension,
            multisampled: false,
            autoBindSampler: null,
            autoBindSamplerComparison: null,
          };
          if (this.getDeviceType() === 'webgpu' || uniformInfo.texture.autoBindSampler === 'sample') {
            entry.texture.autoBindSampler = AST.genSamplerName(uniformInfo.texture.exp.$str, false);
          }
          if ((this.getDeviceType() === 'webgpu' && entry.type.isDepthTexture()) || uniformInfo.texture.autoBindSampler === 'comparison') {
            entry.texture.autoBindSamplerComparison = AST.genSamplerName(uniformInfo.texture.exp.$str, true);
          }
        }
        entry.name = uniformInfo.texture.exp.$str;
      } else if (uniformInfo.sampler) {
        entry.type = uniformInfo.sampler.$typeinfo;
        if (!entry.type.isSamplerType()) {
          throw new Error('internal error');
        }
        entry.sampler = {
          type: (entry.type.accessMode === PBSamplerAccessMode.SAMPLE)
            ? uniformInfo.sampler.$sampleType === 'float' ? 'filtering' : 'non-filtering'
            : 'comparison'
        };
        entry.name = uniformInfo.sampler.$str;
      } else {
        throw new errors.PBInternalError('invalid uniform entry type');
      }
      layout.entries.push(entry);
    }
    for (let i = 0; i < layouts.length; i++) {
      if (!layouts[i]) {
        layouts[i] = {
          label: `${label || 'unknown'}[${i}]`,
          entries: []
        };
      }
    }
    return layouts;
  }
  /** @internal */
  _getFunctionOverload(funcName: string, args: ExpValueNonArrayType[]): [PBFunctionTypeInfo, AST.ASTExpression[]] {
    const thisArgs = args.filter(val => {
      if (val instanceof PBShaderExp) {
        const type = val.$ast.getType();
        if (type.isStructType()
          && (this._structInfo[this._shaderType]?.types.findIndex(t => t.type.structName === type.structName) < 0)) {
          return false;
        }
      }
      return true;
    });
    const fn = this.globalScope.$getFunction(funcName);
    return fn ? this._matchFunctionOverloading(fn.overloads, thisArgs) : null;
  }
  /** @internal */
  _matchFunctionOverloading(overloadings: PBFunctionTypeInfo[], args: ExpValueNonArrayType[]): [PBFunctionTypeInfo, AST.ASTExpression[]] {
    for (const overload of overloadings) {
      if (args.length !== overload.argTypes.length) {
        continue;
      }
      const result: AST.ASTExpression[] = [];
      let matches = true;
      for (let i = 0; i < args.length; i++) {
        const argType = overload.argTypes[i].type;
        const arg = args[i];
        if (typeof arg === 'boolean') {
          if (!argType.isPrimitiveType() || argType.primitiveType !== PBPrimitiveType.BOOL) {
            matches = false;
            break;
          }
          result.push(new AST.ASTScalar(arg, typeBool));
        } else if (typeof arg === 'number') {
          if (!argType.isPrimitiveType() || !argType.isScalarType() || argType.scalarType === PBPrimitiveType.BOOL) {
            matches = false;
            break;
          }
          if (argType.scalarType === PBPrimitiveType.I32) {
            if (!Number.isInteger(arg) || arg < (0x80000000 >> 0) || arg > 0x7FFFFFFF) {
              matches = false;
              break;
            }
            result.push(new AST.ASTScalar(arg, typeI32));
          } else if (argType.scalarType === PBPrimitiveType.U32) {
            if (!Number.isInteger(arg) || arg < 0 || arg > 0xFFFFFFFF) {
              matches = false;
              break;
            }
            result.push(new AST.ASTScalar(arg, typeU32));
          } else {
            result.push(new AST.ASTScalar(arg, argType));
          }
        } else {
          if (argType.typeId !== arg.$ast.getType().typeId) {
            matches = false;
            break;
          }
          result.push(arg.$ast);
        }
      }
      if (matches) {
        return [overload, result];
      }
    }
    return null;
  }
  /** @internal */
  $callFunction(funcName: string, args: AST.ASTExpression[], returnType: PBTypeInfo): PBShaderExp {
    if (this.currentScope() === this.globalScope) {
      throw new errors.PBNonScopedFunctionCall(funcName);
    }
    const func = this.getFunction(funcName) || null;
    const exp = new PBShaderExp('', returnType);
    exp.$ast = new AST.ASTCallFunction(funcName, args, returnType, func, currentProgramBuilder.getDeviceType());
    this.currentScope().$ast.statements.push(exp.$ast);
    return exp;
  }
}

abstract class Proxiable<T> {
  /** @internal */
  private proxy: Proxiable<T>;
  constructor() {
    this.proxy = new Proxy(this, {
      get: function (target, prop) {
        return typeof prop === 'string' ? target.$get(prop) : undefined;
      },
      set: function (target, prop, value) {
        return typeof prop === 'string' ? target.$set(prop, value) : false;
      }
    }) as Proxiable<T>;
    return this.proxy;
  }
  get $thisProxy(): T {
    return this.proxy as unknown as T;
  }
  /** @internal */
  protected abstract $get(prop: string): any;
  /** @internal */
  protected abstract $set(prop: string, value: any): boolean;
}

export class PBScope extends Proxiable<PBScope> {
  /** @internal */
  protected $_variables: { [name: string]: PBShaderExp };
  /** @internal */
  protected $_parentScope: PBScope;
  /** @internal */
  protected $_AST: AST.ASTScope;
  /** @internal */
  protected $_localScope: PBLocalScope;
  [props: string]: any;
  /** @internal */
  constructor(astScope: AST.ASTScope, parent?: PBScope) {
    super();
    this.$_parentScope = parent || null;
    this.$_variables = {};
    this.$_AST = astScope;
    this.$_localScope = null;
  }
  get $builder(): ProgramBuilder {
    return currentProgramBuilder;
  }
  get $builtins(): PBBuiltinScope {
    return currentProgramBuilder.builtinScope;
  }
  get $inputs(): PBInputScope {
    return currentProgramBuilder.inputScope;
  }
  get $outputs(): PBOutputScope {
    return currentProgramBuilder.outputScope;
  }
  /** @internal */
  get $parent(): PBScope {
    return this.$_parentScope;
  }
  /** @internal */
  get $ast(): AST.ASTScope {
    return this.$_AST;
  }
  /** @internal */
  set $ast(ast: AST.ASTScope) {
    this.$_AST = ast;
  }
  $getVertexAttrib(loc: number): PBShaderExp {
    return currentProgramBuilder.reflection.attribute(loc);
  }
  get $l(): PBLocalScope {
    return this.$_getLocalScope();
  }
  get $g(): PBGlobalScope {
    return this.$_getGlobalScope();
  }
  $local(variable: PBShaderExp, init?: ExpValueType): void {
    const initNonArray = currentProgramBuilder.normalizeExpValue(init);
    variable.$global = this instanceof PBGlobalScope;
    this.$_declare(variable, initNonArray);
  }
  $touch(exp: PBShaderExp): void {
    this.$ast.statements.push(new AST.ASTTouch(exp.$ast));
  }
  $query(name: string): PBShaderExp {
    return currentProgramBuilder.queryGlobal(name);
  }
  /** @internal */
  $_declareInternal(variable: PBShaderExp, init?: ExpValueNonArrayType): AST.ShaderAST {
    const key = variable.$str;
    if (this.$_variables[key]) {
      throw new Error(`cannot re-declare variable '${key}'`);
    }
    if (!(variable.$ast instanceof AST.ASTPrimitive)) {
      throw new Error(`invalid variable declaration: '${variable.$ast.toString(currentProgramBuilder.getDeviceType())}'`);
    }
    const varType = variable.$typeinfo;
    if (varType.isPointerType()) {
      if (!init) {
        throw new Error(`cannot declare pointer type variable without initialization: '${variable.$str}'`);
      }
      if (!(init instanceof PBShaderExp)) {
        throw new Error(`invalid initialization for pointer type declaration: '${variable.$str}`);
      }
      const initType = init.$ast.getType();
      if (!initType.isPointerType() || varType.pointerType.typeId !== initType.pointerType.typeId) {
        throw new Error(`incompatible pointer type assignment: '${variable.$str}'`);
      }
      variable.$typeinfo = initType;
    }
    this.$_registerVar(variable, key);
    if (init === undefined || init === null) {
      return new AST.ASTDeclareVar(variable.$ast as AST.ASTPrimitive);
    } else {
      if (init instanceof PBShaderExp && init.$ast instanceof AST.ASTShaderExpConstructor && init.$ast.args.length === 0) {
        if (init.$ast.getType().typeId !== variable.$ast.getType().typeId) {
          throw new errors.PBTypeCastError(init, init.$ast.getType(), variable.$ast.getType());
        }
        return new AST.ASTDeclareVar(variable.$ast as AST.ASTPrimitive);
      } else {
        return new AST.ASTAssignment(new AST.ASTLValueDeclare(variable.$ast as AST.ASTPrimitive), init instanceof PBShaderExp ? init.$ast : init);
      }
    }
  }
  /** @internal */
  $_findOrSetUniform(variable: PBShaderExp): PBShaderExp {
    const name = variable.$str;
    const uniformInfo: UniformInfo = {
      group: variable.$group,
      binding: 0,
      mask: 0,
    };
    if (variable.$typeinfo.isTextureType()) {
      uniformInfo.texture = {
        autoBindSampler: null,
        exp: variable,
      };
    } else if (variable.$typeinfo.isSamplerType()) {
      uniformInfo.sampler = variable;
    } else {
      uniformInfo.block = {
        name: name,
        dynamicOffset: false,
        exp: variable,
      };
      // throw new Error(`unsupported uniform type: ${name}`);
    }
    let found = false;
    for (const u of currentProgramBuilder._uniforms) {
      if (u.group !== uniformInfo.group) {
        continue;
      }
      if (uniformInfo.block && u.block && u.block.name === uniformInfo.block.name && u.block.exp.$typeinfo.typeId === uniformInfo.block.exp.$typeinfo.typeId) {
        u.mask |= currentProgramBuilder.shaderType;
        variable = u.block.exp;
        // u.block.exp = variable;
        found = true;
        break;
      }
      if (uniformInfo.texture && u.texture && uniformInfo.texture.exp.$str === u.texture.exp.$str && uniformInfo.texture.exp.$typeinfo.typeId === u.texture.exp.$typeinfo.typeId) {
        u.mask |= currentProgramBuilder.shaderType;
        variable = u.texture.exp;
        // u.texture.exp = variable;
        found = true;
        break;
      }
      if (uniformInfo.sampler && u.sampler && uniformInfo.sampler.$str === u.sampler.$str && uniformInfo.sampler.$typeinfo.typeId === u.sampler.$typeinfo.typeId) {
        u.mask |= currentProgramBuilder.shaderType;
        variable = u.sampler;
        // u.sampler = variable;
        found = true;
        break;
      }
    }
    if (!found) {
      uniformInfo.mask = currentProgramBuilder.shaderType;
      currentProgramBuilder._uniforms.push(uniformInfo);
    }
    if (uniformInfo.texture
      && !(uniformInfo.texture.exp.$typeinfo as PBTextureTypeInfo).isStorageTexture()
      && !(uniformInfo.texture.exp.$typeinfo as PBTextureTypeInfo).isExternalTexture()
      && currentProgramBuilder.getDeviceType() === 'webgpu') {
      // webgpu requires explicit sampler bindings
      const isDepth = variable.$typeinfo.isTextureType() && variable.$typeinfo.isDepthTexture();
      const samplerName = AST.genSamplerName(variable.$str, false);
      const samplerExp = currentProgramBuilder.sampler(samplerName).uniform(uniformInfo.group).sampleType(variable.$sampleType);
      samplerExp.$sampleType = variable.$sampleType;
      this.$local(samplerExp);
      if (isDepth) {
        const samplerNameComp = AST.genSamplerName(variable.$str, true);
        const samplerExpComp = currentProgramBuilder.samplerComparison(samplerNameComp).uniform(uniformInfo.group).sampleType(variable.$sampleType);
        this.$local(samplerExpComp);
      }
    }
    return variable;
  }
  /** @internal */
  $_declare(variable: PBShaderExp, init?: ExpValueNonArrayType): void {
    if (this.$_variables[variable.$str]) {
      throw new errors.PBASTError(variable.$ast, 'cannot re-declare variable');
    }
    if (variable.$declareType === AST.DeclareType.DECLARE_TYPE_UNIFORM || variable.$declareType === AST.DeclareType.DECLARE_TYPE_STORAGE) {
      const name = (variable.$ast as AST.ASTPrimitive).name;
      if (!(this instanceof PBGlobalScope)) {
        throw new Error(`uniform or storage variables can only be declared within global scope: ${name}`);
      }
      if (variable.$declareType === AST.DeclareType.DECLARE_TYPE_UNIFORM
        && !variable.$typeinfo.isTextureType()
        && !variable.$typeinfo.isSamplerType()
        && (!variable.$typeinfo.isConstructible() || !variable.$typeinfo.isHostSharable())) {
        throw new errors.PBASTError(variable.$ast, `type '${variable.$typeinfo.toTypeName(currentProgramBuilder.getDeviceType())}' cannot be declared in uniform address space`);
      }
      if (variable.$declareType === AST.DeclareType.DECLARE_TYPE_STORAGE) {
        if (currentProgramBuilder.getDeviceType() !== 'webgpu') {
          throw new errors.PBDeviceNotSupport('storage buffer binding');
        } else if (!variable.$typeinfo.isHostSharable()) {
          throw new errors.PBASTError(variable.$ast, `type '${variable.$typeinfo.toTypeName(currentProgramBuilder.getDeviceType())}' cannot be declared in storage address space`);
        }
      }
      let originalType: PBPrimitiveTypeInfo | PBArrayTypeInfo = null;
      if (variable.$declareType === AST.DeclareType.DECLARE_TYPE_STORAGE && (variable.$typeinfo.isPrimitiveType() || variable.$typeinfo.isArrayType())) {
        originalType = variable.$typeinfo as PBPrimitiveTypeInfo | PBArrayTypeInfo;
        const wrappedStruct = currentProgramBuilder.defineStruct(null, 'default', new PBShaderExp('value', originalType));
        variable.$typeinfo = wrappedStruct().$typeinfo;
      }
      variable = this.$_findOrSetUniform(variable);
      const ast = this.$_declareInternal(variable) as AST.ASTDeclareVar;
      if (originalType) {
        variable.$ast = new AST.ASTHash(variable.$ast, 'value', originalType);
      }
      ast.group = variable.$group;
      ast.binding = 0;
      ast.blockName = currentProgramBuilder.getBlockName(name);
      const type = variable.$typeinfo;
      if (type.isTextureType() || type.isSamplerType() || variable.$declareType === AST.DeclareType.DECLARE_TYPE_STORAGE || (type.isStructType() && type.detail.layout === 'std140')) {
        (this.$ast as AST.ASTGlobalScope).uniforms.push(ast);
      }
      variable.$tags.forEach(val => {
        currentProgramBuilder.tagShaderExp(() => variable, val);
      });
    } else {
      const ast = this.$_declareInternal(variable, init);
      this.$ast.statements.push(ast);
    }
  }
  /** @internal */
  $_registerVar(variable: PBShaderExp, name?: string) {
    const key = name || variable.$str;
    const options: any = {
      configurable: true,
      get: function (this: PBScope) {
        return variable;
      },
      set: function (this: PBScope, val: number | PBShaderExp) {
        currentProgramBuilder.currentScope().$ast.statements.push(new AST.ASTAssignment(new AST.ASTLValueScalar(variable.$ast), val instanceof PBShaderExp ? val.$ast : val));
      },
    };
    Object.defineProperty(this, key, options);
    this.$_variables[key] = variable;
  }
  /** @internal */
  $localGet(prop: string): any {
    if (typeof prop === 'string' && (prop[0] === '$' || prop in this)) {
      return this[prop];
    }
    return undefined;
  }
  /** @internal */
  $localSet(prop: string, value: any): boolean {
    if (prop[0] === '$' || prop in this) {
      this[prop] = value;
      return true;
    }
    return false;
  }
  /** @internal */
  protected $get(prop: string): any {
    const ret = this.$localGet(prop);
    return ret === undefined && this.$_parentScope ? this.$_parentScope.$thisProxy.$get(prop) : ret;
  }
  /** @internal */
  protected $set(prop: string, value: any): boolean {
    if (prop[0] === '$') {
      this[prop] = value;
      return true;
    } else {
      let scope: PBScope = this;
      while (scope && !(prop in scope)) {
        scope = scope.$_parentScope;
      }
      if (scope) {
        scope[prop] = value;
        return true;
      } else {
        if (this.$l) {
          this.$l[prop] = value;
          return true;
        }
      }
    }
    return false;
  }
  /** @internal */
  protected $_getLocalScope(): PBLocalScope {
    if (!this.$_localScope) {
      this.$_localScope = new PBLocalScope(this);
    }
    return this.$_localScope;
  }
  /** @internal */
  protected $_getGlobalScope(): PBGlobalScope {
    return this.$builder.globalScope;
  }
}

export class PBLocalScope extends PBScope {
  /** @internal */
  $_scope: PBScope;
  [props: string]: any;
  constructor(scope: PBScope) {
    super(null, null);
    this.$_scope = scope;
  }
  /** @internal */
  protected $get(prop: string): any {
    return prop[0] === '$' ? this[prop] : this.$_scope.$localGet(prop);
  }
  /** @internal */
  protected $set(prop: string, value: any): boolean {
    if (prop[0] === '$') {
      this[prop] = value;
      return true;
    }
    const val = this.$_scope.$localGet(prop);
    if (val === undefined) {
      const type = currentProgramBuilder.guessExpValueType(value);
      const exp = new PBShaderExp(prop, type);
      if (value instanceof PBShaderExp && !this.$_scope.$parent) {
        exp.$declareType = value.$declareType;
        exp.$group = value.$group;
        exp.$attrib = value.$attrib;
        exp.$sampleType = value.$sampleType;
        exp.$precision = value.$precision;
        exp.tag(...value.$tags);
      }
      this.$_scope.$local(exp, value);
      return true;
    } else {
      return this.$_scope.$localSet(prop, value);
    }
  }
  /** @internal */
  $_getLocalScope(): PBLocalScope {
    return this;
  }
}

export interface PBBuiltinScope {
  position: PBShaderExp;
  pointSize: PBShaderExp;
  fragDepth: PBShaderExp;
  readonly fragCoord: PBShaderExp;
  readonly frontFacing: PBShaderExp;
  readonly vertexIndex: PBShaderExp;
  readonly instanceIndex: PBShaderExp;
  readonly localInvocationId: PBShaderExp;
  readonly globalInvocationId: PBShaderExp;
  readonly workGroupId: PBShaderExp;
  readonly numWorkGroups: PBShaderExp;
  readonly sampleMaskIn: PBShaderExp;
  sampleMaskOut: PBShaderExp;
  readonly sampleIndex: PBShaderExp;
}

export class PBBuiltinScope extends PBScope {
  /** @internal */
  $_usedBuiltins: Set<string>;
  /** @internal */
  $_builtinVars: { [k: string]: PBShaderExp };
  constructor() {
    super(null);
    this.$_usedBuiltins = new Set();
    const isWebGPU = currentProgramBuilder.getDeviceType() === 'webgpu';
    if (!isWebGPU) {
      this.$_builtinVars = {};
      const v = AST.builtinVariables[currentProgramBuilder.getDeviceType()];
      for (const k in v) {
        const info = v[k];
        this.$_builtinVars[k] = new PBShaderExp(info.name, info.type);
      }
    }
    const v = AST.builtinVariables[currentProgramBuilder.getDeviceType()];
    const that = this;
    for (const k of Object.keys(v)) {
      Object.defineProperty(this, k, {
        get: function () {
          return that.$getBuiltinVar(k);
        },
        set: function (v) {
          if ((typeof v !== 'number') && !(v instanceof PBShaderExp)) {
            throw new Error(`Invalid output value assignment`);
          }
          const exp = that.$getBuiltinVar(k);
          currentProgramBuilder.currentScope().$ast.statements.push(new AST.ASTAssignment(new AST.ASTLValueScalar(exp.$ast), v instanceof PBShaderExp ? v.$ast : v));
        },
      });
    }
  }
  /** @internal */
  protected $_getLocalScope(): PBLocalScope {
    return null;
  }
  /** @internal */
  private $getBuiltinVar(name: string) {
    this.$_usedBuiltins.add(name);
    const isWebGPU = currentProgramBuilder.getDeviceType() === 'webgpu';
    if (isWebGPU) {
      const v = AST.builtinVariables[currentProgramBuilder.getDeviceType()];
      const info = v[name];
      const inout = info.inOrOut;
      const structName = inout === 'in' ? AST.getBuiltinInputStructInstanceName(currentProgramBuilder.shaderType) : AST.getBuiltinOutputStructInstanceName(currentProgramBuilder.shaderType);
      const scope = currentProgramBuilder.currentScope();
      if (!scope[structName] || !scope[structName][info.name]) {
        throw new Error(`invalid use of builtin variable ${name}`);
      }
      return scope[structName][info.name];
    } else {
      return this.$_builtinVars[name];
    }
  }
}

export class PBInputScope extends PBScope {
  constructor() {
    super(null);
  }
  /** @internal */
  protected $_getLocalScope(): PBLocalScope {
    return null;
  }
  /** @internal */
  protected $set(prop: string, value: any): boolean {
    if (prop[0] === '$') {
      this[prop] = value;
    } else if (prop in this) {
      throw new Error(`Can not assign to shader input variable: "${prop}"`);
    } else {
      const st = currentProgramBuilder.shaderType;
      if (st !== ShaderType.Vertex) {
        throw new Error(`shader input variables can only be declared in vertex shader: "${prop}"`);
      }
      const attrib = getVertexAttribByName(value.$attrib);
      if (attrib === undefined) {
        throw new Error(`can not declare shader input variable: invalid vertex attribute: "${prop}"`);
      }
      if (currentProgramBuilder._vertexAttributes.indexOf(attrib) >= 0) {
        throw new Error(`can not declare shader input variable: attribute already declared: "${prop}"`);
      }
      if (!(value instanceof PBShaderExp) || !(value.$ast instanceof AST.ASTShaderExpConstructor)) {
        throw new Error(`invalid shader input variable declaration: "${prop}"`);
      }
      const type = value.$ast.getType();
      if (!type.isPrimitiveType() || type.isMatrixType() || type.primitiveType === PBPrimitiveType.BOOL) {
        throw new Error(`type cannot be used as pipeline input/output: ${prop}`);
      }
      const location = currentProgramBuilder._inputs.length;
      const exp = new PBShaderExp(`${input_prefix}${prop}`, type).tag(...value.$tags);
      currentProgramBuilder.in(location, prop, exp);
      currentProgramBuilder._vertexAttributes.push(attrib);
      currentProgramBuilder.reflection.setAttrib(attrib, exp);
      // modify input struct for webgpu
      if (currentProgramBuilder.getDeviceType() === 'webgpu') {
        if (currentProgramBuilder.findStructType(AST.getBuiltinInputStructName(st), st)) {
          currentProgramBuilder.defineBuiltinStruct(st, 'in');
        }
      }
    }
    return true;
  }
}

export class PBOutputScope extends PBScope {
  constructor() {
    super(null);
  }
  /** @internal */
  protected $_getLocalScope(): PBLocalScope {
    return null;
  }
  /** @internal */
  protected $set(prop: string, value: any): boolean {
    if (prop[0] === '$'/* || prop in this*/) {
      this[prop] = value;
    } else {
      if (!(prop in this)) {
        if (currentProgramBuilder.currentScope() === currentProgramBuilder.globalScope
          && (!(value instanceof PBShaderExp) || !(value.$ast instanceof AST.ASTShaderExpConstructor))) {
          throw new Error(`invalid shader output variable declaration: ${prop}`);
        }
        const type = value.$ast.getType();
        if (!type.isPrimitiveType() || type.isMatrixType() || type.primitiveType === PBPrimitiveType.BOOL) {
          throw new Error(`type cannot be used as pipeline input/output: ${prop}`);
        }
        const location = currentProgramBuilder._outputs.length;
        currentProgramBuilder.out(location, prop, new PBShaderExp(`${output_prefix}${prop}`, type).tag(...value.$tags));
        // modify output struct for webgpu
        if (currentProgramBuilder.getDeviceType() === 'webgpu') {
          const st = currentProgramBuilder.shaderType;
          if (currentProgramBuilder.findStructType(AST.getBuiltinInputStructName(st), st)) {
            currentProgramBuilder.defineBuiltinStruct(st, 'out');
          }
        }
      }
      if (currentProgramBuilder.currentScope() !== currentProgramBuilder.globalScope) {
        this[prop] = value;
      }
    }
    return true;
  }
}

export class PBGlobalScope extends PBScope {
  constructor() {
    super(new AST.ASTGlobalScope());
  }
  $mainFunc(
    this: PBGlobalScope,
    body?: (this: PBFunctionScope) => void
  ) {
    const builder = currentProgramBuilder;
    if (builder.getDeviceType() === 'webgpu') {
      const inputStruct = builder.defineBuiltinStruct(builder.shaderType, 'in');
      this.$local(inputStruct[1]);
      const isCompute = builder.shaderType === ShaderType.Compute;
      const outputStruct = isCompute ? null : builder.defineBuiltinStruct(builder.shaderType, 'out');
      if (!isCompute) {
        this.$local(outputStruct[1]);
      }
      this.$internalFunction('chMainStub', [], false, body);
      this.$internalFunction('main', inputStruct ? [inputStruct[3]] : [], true, function (this: PBFunctionScope) {
        if (inputStruct) {
          this[inputStruct[1].$str] = this[inputStruct[3].$str];
        }
        if (builder.shaderType === ShaderType.Fragment && builder.emulateDepthClamp) {
          this.$builtins.fragDepth = builder.clamp(this.$inputs.clamppedDepth, 0, 1);
        }
        this.chMainStub();
        if (builder.shaderType === ShaderType.Vertex) {
          if (builder.depthRangeCorrection) {
            this.$builtins.position.z = builder.mul(builder.add(this.$builtins.position.z, this.$builtins.position.w), 0.5);
          }
          if (builder.emulateDepthClamp) {
            //z = gl_Position.z / gl_Position.w;
            //z = (gl_DepthRange.diff * z + gl_DepthRange.near + gl_DepthRange.far) * 0.5;
            this.$outputs.clamppedDepth = builder.div(this.$builtins.position.z, this.$builtins.position.w);
            this.$builtins.position.z = 0;
          }
        }

        if (!isCompute) {
          this.$return(outputStruct[1]);
        }
      });
    } else {
      this.$internalFunction('main', [], true, function () {
        if (builder.shaderType === ShaderType.Fragment && builder.emulateDepthClamp) {
          this.$builtins.fragDepth = builder.clamp(this.$inputs.clamppedDepth, 0, 1);
        }
        body?.call(this);
        if (builder.shaderType === ShaderType.Vertex && builder.emulateDepthClamp) {
          this.$outputs.clamppedDepth = builder.div(builder.add(builder.div(this.$builtins.position.z, this.$builtins.position.w), 1), 2);
          this.$builtins.position.z = 0;
        }
      });
    }
  }
  $function(
    this: PBGlobalScope,
    name: string,
    params: PBShaderExp[],
    body?: (this: PBFunctionScope) => void,
  ) {
    this.$internalFunction(name, params, false, body);
  }
  /** @internal */
  $getFunction(name: string): AST.ASTFunction {
    return (this.$ast as AST.ASTGlobalScope).findFunction(name);
  }
  /** @internal */
  $getCurrentFunctionScope(): PBScope {
    let scope = currentProgramBuilder.currentScope();
    while (scope && !(scope instanceof PBFunctionScope)) {
      scope = scope.$parent;
    }
    return scope;
  }
  /** @internal */
  private $internalFunction(
    this: PBGlobalScope,
    name: string,
    params: PBShaderExp[],
    isMain: boolean,
    body?: (this: PBFunctionScope) => void,
  ) {
    const numArgs = params.length;
    const pb = currentProgramBuilder;
    params.forEach(param => {
      if (!(param.$ast instanceof AST.ASTPrimitive)) {
        throw new Error(`${name}(): invalid function definition`);
      }
      param.$ast = new AST.ASTFunctionParameter(param.$ast, currentProgramBuilder.getDeviceType());
    });
    Object.defineProperty(this, name, {
      get: function () {
        const func = this.$getFunction(name);
        if (!func) {
          throw new Error(`function ${name} not found`);
        }
        return (...args: (ExpValueType)[]) => {
          if (args.length !== numArgs) {
            throw new Error(`ERROR: incorrect argument count for ${name}`);
          }
          const argsNonArray = args.map(val => pb.normalizeExpValue(val));
          const funcType = pb._getFunctionOverload(name, argsNonArray);
          if (!funcType) {
            throw new Error(`ERROR: no matching overloads for function ${name}`);
          }
          return currentProgramBuilder.$callFunction(name, funcType[1], funcType[0].returnType);
        };
      },
    });
    const currentFunctionScope = this.$getCurrentFunctionScope();
    const astFunc = new AST.ASTFunction(name, params.map(param => param.$ast as AST.ASTFunctionParameter), isMain);
    if (currentFunctionScope) {
      const curIndex = this.$ast.statements.indexOf(currentFunctionScope.$ast);
      if (curIndex < 0) {
        throw new Error('Internal error');
      }
      this.$ast.statements.splice(curIndex, 0, astFunc);
    } else {
      this.$ast.statements.push(astFunc);
    }
    new PBFunctionScope(this, params, astFunc, body);
  }
}

export class PBInsideFunctionScope extends PBScope {
  /** @internal */
  constructor(parent: PBGlobalScope | PBInsideFunctionScope) {
    super(new AST.ASTScope(), parent);
  }
  $return(retval?: ExpValueType) {
    const functionScope = this.findOwnerFunction();
    const astFunc = functionScope.$ast as AST.ASTFunction;
    let returnType: PBTypeInfo = null;
    const retValNonArray = currentProgramBuilder.normalizeExpValue(retval);
    if (retValNonArray !== undefined && retValNonArray !== null) {
      if (typeof retValNonArray === 'number') {
        if (Number.isInteger(retValNonArray)) {
          if (retValNonArray < 0) {
            if (retValNonArray < (0x80000000 >> 0)) {
              throw new Error(`function ${astFunc.name}: invalid return value: ${retValNonArray}`);
            }
            returnType = typeI32;
          } else {
            if (retValNonArray > 0xFFFFFFFF) {
              throw new Error(`function ${astFunc.name}: invalid return value: ${retValNonArray}`);
            }
            returnType = retValNonArray <= 0x7FFFFFFF ? typeI32 : typeU32;
          }
        } else {
          returnType = typeF32;
        }
      } else if (typeof retValNonArray === 'boolean') {
        returnType = typeBool;
      } else {
        returnType = retValNonArray.$ast.getType();
      }
    } else {
      returnType = typeVoid;
    }
    if (returnType.isPointerType()) {
      throw new Error('function can not return pointer type');
    }
    if (!astFunc.returnType) {
      astFunc.returnType = returnType;
    } else if (astFunc.returnType.typeId !== returnType.typeId) {
      throw new Error(`function ${astFunc.name}: return type must be ${astFunc.returnType?.toTypeName(currentProgramBuilder.getDeviceType()) || 'void'}`);
    }
    let returnValue: AST.ASTExpression = null;
    if (retValNonArray !== undefined && retValNonArray !== null) {
      if (retValNonArray instanceof PBShaderExp) {
        returnValue = retValNonArray.$ast;
      } else {
        if (!returnType.isPrimitiveType() || !returnType.isScalarType()) {
          throw new errors.PBTypeCastError(retValNonArray, typeof retValNonArray, returnType);
        }
        returnValue = new AST.ASTScalar(retValNonArray, returnType);
      }
    }
    this.$ast.statements.push(new AST.ASTReturn(returnValue));
  }
  $scope(body: (this: PBInsideFunctionScope) => void): PBInsideFunctionScope {
    const astScope = new AST.ASTNakedScope();
    this.$ast.statements.push(astScope);
    return new PBNakedScope(this, astScope, body);
  }
  $if(condition: ExpValueNonArrayType, body: (this: PBIfScope) => void): PBIfScope {
    const astIf = new AST.ASTIf('if', condition instanceof PBShaderExp ? condition.$ast : new AST.ASTScalar(condition, typeof condition === 'number' ? typeF32 : typeBool));
    this.$ast.statements.push(astIf);
    return new PBIfScope(this, astIf, body);
  }
  $break() {
    this.$ast.statements.push(new AST.ASTBreak());
  }
  $continue() {
    this.$ast.statements.push(new AST.ASTContinue());
  }
  $for(counter: PBShaderExp, init: number | PBShaderExp, count: number | PBShaderExp, body: (this: PBForScope) => void) {
    const initializerType = counter.$ast.getType();
    if (!initializerType.isPrimitiveType() || !initializerType.isScalarType()) {
      throw new errors.PBASTError(counter.$ast, 'invalid for range initializer type');
    }
    const initval = init instanceof PBShaderExp ? init.$ast : new AST.ASTScalar(init, initializerType);
    const astFor = new AST.ASTRange(counter.$ast as AST.ASTPrimitive, initval, count instanceof PBShaderExp ? count.$ast : new AST.ASTScalar(count, initializerType), true);
    this.$ast.statements.push(astFor);
    new PBForScope(this, counter, count, astFor, body);
  }
  $do(body: (this: PBDoWhileScope) => void): PBDoWhileScope {
    const astDoWhile = new AST.ASTDoWhile(null);
    this.$ast.statements.push(astDoWhile);
    return new PBDoWhileScope(this, astDoWhile, body);
  }
  $while(condition: ExpValueNonArrayType, body: (this: PBWhileScope) => void) {
    const astWhile = new AST.ASTWhile(condition instanceof PBShaderExp ? condition.$ast : new AST.ASTScalar(condition, typeof condition === 'number' ? typeF32 : typeBool));
    this.$ast.statements.push(astWhile);
    new PBWhileScope(this, astWhile, body);
  }
  /** @internal */
  private findOwnerFunction(): PBFunctionScope {
    for (let scope: PBScope = this; scope; scope = scope.$parent) {
      if (scope instanceof PBFunctionScope) {
        return scope;
      }
    }
    return null;
  }
}

export class PBFunctionScope extends PBInsideFunctionScope {
  /** @internal */
  constructor(
    parent: PBGlobalScope,
    params: PBShaderExp[],
    ast: AST.ASTScope,
    body?: (this: PBFunctionScope) => void,
  ) {
    super(parent);
    this.$ast = ast;
    for (const param of params) {
      if (this.$_variables[param.$str]) {
        throw new Error('Duplicate function parameter name is not allowed');
      }
      this.$_registerVar(param);
    }
    currentProgramBuilder.pushScope(this);
    body && body.call(this);
    currentProgramBuilder.popScope();

    const astFunc = this.$ast as AST.ASTFunction;
    if (!astFunc.returnType) {
      astFunc.returnType = typeVoid;
    }
  }
}

export class PBWhileScope extends PBInsideFunctionScope {
  /** @internal */
  constructor(
    parent: PBInsideFunctionScope,
    ast: AST.ASTScope,
    body: (this: PBWhileScope) => void,
  ) {
    super(parent);
    this.$ast = ast;
    currentProgramBuilder.pushScope(this);
    body && body.call(this);
    currentProgramBuilder.popScope();
  }
}

export class PBDoWhileScope extends PBInsideFunctionScope {
  /** @internal */
  constructor(parent: PBInsideFunctionScope, ast: AST.ASTScope, body: (this: PBDoWhileScope) => void) {
    super(parent);
    this.$ast = ast;
    currentProgramBuilder.pushScope(this);
    body && body.call(this);
    currentProgramBuilder.popScope();
  }
  $while(condition: ExpValueNonArrayType) {
    (this.$ast as AST.ASTDoWhile).condition = condition instanceof PBShaderExp ? condition.$ast : new AST.ASTScalar(condition, typeof condition === 'number' ? typeF32 : typeBool);
  }
}

export class PBForScope extends PBInsideFunctionScope {
  /** @internal */
  constructor(
    parent: PBGlobalScope | PBInsideFunctionScope,
    counter: PBShaderExp,
    count: number | PBShaderExp,
    ast: AST.ASTScope,
    body: (this: PBForScope) => void,
  ) {
    super(parent);
    this.$ast = ast;
    this.$_registerVar(counter);
    currentProgramBuilder.pushScope(this);
    body && body.call(this);
    currentProgramBuilder.popScope();
  }
}
export class PBNakedScope extends PBInsideFunctionScope {
  /** @internal */
  constructor(
    parent: PBInsideFunctionScope,
    ast: AST.ASTScope,
    body: (this: PBNakedScope) => void
  ) {
    super(parent);
    this.$ast = ast;
    currentProgramBuilder.pushScope(this);
    body && body.call(this);
    currentProgramBuilder.popScope();
  }
}
export class PBIfScope extends PBInsideFunctionScope {
  /** @internal */
  constructor(
    parent: PBInsideFunctionScope,
    ast: AST.ASTScope,
    body: (this: PBIfScope) => void
  ) {
    super(parent);
    this.$ast = ast;
    currentProgramBuilder.pushScope(this);
    body && body.call(this);
    currentProgramBuilder.popScope();
  }
  $elseif(condition: ExpValueNonArrayType, body: (this: PBIfScope) => void): PBIfScope {
    const astElseIf = new AST.ASTIf('else if', condition instanceof PBShaderExp ? condition.$ast : new AST.ASTScalar(condition, typeof condition === 'number' ? typeF32 : typeBool));
    (this.$ast as AST.ASTIf).nextElse = astElseIf;
    return new PBIfScope(this.$_parentScope as PBInsideFunctionScope, astElseIf, body);
  }
  $else(body: (this: PBIfScope) => void): void {
    const astElse = new AST.ASTIf('else', null);
    (this.$ast as AST.ASTIf).nextElse = astElse;
    new PBIfScope(this.$_parentScope as PBInsideFunctionScope, astElse, body);
  }
}

let uidExp = 0;

export class PBShaderExp extends Proxiable<PBShaderExp> {
  /** @internal */
  $uid: number;
  /** @internal */
  $str: string;
  /** @internal */
  $location: number;
  /** @internal */
  $typeinfo: PBTypeInfo;
  /** @internal */
  $global: boolean;
  /** @internal */
  $sampleType: 'depth' | 'sint' | 'uint' | 'float' | 'unfilterable-float';
  /** @internal */
  $precision: AST.ShaderPrecisionType;
  /** @internal */
  $ast: AST.ASTExpression;
  /** @internal */
  $inout: string;
  /** @internal */
  $memberCache: { [name: string]: PBShaderExp };
  /** @internal */
  $attrib: VertexAttribName;
  /** @internal */
  $tags: ProgramBuilder.ShaderExpTagValue[];
  /** @internal */
  $group: number;
  /** @internal */
  $declareType: AST.DeclareType;
  [name: string]: any;
  /** @internal */
  constructor(str: string, typeInfo: PBTypeInfo) {
    super();
    if (!str && typeInfo.isPointerType()) {
      throw new Error('no default constructor for pointer type');
    }
    this.$uid = uidExp++;
    this.$str = str || '';
    this.$location = 0;
    this.$global = false;
    this.$typeinfo = typeInfo;
    this.$qualifier = null;
    this.$precision = AST.ShaderPrecisionType.NONE;
    this.$ast = new AST.ASTPrimitive(this);
    this.$inout = null;
    this.$memberCache = {};
    this.$attrib = null;
    this.$tags = [];
    this.$group = null;
    this.$declareType = AST.DeclareType.DECLARE_TYPE_NONE;
    if (typeInfo.isTextureType()) {
      if (typeInfo.isDepthTexture()) {
        this.$sampleType = 'depth';
      } else {
        const t = AST.getTextureSampleType(typeInfo);
        if (t.primitiveType === PBPrimitiveType.I32) {
          this.$sampleType = 'sint';
        } else if (t.primitiveType === PBPrimitiveType.U32) {
          this.$sampleType = 'uint';
        } else {
          this.$sampleType = 'float';
        }
      }
    }
  }
  uniform(group: number): PBShaderExp {
    this.$declareType = AST.DeclareType.DECLARE_TYPE_UNIFORM;
    this.$group = group;
    return this;
  }
  workgroup(): PBShaderExp {
    this.$declareType = AST.DeclareType.DECLARE_TYPE_WORKGROUP;
    return this;
  }
  storage(group: number): PBShaderExp {
    if (!this.$typeinfo.isHostSharable()) {
      throw new errors.PBASTError(this.$ast, 'type cannot be declared in storage address space');
    }
    this.$declareType = AST.DeclareType.DECLARE_TYPE_STORAGE;
    this.$group = group;
    return this;
  }
  attrib(attr: VertexAttribName): PBShaderExp {
    this.$declareType = AST.DeclareType.DECLARE_TYPE_IN;
    this.$attrib = attr;
    return this;
  }
  tag(...args: ProgramBuilder.ShaderExpTagValue[]): PBShaderExp {
    args.forEach(val => {
      if (this.$tags.indexOf(val) < 0) {
        this.$tags.push(val);
      }
    });
    return this;
  }
  sampleType(type: 'float' | 'unfilterable-float' | 'sint' | 'uint' | 'depth'): PBShaderExp {
    if (type) {
      this.$sampleType = type;
    }
    return this;
  }
  at(index: number | PBShaderExp) {
    const varType = this.$ast.getType();
    if (!varType.isArrayType()) {
      throw new Error('at() function must be used with array types');
    }
    if (typeof index === 'number') {
      if (!Number.isInteger(index)) {
        throw new Error('at() array index must be integer type');
      }
      if (index < 0 || (varType.dimension > 0 && index >= varType.dimension)) {
        throw new Error('at() array index out of bounds');
      }
    }
    const result = new PBShaderExp('', varType.elementType);
    result.$ast = new AST.ASTArrayIndex(this.$ast, typeof index === 'number' ? new AST.ASTScalar(index, typeI32) : index.$ast, varType.elementType);
    return result;
  }
  setAt(index: number | PBShaderExp, val: number | boolean | PBShaderExp) {
    const varType = this.$ast.getType();
    if (!varType.isArrayType()) {
      throw new Error('setAt() function must be used with array types');
    }
    if (typeof index === 'number') {
      if (!Number.isInteger(index)) {
        throw new Error('setAt() array index must be integer type');
      }
      if (index < 0 || (varType.dimension > 0 && index >= varType.dimension)) {
        throw new Error('setAt() array index out of bounds');
      }
    }
    currentProgramBuilder.currentScope().$ast.statements.push(new AST.ASTAssignment(new AST.ASTLValueArray(new AST.ASTLValueScalar(this.$ast), typeof index === 'number' ? new AST.ASTScalar(index, typeI32) : index.$ast, varType.elementType), val instanceof PBShaderExp ? val.$ast : val));
  }
  highp(): PBShaderExp {
    this.$precision = AST.ShaderPrecisionType.HIGH;
    return this;
  }
  mediump(): PBShaderExp {
    this.$precision = AST.ShaderPrecisionType.MEDIUM;
    return this;
  }
  lowp(): PBShaderExp {
    this.$precision = AST.ShaderPrecisionType.LOW;
    return this;
  }
  isVector(): boolean {
    const varType = this.$ast.getType();
    return varType.isPrimitiveType() && varType.isVectorType();
  }
  numComponents(): number {
    const varType = this.$ast.getType();
    return varType.isPrimitiveType() ? varType.cols : 0;
  }
  getTypeName(): string {
    return this.$ast.getType().toTypeName(currentProgramBuilder.getDeviceType());
  }
  /** @internal */
  protected $get(prop: string): any {
    if (typeof prop === 'string') {
      if (prop[0] === '$' || prop in this) {
        return this[prop];
      } else {
        let exp = this.$memberCache[prop];
        if (!exp) {
          const varType = this.$ast?.getType() || this.$typeinfo;
          const num = Number(prop);
          if (Number.isNaN(num)) {
            if (varType.isStructType()) {
              const elementIndex = varType.structMembers.findIndex(val => val.name === prop);
              if (elementIndex < 0) {
                throw new Error(`unknown struct member '${prop}'`);
              }
              const element = varType.structMembers[elementIndex];
              if (element.type.isStructType()) {
                const ctor = currentProgramBuilder.structInfo.structs[element.type.structName];
                exp = ctor.call(currentProgramBuilder, `${this.$str}.${prop}`);
              } else {
                exp = new PBShaderExp(`${this.$str}.${prop}`, element.type);
              }
              exp.$ast = new AST.ASTHash(this.$ast, prop, element.type);
            } else {
              if (!varType.isPrimitiveType() || !varType.isVectorType()) {
                throw new Error(`invalid index operation: ${this.$ast.toString(currentProgramBuilder.getDeviceType())}[${prop}]`);
              }
              if (prop.length === 0
                || prop.length > varType.cols
                || ([...prop].some(val => 'xyzw'.slice(0, varType.cols).indexOf(val) < 0)
                  && [...prop].some(val => 'rgba'.slice(0, varType.cols).indexOf(val) < 0))) {
                throw new Error(`unknown swizzle target: ${this.$ast.toString(currentProgramBuilder.getDeviceType())}[${prop}]`);
              }
              const type = PBPrimitiveTypeInfo.getCachedTypeInfo(varType.resizeType(1, prop.length));
              exp = new PBShaderExp('', type);
              exp.$ast = new AST.ASTHash(this.$ast, prop, type);
            }
          } else {
            if (varType.isArrayType()) {
              exp = this.at(num);
            } else if (varType.isPrimitiveType() && varType.isVectorType()) {
              if (num >= varType.cols) {
                throw new Error(`component index out of bounds: ${this.$str}[${num}]`);
              }
              exp = this.$get('xyzw'[num]);
            } else if (varType.isPrimitiveType() && varType.isMatrixType()) {
              const type = PBPrimitiveTypeInfo.getCachedTypeInfo(varType.resizeType(1, varType.cols));
              exp = new PBShaderExp('', type);
              exp.$ast = new AST.ASTArrayIndex(this.$ast, new AST.ASTScalar(num, typeI32), type);
            } else {
              throw new Error(`invalid index operation: ${this.$str}[${num}]`);
            }
          }
          this.$memberCache[prop] = exp;
        }
        return exp;
      }
    } else {
      return undefined;
    }
  }
  /** @internal */
  protected $set(prop: string, value: any): boolean {
    if (typeof prop === 'string') {
      if (prop[0] === '$' || prop in this) {
        this[prop] = value;
      } else {
        if ((typeof value !== 'number') && (typeof value !== 'boolean') && !(value instanceof PBShaderExp)) {
          throw new Error(`Invalid output value assignment`);
        }
        const varType = this.$ast?.getType() || this.$typeinfo;
        const num = Number(prop);
        if (Number.isNaN(num)) {
          if (varType.isStructType()) {
            const elementIndex = varType.structMembers.findIndex(val => val.name === prop);
            if (elementIndex < 0) {
              throw new Error(`unknown struct member '${prop}`);
            }
            const element = varType.structMembers[elementIndex];
            let dstAST: AST.ASTExpression;
            if (typeof value === 'number' || typeof value === 'boolean') {
              if (!element.type.isPrimitiveType() || !element.type.isScalarType()) {
                throw new Error(`can not set struct member '${prop}: invalid value type`);
              }
              dstAST = new AST.ASTScalar(value, element.type);
            } else if (value instanceof PBShaderExp) {
              dstAST = value.$ast;
            }
            if (!dstAST) {
              throw new Error(`can not set struct member '${prop}: invalid value type`);
            }
            currentProgramBuilder.currentScope().$ast.statements.push(new AST.ASTAssignment(new AST.ASTLValueHash(new AST.ASTLValueScalar(this.$ast), prop, element.type), dstAST));
          } else {
            // FIXME: WGSL does not support l-value swizzling
            if (prop.length > 1 || ('xyzw'.indexOf(prop) < 0 && 'rgba'.indexOf(prop) < 0)) {
              throw new Error(`invalid index operation: ${this.$str}[${num}]`);
            }
            if (!varType.isPrimitiveType() || !varType.isVectorType()) {
              throw new Error(`invalid index operation: ${this.$str}[${num}]`);
            }
            const type = PBPrimitiveTypeInfo.getCachedTypeInfo(varType.scalarType);
            currentProgramBuilder.currentScope().$ast.statements.push(new AST.ASTAssignment(new AST.ASTLValueHash(new AST.ASTLValueScalar(this.$ast), prop, type), value instanceof PBShaderExp ? value.$ast : value));
          }
        } else {
          if (varType.isArrayType()) {
            this.setAt(num, value);
          } else if (varType.isPrimitiveType() && varType.isVectorType()) {
            if (num >= varType.cols) {
              throw new Error(`component index out of bounds: ${this.$str}[${num}]`);
            }
            this.$set('xyzw'[num], value);
          } else if (varType.isPrimitiveType() && varType.isMatrixType()) {
            if (!(value instanceof PBShaderExp)) {
              throw new Error(`invalid matrix column vector assignment: ${this.$str}[${num}]`);
            }
            const type = PBPrimitiveTypeInfo.getCachedTypeInfo(varType.resizeType(1, varType.cols));
            currentProgramBuilder.currentScope().$ast.statements.push(new AST.ASTAssignment(new AST.ASTLValueArray(new AST.ASTLValueScalar(this.$ast), new AST.ASTScalar(num, typeI32), type), value.$ast));
          } else {
            throw new Error(`invalid index operation: ${this.$str}[${num}]`);
          }
        }
      }
      return true;
    }
    return false;
  }
}
