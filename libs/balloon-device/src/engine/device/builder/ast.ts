import { ShaderType } from '../base_types';
import { semanticToAttrib } from '../gpuobject';
import { DeviceType, DEVICE_TYPE_WEBGL, DEVICE_TYPE_WEBGL2, DEVICE_TYPE_WEBGPU } from '../device';
import * as typeinfo from './types';
import * as errors from './errors';
import { assert } from '../../../shared';
import type { PBShaderExp, PBGlobalScope } from './programbuilder';

export const BuiltinInputStructNameVS = 'ch_VertexInput';
export const BuiltinOutputStructNameVS = 'ch_VertexOutput';
export const BuiltinInputStructNameFS = 'ch_FragInput';
export const BuiltinOutputStructNameFS = 'ch_FragOutput';
export const BuiltinInputStructNameCS = 'ch_ComputeInput';
export const BuiltinOutputStructNameCS = 'ch_ComputeOutput';

export const BuiltinInputStructInstanceNameVS = 'ch_VertexInputCpy';
export const BuiltinOutputStructInstanceNameVS = 'ch_VertexOutputCpy';
export const BuiltinInputStructInstanceNameFS = 'ch_FragInputCpy';
export const BuiltinOutputStructInstanceNameFS = 'ch_FragOutputCpy';
export const BuiltinInputStructInstanceNameCS = 'ch_ComputeInputCpy';
export const BuiltinOutputStructInstanceNameCS = 'ch_ComputeOutputCpy';

export enum DeclareType {
  DECLARE_TYPE_NONE = 0,
  DECLARE_TYPE_IN,
  DECLARE_TYPE_OUT,
  DECLARE_TYPE_WORKGROUP,
  DECLARE_TYPE_UNIFORM,
  DECLARE_TYPE_STORAGE,
}

export enum ShaderPrecisionType {
  NONE = 0,
  HIGH,
  MEDIUM,
  LOW
}

/** @internal */
export function getBuiltinInputStructInstanceName(shaderType: ShaderType) {
  switch (shaderType) {
    case ShaderType.Vertex: return BuiltinInputStructInstanceNameVS;
    case ShaderType.Fragment: return BuiltinInputStructInstanceNameFS;
    case ShaderType.Compute: return BuiltinInputStructInstanceNameCS;
    default: return null;
  }
}

/** @internal */
export function getBuiltinOutputStructInstanceName(shaderType: ShaderType) {
  switch (shaderType) {
    case ShaderType.Vertex: return BuiltinOutputStructInstanceNameVS;
    case ShaderType.Fragment: return BuiltinOutputStructInstanceNameFS;
    case ShaderType.Compute: return BuiltinOutputStructInstanceNameCS;
    default: return null;
  }
}
/** @internal */
export function getBuiltinInputStructName(shaderType: ShaderType) {
  switch (shaderType) {
    case ShaderType.Vertex: return BuiltinInputStructNameVS;
    case ShaderType.Fragment: return BuiltinInputStructNameFS;
    case ShaderType.Compute: return BuiltinInputStructNameCS;
    default: return null;
  }
}
/** @internal */
export function getBuiltinOutputStructName(shaderType: ShaderType) {
  switch (shaderType) {
    case ShaderType.Vertex: return BuiltinOutputStructNameVS;
    case ShaderType.Fragment: return BuiltinOutputStructNameFS;
    case ShaderType.Compute: return BuiltinOutputStructNameCS;
    default: return null;
  }
}

/** @internal */
export function getTextureSampleType(type: typeinfo.PBTextureTypeInfo): typeinfo.PBPrimitiveTypeInfo {
  switch (type.textureType) {
    case typeinfo.PBTextureType.TEX_1D:
    case typeinfo.PBTextureType.TEX_STORAGE_1D:
    case typeinfo.PBTextureType.TEX_2D:
    case typeinfo.PBTextureType.TEX_STORAGE_2D:
    case typeinfo.PBTextureType.TEX_2D_ARRAY:
    case typeinfo.PBTextureType.TEX_STORAGE_2D_ARRAY:
    case typeinfo.PBTextureType.TEX_3D:
    case typeinfo.PBTextureType.TEX_STORAGE_3D:
    case typeinfo.PBTextureType.TEX_CUBE:
    case typeinfo.PBTextureType.TEX_EXTERNAL:
      return new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.F32VEC4);
    case typeinfo.PBTextureType.TEX_DEPTH_2D_ARRAY:
    case typeinfo.PBTextureType.TEX_DEPTH_2D:
    case typeinfo.PBTextureType.TEX_DEPTH_CUBE:
      return new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.F32);
    case typeinfo.PBTextureType.ITEX_2D_ARRAY:
    case typeinfo.PBTextureType.ITEX_1D:
    case typeinfo.PBTextureType.ITEX_2D:
    case typeinfo.PBTextureType.ITEX_3D:
    case typeinfo.PBTextureType.ITEX_CUBE:
      return new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.I32);
    case typeinfo.PBTextureType.UTEX_2D_ARRAY:
    case typeinfo.PBTextureType.UTEX_1D:
    case typeinfo.PBTextureType.UTEX_2D:
    case typeinfo.PBTextureType.UTEX_3D:
    case typeinfo.PBTextureType.UTEX_CUBE:
      return new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.U32);
    default:
      return null;
  }
}

/** @internal */
export function genSamplerName(textureName: string, comparison: boolean): string {
  return `ch_auto_sampler_${textureName}${comparison ? '_comparison' : ''}`;
}

const webGLExtensions: string[] = [
  'GL_EXT_shader_texture_lod',
  'GL_OES_standard_derivatives',
  'GL_EXT_draw_buffers',
  'GL_EXT_frag_depth',
  'GL_ANGLE_multi_draw',
];

const webGL2Extensions: string[] = [
  'GL_ANGLE_multi_draw',
  'GL_OVR_multiview2',
];

/** @internal */
export const builtinVariables = {
  [DEVICE_TYPE_WEBGL]: {
    position: {
      name: 'gl_Position',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.F32VEC4),
      stage: 'vertex',
    },
    pointSize: {
      name: 'gl_PointSize',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.F32),
      stage: 'vertex',
    },
    fragCoord: {
      name: 'gl_FragCoord',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.F32VEC4),
      stage: 'fragment',
    },
    frontFacing: {
      name: 'gl_FrontFacing',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.BOOL),
      stage: 'fragment',
    },
    fragDepth: {
      name: 'gl_FragDepthEXT',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.F32),
      inOrOut: 'out',
      extension: 'GL_EXT_frag_depth',
      stage: 'fragment',
    },
  },
  [DEVICE_TYPE_WEBGL2]: {
    vertexIndex: {
      name: 'gl_VertexID',
      semantic: 'vertex_index',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.U32),
      inOrOut: 'in',
      stage: 'vertex',
    },
    instanceIndex: {
      name: 'gl_InstanceID',
      semantic: 'instance_index',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.U32),
      inOrOut: 'in',
      stage: 'vertex',
    },
    position: {
      name: 'gl_Position',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.F32VEC4),
      stage: 'vertex',
    },
    pointSize: {
      name: 'gl_PointSize',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.F32),
      stage: 'vertex',
    },
    fragCoord: {
      name: 'gl_FragCoord',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.F32VEC4),
      stage: 'fragment',
    },
    frontFacing: {
      name: 'gl_FrontFacing',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.BOOL),
      stage: 'fragment',
    },
    fragDepth: {
      name: 'gl_FragDepth',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.F32),
      stage: 'fragment',
    },
  },
  [DEVICE_TYPE_WEBGPU]: {
    vertexIndex: {
      name: 'ch_builtin_vertexIndex',
      semantic: 'vertex_index',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.U32),
      inOrOut: 'in',
      stage: 'vertex',
    },
    instanceIndex: {
      name: 'ch_builtin_instanceIndex',
      semantic: 'instance_index',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.U32),
      inOrOut: 'in',
      stage: 'vertex',
    },
    position: {
      name: 'ch_builtin_position',
      semantic: 'position',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.F32VEC4),
      inOrOut: 'out',
      stage: 'vertex',
    },
    fragCoord: {
      name: 'ch_builtin_fragCoord',
      semantic: 'position',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.F32VEC4),
      inOrOut: 'in',
      stage: 'fragment',
    },
    frontFacing: {
      name: 'ch_builtin_frontFacing',
      semantic: 'front_facing',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.BOOL),
      inOrOut: 'in',
      stage: 'fragment',
    },
    fragDepth: {
      name: 'ch_builtin_fragDepth',
      semantic: 'frag_depth',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.F32),
      inOrOut: 'out',
      stage: 'fragment',
    },
    localInvocationId: {
      name: 'ch_builtin_localInvocationId',
      semantic: 'local_invocation_id',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.U32VEC3),
      inOrOut: 'in',
      stage: 'compute',
    },
    globalInvocationId: {
      name: 'ch_builtin_globalInvocationId',
      semantic: 'global_invocation_id',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.U32VEC3),
      inOrOut: 'in',
      stage: 'compute',
    },
    workGroupId: {
      name: 'ch_builtin_workGroupId',
      semantic: 'workgroup_id',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.U32VEC3),
      inOrOut: 'in',
      stage: 'compute',
    },
    numWorkGroups: {
      name: 'ch_builtin_numWorkGroups',
      semantic: 'num_workgroups',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.U32VEC3),
      inOrOut: 'in',
      stage: 'compute',
    },
    sampleMaskIn: {
      name: 'ch_builtin_sampleMaskIn',
      semantic: 'sample_mask_in',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.U32),
      inOrOut: 'in',
      stage: 'fragment'
    },
    sampleMaskOut: {
      name: 'ch_builtin_sampleMaskOut',
      semantic: 'sample_mask_out',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.U32),
      inOrOut: 'out',
      stage: 'fragment'
    },
    sampleIndex: {
      name: 'ch_builtin_sampleIndex',
      semantic: 'sample_index',
      type: new typeinfo.PBPrimitiveTypeInfo(typeinfo.PBPrimitiveType.U32),
      inOrOut: 'in',
      stage: 'fragment',
    }
  }
} as const;

function toFixed(n: number): string {
  return n % 1 === 0 ? n.toFixed(1) : String(n);
}

function toInt(n: number): string {
  return String(n | 0);
}

function toUint(n: number): string {
  return String(n >>> 0);
}

function unbracket(e: string): string {
  e = e.trim();
  if (e[0] === '(' && e[e.length - 1] === ')') {
    return e.substring(1, e.length - 1);
  } else {
    return e;
  }
}

/** @internal */
export interface ASTContext {
  type: ShaderType;
  mrt: boolean;
  defines: string[];
  extensions: Set<string>;
  builtins: string[];
  inputs: ShaderAST[];
  outputs: ShaderAST[];
  types: ShaderAST[];
  typeReplacement: Map<PBShaderExp, typeinfo.PBTypeInfo>;
  global: PBGlobalScope;
  vertexAttributes: number[];
  workgroupSize: [number, number, number];
}

/** @internal */
export class ShaderAST {
  constructor() {
  }
  isReference(): boolean {
    return false;
  }
  isPointer(): boolean {
    return !!this.getType()?.isPointerType();
  }
  getType(): typeinfo.PBTypeInfo {
    return null;
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    return '';
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    return '';
  }
  toWGSL(indent: string, ctx: ASTContext): string {
    return '';
  }
  toString(deviceType: DeviceType): string {
    return this.constructor.name;
  }
}

/** @internal */
export abstract class ASTExpression extends ShaderAST {
  abstract getType(): typeinfo.PBTypeInfo;
  abstract markWritable(): void;
  abstract isWritable(): boolean;
  abstract getAddressSpace(): typeinfo.PBAddressSpace;
  abstract isConstExp(): boolean;
}

/** @internal */
export class ASTFunctionParameter extends ASTExpression {
  paramAST: ASTPrimitive | ASTReferenceOf;
  deviceType: DeviceType;
  writable: boolean;
  constructor(init: ASTPrimitive, deviceType: DeviceType) {
    super();
    this.paramAST = init;
    this.deviceType = deviceType;
    this.writable = false;
  }
  getType(): typeinfo.PBTypeInfo<typeinfo.TypeInfo> {
    return this.paramAST.getType();
  }
  markWritable(): void {
    if (this.paramAST instanceof ASTPrimitive) {
      if (this.deviceType === 'webgpu') {
        this.paramAST.value.$typeinfo = new typeinfo.PBPointerTypeInfo(this.paramAST.value.$typeinfo, typeinfo.PBAddressSpace.UNKNOWN);
      }
      this.paramAST = new ASTReferenceOf(this.paramAST);
    }
    this.writable = true;
  }
  isWritable(): boolean {
    return this.writable;
  }
  getAddressSpace(): typeinfo.PBAddressSpace {
    return this.paramAST.getAddressSpace();
  }
  isConstExp(): boolean {
    return this.paramAST.isConstExp();
  }
  isReference(): boolean {
    return this.paramAST.isReference();
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    return this.paramAST.toWebGL(indent, ctx);
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    return this.paramAST.toWebGL2(indent, ctx);
  }
  toWGSL(indent: string, ctx: ASTContext): string {
    return this.paramAST.toWGSL(indent, ctx);
  }
}

/** @internal */
export class ASTScope extends ShaderAST {
  statements: ShaderAST[];
  constructor() {
    super();
    this.statements = [];
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    return this.statements.filter(stmt => !(stmt instanceof ASTCallFunction) || stmt.isStatement).map(stmt => stmt.toWebGL(indent, ctx)).join('');
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    return this.statements.filter(stmt => !(stmt instanceof ASTCallFunction) || stmt.isStatement).map(stmt => stmt.toWebGL2(indent, ctx)).join('');
  }
  toWGSL(indent: string, ctx: ASTContext): string {
    return this.statements.filter(stmt => !(stmt instanceof ASTCallFunction) || stmt.isStatement).map(stmt => {
      if (stmt instanceof ASTCallFunction) {
        if (!stmt.getType().isVoidType()) {
          return `${indent}_ = ${stmt.toWGSL('', ctx)}`;
        }
      }
      return stmt.toWGSL(indent, ctx);
    }).join('');
  }
}

/** @internal */
export class ASTNakedScope extends ASTScope {
  toWebGL(indent: string, ctx: ASTContext): string {
    return `${indent}{\n${super.toWebGL(indent + ' ', ctx)}${indent}}\n`;
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    return `${indent}{\n${super.toWebGL2(indent + ' ', ctx)}${indent}}\n`;
  }
  toWGSL(indent: string, ctx: ASTContext): string {
    return `${indent}{\n${super.toWGSL(indent + ' ', ctx)}${indent}}\n`;
  }
}

/** @internal */
export class ASTGlobalScope extends ASTScope {
  uniforms: ASTDeclareVar[];
  constructor() {
    super();
    this.uniforms = [];
  }
  findFunction(name: string): ASTFunction {
    for (const stmt of this.statements) {
      if (stmt instanceof ASTFunction && stmt.name === name) {
        return stmt;
      }
    }
    return null;
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    // TODO: precision
    const precisions = `${indent}precision highp float;\n${indent}precision highp int;\n`;
    const version = `${indent}#version 100\n`;
    const body = ctx.types.map(val => val.toWebGL(indent, ctx)).join('')
      + this.uniforms.map(uniform => uniform.toWebGL(indent, ctx)).join('')
      + ctx.inputs.map(input => input.toWebGL(indent, ctx)).join('')
      + ctx.outputs.map(output => output.toWebGL(indent, ctx)).join('')
      + super.toWebGL(indent, ctx);
    for (const k of ctx.builtins) {
      const info = builtinVariables[DEVICE_TYPE_WEBGL][k];
      if (info.extension) {
        ctx.extensions.add(info.extension);
      }
    }
    const extensions = [...ctx.extensions].map(s => `${indent}#extension ${s}: enable\n`).join('');
    const defines = ctx.defines.join('');
    return version + extensions + precisions + defines + body;
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    const precisions = `${indent}precision highp float;\n${indent}precision highp int;\n`;
    const version = `${indent}#version 300 es\n`;
    const body = ctx.types.map(val => val.toWebGL2(indent, ctx)).join('')
      + this.uniforms.map(uniform => uniform.toWebGL2(indent, ctx)).join('')
      + ctx.inputs.map(input => input.toWebGL2(indent, ctx)).join('')
      + ctx.outputs.map(output => output.toWebGL2(indent, ctx)).join('')
      + super.toWebGL2(indent, ctx);
    for (const k of ctx.builtins) {
      const info = builtinVariables[DEVICE_TYPE_WEBGL2][k];
      if (info.extension) {
        ctx.extensions.add(info.extension);
      }
    }
    const extensions = [...ctx.extensions].map(s => `${indent}#extension ${s}: enable\n`).join('');
    const defines = ctx.defines.join('');
    return version + extensions + precisions + defines + body;
  }
  toWGSL(indent: string, ctx: ASTContext): string {
    const structNames = ctx.type === ShaderType.Vertex
      ? [BuiltinInputStructNameVS, BuiltinOutputStructNameVS]
      : ctx.type === ShaderType.Fragment
        ? [BuiltinInputStructNameFS, BuiltinOutputStructNameFS]
        : [BuiltinInputStructNameCS];
    const usedBuiltins: string[] = [];
    for (const k of ctx.builtins) {
      usedBuiltins.push(builtinVariables[DEVICE_TYPE_WEBGPU][k].name);
    }
    const allBuiltins = Object.keys(builtinVariables[DEVICE_TYPE_WEBGPU]).map(val => builtinVariables[DEVICE_TYPE_WEBGPU][val].name);
    for (const type of ctx.types) {
      if (type instanceof ASTStructDefine && structNames.indexOf(type.type.structName) >= 0) {
        for (let i = type.type.structMembers.length - 1; i >= 0; i--) {
          const member = type.type.structMembers[i];
          if (allBuiltins.indexOf(member.name) >= 0 && usedBuiltins.indexOf(member.name) < 0) {
            type.type.structMembers.splice(i, 1);
            type.prefix.splice(i, 1);
          }
        }
      }
    }
    ctx.types = ctx.types.filter(val => !(val instanceof ASTStructDefine) || val.type.structMembers.length > 0);
    return ctx.types.map(val => val.toWGSL(indent, ctx)).join('')
      + this.uniforms.map(uniform => uniform.toWGSL(indent, ctx)).join('')
      + super.toWGSL(indent, ctx);
  }
}

/** @internal */
export class ASTPrimitive extends ASTExpression {
  value: PBShaderExp;
  ref: ASTExpression;
  writable: boolean;
  constExp: boolean;
  constructor(value: PBShaderExp) {
    super();
    this.value = value;
    this.ref = null;
    this.writable = false;
    this.constExp = false;
  }
  get name(): string {
    return this.value.$str;
  }
  isReference(): boolean {
    return true;
  }
  isConstExp(): boolean {
    return this.constExp;
  }
  markWritable() {
    this.writable = true;
    this.constExp = false;
    if (this.ref) {
      this.ref.markWritable();
    }
  }
  isWritable(): boolean {
    return this.writable;
  }
  getAddressSpace(): typeinfo.PBAddressSpace {
    switch (this.value.$declareType) {
      case DeclareType.DECLARE_TYPE_UNIFORM:
        return typeinfo.PBAddressSpace.UNIFORM;
      case DeclareType.DECLARE_TYPE_STORAGE:
        return typeinfo.PBAddressSpace.STORAGE;
      case DeclareType.DECLARE_TYPE_IN:
      case DeclareType.DECLARE_TYPE_OUT:
        return null;
      default:
        return this.value.$global ? typeinfo.PBAddressSpace.PRIVATE : typeinfo.PBAddressSpace.FUNCTION;
    }
  }
  getType(): typeinfo.PBTypeInfo {
    return this.value.$typeinfo;
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    return this.name;
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    return this.name;
  }
  toWGSL(indent: string, ctx: ASTContext): string {
    if (this.value.$declareType === DeclareType.DECLARE_TYPE_IN) {
      const structName = getBuiltinInputStructInstanceName(ctx.type);
      return ctx.global[structName][this.name].$ast.toWGSL(indent, ctx);
    } else if (this.value.$declareType === DeclareType.DECLARE_TYPE_OUT) {
      const structName = getBuiltinOutputStructInstanceName(ctx.type);
      return ctx.global[structName][this.name].$ast.toWGSL(indent, ctx);
    } else {
      return this.name;
    }
  }
  toString(deviceType: DeviceType): string {
    return this.name;
  }
}

/** @internal */
export abstract class ASTLValue extends ShaderAST {
  abstract getType(): typeinfo.PBTypeInfo;
  abstract markWritable(): void;
  abstract isWritable(): boolean;
}

/** @internal */
export class ASTLValueScalar extends ASTLValue {
  value: ASTExpression;
  constructor(value: ASTExpression) {
    super();
    if (value.getAddressSpace() === typeinfo.PBAddressSpace.UNIFORM) {
      throw new errors.PBASTError(value, 'cannot assign to uniform variable');
    }
    this.value = value;
    if (this.value instanceof ASTCallFunction) {
      this.value.isStatement = false;
    }
  }
  getType(): typeinfo.PBTypeInfo {
    return this.value.getType();
  }
  markWritable(): void {
    this.value.markWritable();
  }
  isWritable(): boolean {
    return this.value.isWritable();
  }
  isReference(): boolean {
    return this.value.isReference();
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    return this.value.toWebGL(indent, ctx);
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    return this.value.toWebGL2(indent, ctx);
  }
  toWGSL(indent: string, ctx: ASTContext): string {
    return this.value.toWGSL(indent, ctx);
  }
  toString(deviceType: DeviceType): string {
    return this.value.toString(deviceType);
  }
}

/** @internal */
export class ASTLValueHash extends ASTLValue {
  scope: ASTLValueScalar | ASTLValueHash | ASTLValueArray;
  field: string;
  type: typeinfo.PBTypeInfo;
  constructor(scope: ASTLValueScalar | ASTLValueHash | ASTLValueArray, field: string, type: typeinfo.PBTypeInfo) {
    super();
    this.scope = scope;
    this.field = field;
    this.type = type;
  }
  getType(): typeinfo.PBTypeInfo {
    return this.type;
  }
  markWritable(): void {
    this.scope.markWritable();
  }
  isWritable(): boolean {
    return this.scope.isWritable();
  }
  isReference(): boolean {
    return this.scope.isReference();
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    return `${this.scope.toWebGL(indent, ctx)}.${this.field}`;
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    return `${this.scope.toWebGL2(indent, ctx)}.${this.field}`;
  }
  toWGSL(indent: string, ctx: ASTContext): string {
    const scope = this.scope.isPointer() ? new ASTReferenceOf(this.scope) : this.scope;
    return `${scope.toWGSL(indent, ctx)}.${this.field}`;
  }
  toString(deviceType: DeviceType): string {
    const scope = this.scope.isPointer() ? new ASTReferenceOf(this.scope) : this.scope;
    return `${scope.toString(deviceType)}.${this.field}`;
  }
}

/** @internal */
export class ASTLValueArray extends ASTLValue {
  value: ASTLValueScalar | ASTLValueHash | ASTLValueArray;
  index: ASTExpression;
  type: typeinfo.PBTypeInfo;
  constructor(value: ASTLValueScalar | ASTLValueHash | ASTLValueArray, index: ASTExpression, type: typeinfo.PBTypeInfo) {
    super();
    this.value = value;
    this.index = index;
    this.type = type;
    if (this.index instanceof ASTCallFunction) {
      this.index.isStatement = false;
    }
  }
  getType(): typeinfo.PBTypeInfo {
    return this.type;
  }
  markWritable(): void {
    this.value.markWritable();
  }
  isWritable(): boolean {
    return this.value.isWritable();
  }
  isReference(): boolean {
    return this.value.isReference();
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    return `${this.value.toWebGL(indent, ctx)}[${this.index.toWebGL(indent, ctx)}]`;
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    return `${this.value.toWebGL2(indent, ctx)}[${this.index.toWebGL2(indent, ctx)}]`;
  }
  toWGSL(indent: string, ctx: ASTContext): string {
    const value = this.value.isPointer() ? new ASTReferenceOf(this.value) : this.value;
    return `${value.toWGSL(indent, ctx)}[${this.index.toWGSL(indent, ctx)}]`;
  }
  toString(deviceType: DeviceType): string {
    const value = this.value.isPointer() ? new ASTReferenceOf(this.value) : this.value;
    return `${value.toString(deviceType)}[${this.index.toString(deviceType)}]`;
  }
}

/** @internal */
export class ASTLValueDeclare extends ASTLValue {
  value: ASTPrimitive;
  constructor(value: ASTPrimitive) {
    super();
    this.value = value;
    this.value.constExp = true;
  }
  getType(): typeinfo.PBTypeInfo {
    return this.value.getType();
  }
  markWritable(): void {
  }
  isWritable(): boolean {
    return false;
  }
  isReference(): boolean {
    return true;
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    let prefix = '';
    const builtin = false;
    switch (this.value.value.$declareType) {
      case DeclareType.DECLARE_TYPE_IN:
      case DeclareType.DECLARE_TYPE_OUT:
      case DeclareType.DECLARE_TYPE_UNIFORM:
      case DeclareType.DECLARE_TYPE_STORAGE:
        throw new Error('invalid declare type');
      default:
        prefix = this.value.constExp && !this.value.writable && !this.getType().isStructType() ? 'const ' : '';
        break;
    }
    if (!builtin) {
      return `${prefix}${this.getType().toTypeName('webgl', this.value.name)}`;
    }
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    let prefix = '';
    const builtin = false;
    switch (this.value.value.$declareType) {
      case DeclareType.DECLARE_TYPE_IN:
      case DeclareType.DECLARE_TYPE_OUT:
      case DeclareType.DECLARE_TYPE_UNIFORM:
      case DeclareType.DECLARE_TYPE_STORAGE:
        throw new Error('invalid declare type');
      default:
        prefix = this.value.constExp && !this.value.writable && !this.getType().isStructType() ? 'const ' : '';
        break;
    }
    if (!builtin) {
      return `${prefix}${this.getType().toTypeName('webgl2', this.value.name)}`;
    }
  }
  toWGSL(indent: string, ctx: ASTContext): string {
    let prefix: string;
    const builtin = false;
    switch (this.value.value.$declareType) {
      case DeclareType.DECLARE_TYPE_IN:
      case DeclareType.DECLARE_TYPE_OUT:
      case DeclareType.DECLARE_TYPE_UNIFORM:
      case DeclareType.DECLARE_TYPE_STORAGE:
        throw new Error('invalid declare type');
      default: {
        const addressSpace = this.value.getAddressSpace();
        const readonly = this.getType().isPointerType()
          || (!this.value.writable
            && (addressSpace === typeinfo.PBAddressSpace.PRIVATE || addressSpace === typeinfo.PBAddressSpace.FUNCTION));
        const moduleScope = addressSpace === typeinfo.PBAddressSpace.PRIVATE;
        const storageAccessMode = addressSpace === typeinfo.PBAddressSpace.STORAGE && this.value.writable ? ', read_write' : '';
        const decorator = addressSpace !== typeinfo.PBAddressSpace.FUNCTION ? `<${addressSpace}${storageAccessMode}>` : '';
        prefix = readonly ? moduleScope ? 'const ' : 'let ' : `var${decorator} `;
        break;
      }
    }
    if (!builtin) {
      // const decl = this.value.value.$global ? this.getType().toTypeName('webgpu', this.value.name) : this.value.name;
      const type = this.getType();
      if (type.isPointerType() && (this.value.writable || this.value.ref.isWritable())) {
        type.writable = true;
      }
      const decl = type.toTypeName('webgpu', this.value.name);
      return `${prefix}${decl}`;
    }
  }
  toString(deviceType: DeviceType): string {
    return this.value.toString(deviceType);
  }
}

/** @internal */
export class ASTShaderExpConstructor extends ASTExpression {
  type: typeinfo.PBTypeInfo;
  args: (number | boolean | ASTExpression)[];
  constExp: boolean;
  constructor(type: typeinfo.PBTypeInfo, args: (number | boolean | ASTExpression)[]) {
    super();
    this.type = type;
    this.args = args;
    this.constExp = true;
    for (const arg of args) {
      if (arg === null || arg === undefined) {
        throw new Error('invalid constructor argument');
      }
      if (arg instanceof ASTCallFunction) {
        arg.isStatement = false;
      }
      this.constExp &&= !(arg instanceof ASTExpression) || arg.isConstExp();
    }
  }
  getType(): typeinfo.PBTypeInfo {
    return this.type;
  }
  markWritable() {
  }
  isWritable(): boolean {
    return false;
  }
  isConstExp(): boolean {
    return this.constExp;
  }
  getAddressSpace(): typeinfo.PBAddressSpace {
    return null;
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    assert(!this.type.isArrayType(), 'array constructor not supported in webgl1 device', true);
    assert(this.type.isConstructible(), `type '${this.type.toTypeName('webgl')}' is not constructible`, true);
    const overloads = this.type.getConstructorOverloads('webgl');
    for (const overload of overloads) {
      const convertedArgs = convertArgs(this.args, overload);
      if (convertedArgs) {
        const c = convertedArgs.args.map(arg => unbracket(arg.toWebGL(indent, ctx))).join(',');
        return `${convertedArgs.name}(${c})`;
      }
    }
    throw new Error(`no matching overload function found for type ${this.type.toTypeName('webgl')}`);
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    assert(this.type.isConstructible(), `type '${this.type.toTypeName('webgl2')}' is not constructible`, true);
    const overloads = this.type.getConstructorOverloads('webgl2');
    for (const overload of overloads) {
      const convertedArgs = convertArgs(this.args, overload);
      if (convertedArgs) {
        const c = convertedArgs.args.map(arg => unbracket(arg.toWebGL2(indent, ctx))).join(',');
        return `${convertedArgs.name}(${c})`;
      }
    }
    throw new Error(`no matching overload function found for type ${this.type.toTypeName('webgl2')}`);
  }
  toWGSL(indent: string, ctx: ASTContext): string {
    assert(this.type.isConstructible(), `type '${this.type.toTypeName('webgpu')}' is not constructible`, true);
    const overloads = this.type.getConstructorOverloads('webgpu');
    for (const overload of overloads) {
      const convertedArgs = convertArgs(this.args, overload);
      if (convertedArgs) {
        const c = convertedArgs.args.map(arg => unbracket(arg.toWGSL(indent, ctx))).join(',');
        return `${convertedArgs.name}(${c})`;
      }
    }
    throw new Error(`no matching overload function found for type ${this.type.toTypeName('webgpu')}`);
  }
  toString(deviceType: DeviceType): string {
    return 'constructor';
  }
}

/** @internal */
export class ASTScalar extends ASTExpression {
  value: number | boolean;
  type: typeinfo.PBPrimitiveTypeInfo;
  constructor(value: number | boolean, type: typeinfo.PBPrimitiveTypeInfo) {
    super();
    this.value = value;
    this.type = type;
    const valueType = typeof value;
    if (valueType === 'number') {
      if (type.primitiveType === typeinfo.PBPrimitiveType.BOOL) {
        throw new errors.PBTypeCastError(value, valueType, type);
      }
      if (type.primitiveType === typeinfo.PBPrimitiveType.I32 && (!Number.isInteger(value) || value < (0x80000000 >> 0) || value > 0xFFFFFFFF)) {
        throw new errors.PBTypeCastError(value, valueType, type);
      }
      if (value < 0 && type.primitiveType === typeinfo.PBPrimitiveType.U32 && (!Number.isInteger(value) || value < 0 || value > 0xFFFFFFFF)) {
        throw new errors.PBTypeCastError(value, valueType, type);
      }
    } else if (type.primitiveType !== typeinfo.PBPrimitiveType.BOOL) {
      throw new errors.PBTypeCastError(value, valueType, type);
    }
  }
  getType(): typeinfo.PBTypeInfo {
    return this.type;
  }
  markWritable() {
  }
  isWritable(): boolean {
    return false;
  }
  isConstExp(): boolean {
    return true;
  }
  getAddressSpace(): typeinfo.PBAddressSpace {
    return null;
  }
  toWebGL(indent: string, ctx: ASTContext) {
    switch (this.type.primitiveType) {
      case typeinfo.PBPrimitiveType.F32:
        return toFixed(this.value as number);
      case typeinfo.PBPrimitiveType.I32:
        return toInt(this.value as number);
      case typeinfo.PBPrimitiveType.U32:
        return toUint(this.value as number);
      case typeinfo.PBPrimitiveType.BOOL:
        return String(!!this.value);
      default:
        throw new Error('Invalid scalar type');
    }
  }
  toWebGL2(indent: string, ctx: ASTContext) {
    switch (this.type.primitiveType) {
      case typeinfo.PBPrimitiveType.F32:
        return toFixed(this.value as number);
      case typeinfo.PBPrimitiveType.I32:
        return toInt(this.value as number);
      case typeinfo.PBPrimitiveType.U32:
        return toUint(this.value as number);
      case typeinfo.PBPrimitiveType.BOOL:
        return String(!!this.value);
      default:
        throw new Error('Invalid scalar type');
    }
  }
  toWGSL(indent: string, ctx: ASTContext) {
    switch (this.type.primitiveType) {
      case typeinfo.PBPrimitiveType.F32:
        return toFixed(this.value as number);
      case typeinfo.PBPrimitiveType.I32:
        return toInt(this.value as number);
      case typeinfo.PBPrimitiveType.U32:
        return `${toUint(this.value as number)}u`;
      case typeinfo.PBPrimitiveType.BOOL:
        return String(!!this.value);
      default:
        throw new Error('Invalid scalar type');
    }
  }
  toString(deviceType: DeviceType): string {
    return `${this.value}`;
  }
}

/** @internal */
export class ASTHash extends ASTExpression {
  source: ASTExpression;
  field: string;
  type: typeinfo.PBTypeInfo;
  constructor(source: ASTExpression, field: string, type: typeinfo.PBTypeInfo) {
    super();
    this.source = source;
    this.field = field;
    this.type = type;
    if (this.source instanceof ASTCallFunction) {
      this.source.isStatement = false;
    }
  }
  getType(): typeinfo.PBTypeInfo {
    return this.type;
  }
  isReference(): boolean {
    return this.source.isReference();
  }
  isConstExp(): boolean {
    return this.source.isConstExp();
  }
  markWritable() {
    this.source.markWritable();
  }
  isWritable(): boolean {
    return this.source.isWritable();
  }
  getAddressSpace(): typeinfo.PBAddressSpace {
    return this.source.getAddressSpace();
  }
  toWebGL(indent: string, ctx: ASTContext) {
    return `${this.source.toWebGL(indent, ctx)}.${this.field}`;
  }
  toWebGL2(indent: string, ctx: ASTContext) {
    return `${this.source.toWebGL2(indent, ctx)}.${this.field}`;
  }
  toWGSL(indent: string, ctx: ASTContext) {
    const source = this.source.isPointer() ? new ASTReferenceOf(this.source) : this.source;
    return `${source.toWGSL(indent, ctx)}.${this.field}`;
  }
  toString(deviceType: DeviceType): string {
    const source = this.source.isPointer() ? new ASTReferenceOf(this.source) : this.source;
    return `${source.toString(deviceType)}.${this.field}`;
  }
}

/** @internal */
export class ASTCast extends ASTExpression {
  sourceValue: ASTExpression;
  castType: typeinfo.PBTypeInfo;
  constructor(source: ASTExpression, type: typeinfo.PBTypeInfo) {
    super();
    this.sourceValue = source;
    this.castType = type;
    if (this.sourceValue instanceof ASTCallFunction) {
      this.sourceValue.isStatement = false;
    }
  }
  getType(): typeinfo.PBTypeInfo {
    return this.castType;
  }
  markWritable() {
  }
  isWritable(): boolean {
    return false;
  }
  isConstExp(): boolean {
    return this.sourceValue.isConstExp();
  }
  getAddressSpace(): typeinfo.PBAddressSpace {
    return null;
  }
  toWebGL(indent: string, ctx: ASTContext) {
    if (this.castType.typeId !== this.sourceValue.getType().typeId) {
      return `${this.castType.toTypeName('webgl')}(${unbracket(this.sourceValue.toWebGL(indent, ctx))})`;
    } else {
      return this.sourceValue.toWebGL(indent, ctx);
    }
  }
  toWebGL2(indent: string, ctx: ASTContext) {
    if (this.castType.typeId !== this.sourceValue.getType().typeId) {
      return `${this.castType.toTypeName('webgl2')}(${unbracket(this.sourceValue.toWebGL2(indent, ctx))})`;
    } else {
      return this.sourceValue.toWebGL2(indent, ctx);
    }
  }
  toWGSL(indent: string, ctx: ASTContext) {
    if (this.castType.typeId !== this.sourceValue.getType().typeId) {
      return `${this.castType.toTypeName('webgpu')}(${unbracket(this.sourceValue.toWGSL(indent, ctx))})`;
    } else {
      return this.sourceValue.toWGSL(indent, ctx);
    }
  }
  toString(deviceType: DeviceType): string {
    return `${this.castType.toTypeName(deviceType)}(${unbracket(this.sourceValue.toString(deviceType))})`;
  }
}

/** @internal */
export class ASTAddressOf extends ASTExpression {
  value: ASTExpression;
  type: typeinfo.PBTypeInfo;
  constructor(value: ASTExpression) {
    super();
    assert(value.isReference(), 'no pointer type for non-reference values', true);
    this.value = value;
    this.type = new typeinfo.PBPointerTypeInfo(value.getType(), value.getAddressSpace());
  }
  getType(): typeinfo.PBTypeInfo {
    return this.type;
  }
  isConstExp(): boolean {
    return false;
  }
  markWritable() {
    const addressSpace = this.value.getAddressSpace();
    if (addressSpace === typeinfo.PBAddressSpace.UNIFORM) {
      throw new errors.PBASTError(this.value, 'uniforms are not writable');
    }
    this.value.markWritable();
  }
  isWritable(): boolean {
    return this.value.isWritable();
  }
  getAddressSpace(): typeinfo.PBAddressSpace {
    return this.value.getAddressSpace();
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    throw new Error('GLSL does not support pointer type');
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    throw new Error('GLSL does not support pointer type');
  }
  toWGSL(indent: string, ctx: ASTContext) {
    const ast = this.value instanceof ASTFunctionParameter ? this.value.paramAST : this.value;
    return ast instanceof ASTReferenceOf ? ast.value.toWGSL(indent, ctx) : `(&${ast.toWGSL(indent, ctx)})`;
  }
  toString(deviceType: DeviceType): string {
    const ast = this.value instanceof ASTFunctionParameter ? this.value.paramAST : this.value;
    return ast instanceof ASTReferenceOf ? ast.value.toString(deviceType) : `(&${ast.toString(deviceType)})`;
  }
}

/** @internal */
export class ASTReferenceOf extends ASTExpression {
  value: ASTExpression | ASTLValue;
  constructor(value: ASTExpression | ASTLValue) {
    super();
    this.value = value;
    if (this.value instanceof ASTCallFunction) {
      this.value.isStatement = false;
    }
  }
  getType(): typeinfo.PBTypeInfo {
    const type = this.value.getType();
    return type.isPointerType() ? type.pointerType : type;
  }
  isReference(): boolean {
    return true;
  }
  markWritable() {
    this.value.markWritable();
  }
  isWritable(): boolean {
    return this.value.isWritable();
  }
  isConstExp(): boolean {
    return false;
  }
  getAddressSpace(): typeinfo.PBAddressSpace {
    return this.value instanceof ASTExpression ? this.value.getAddressSpace() : null;
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    return this.value.toWebGL(indent, ctx);
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    return this.value.toWebGL2(indent, ctx);
  }
  toWGSL(indent: string, ctx: ASTContext) {
    return this.value.getType().isPointerType() ? `(*${this.value.toWGSL(indent, ctx)})` : this.value.toWGSL(indent, ctx);
  }
  toString(deviceType: DeviceType): string {
    return `*${this.value.toString(deviceType)}`;
  }
}

/** @internal */
export class ASTUnaryFunc extends ASTExpression {
  value: ASTExpression;
  op: string;
  type: typeinfo.PBTypeInfo;
  constructor(value: ASTExpression, op: string, type: typeinfo.PBTypeInfo) {
    super();
    this.value = value;
    this.op = op;
    this.type = type;
    if (this.value instanceof ASTCallFunction) {
      this.value.isStatement = false;
    }
  }
  getType(): typeinfo.PBTypeInfo {
    return this.type;
  }
  markWritable() {
  }
  isWritable(): boolean {
    return false;
  }
  isConstExp(): boolean {
    return this.value.isConstExp();
  }
  getAddressSpace(): typeinfo.PBAddressSpace {
    return null;
  }
  toWebGL(indent: string, ctx: ASTContext) {
    return `${this.op}${this.value.toWebGL(indent, ctx)}`;
  }
  toWebGL2(indent: string, ctx: ASTContext) {
    return `${this.op}${this.value.toWebGL2(indent, ctx)}`;
  }
  toWGSL(indent: string, ctx: ASTContext) {
    const value = this.value.isPointer() ? new ASTReferenceOf(this.value) : this.value;
    return `${this.op}${value.toWGSL(indent, ctx)}`;
  }
  toString(deviceType: DeviceType): string {
    const value = this.value.isPointer() ? new ASTReferenceOf(this.value) : this.value;
    return `${this.op}${value.toString(deviceType)}`;
  }
}

/** @internal */
export class ASTBinaryFunc extends ASTExpression {
  left: ASTExpression;
  right: ASTExpression;
  type: typeinfo.PBTypeInfo;
  op: string;
  constructor(left: ASTExpression, right: ASTExpression, op: string, type: typeinfo.PBTypeInfo) {
    super();
    this.left = left;
    this.right = right;
    this.op = op;
    this.type = type;
    if (this.left instanceof ASTCallFunction) {
      this.left.isStatement = false;
    }
    if (this.right instanceof ASTCallFunction) {
      this.right.isStatement = false;
    }
  }
  getType(): typeinfo.PBTypeInfo {
    return this.type;
  }
  markWritable() {
  }
  isWritable(): boolean {
    return false;
  }
  isConstExp(): boolean {
    return this.left.isConstExp() && this.right.isConstExp();
  }
  getAddressSpace(): typeinfo.PBAddressSpace {
    return null;
  }
  toWebGL(indent: string, ctx: ASTContext) {
    return `(${this.left.toWebGL(indent, ctx)} ${this.op} ${this.right.toWebGL(indent, ctx)})`;
  }
  toWebGL2(indent: string, ctx: ASTContext) {
    return `(${this.left.toWebGL2(indent, ctx)} ${this.op} ${this.right.toWebGL2(indent, ctx)})`;
  }
  toWGSL(indent: string, ctx: ASTContext) {
    const left = this.left.isPointer() ? new ASTReferenceOf(this.left) : this.left;
    const right = this.right.isPointer() ? new ASTReferenceOf(this.right) : this.right;
    return `(${left.toWGSL(indent, ctx)} ${this.op} ${right.toWGSL(indent, ctx)})`;
  }
  toString(deviceType: DeviceType): string {
    const left = this.left.isPointer() ? new ASTReferenceOf(this.left) : this.left;
    const right = this.right.isPointer() ? new ASTReferenceOf(this.right) : this.right;
    return `(${left.toString(deviceType)} ${this.op} ${right.toString(deviceType)})`;
  }
}

/** @internal */
export class ASTArrayIndex extends ASTExpression {
  source: ASTExpression;
  index: ASTExpression;
  type: typeinfo.PBTypeInfo;
  constructor(source: ASTExpression, index: ASTExpression, type: typeinfo.PBTypeInfo) {
    super();
    this.source = source;
    this.index = index;
    this.type = type;
    if (this.source instanceof ASTCallFunction) {
      this.source.isStatement = false;
    }
    if (this.index instanceof ASTCallFunction) {
      this.index.isStatement = false;
    }
  }
  getType(): typeinfo.PBTypeInfo {
    return this.type;
  }
  isReference(): boolean {
    return this.source.isReference();
  }
  markWritable() {
    this.source.markWritable();
  }
  isWritable(): boolean {
    return this.source.isWritable();
  }
  isConstExp(): boolean {
    return this.source.isConstExp() && this.index.isConstExp();
  }
  getAddressSpace(): typeinfo.PBAddressSpace {
    return this.source.getAddressSpace();
  }
  toWebGL(indent: string, ctx: ASTContext) {
    return `${this.source.toWebGL(indent, ctx)}[${unbracket(this.index.toWebGL(indent, ctx))}]`;
  }
  toWebGL2(indent: string, ctx: ASTContext) {
    return `${this.source.toWebGL2(indent, ctx)}[${unbracket(this.index.toWebGL2(indent, ctx))}]`;
  }
  toWGSL(indent: string, ctx: ASTContext) {
    return `${this.source.toWGSL(indent, ctx)}[${unbracket(this.index.toWGSL(indent, ctx))}]`;
  }
  toString(deviceType: DeviceType): string {
    return `${this.source.toString(deviceType)}[${unbracket(this.index.toString(deviceType))}]`;
  }
}

/** @internal */
export class ASTTouch extends ShaderAST {
  value: ASTExpression;
  constructor(value: ASTExpression) {
    super();
    if (value.getType().isVoidType()) {
      throw new Error('can not touch void type');
    }
    if (value instanceof ASTCallFunction) {
      value.isStatement = false;
    }
    this.value = value;
  }
  toWebGL(indent: string, ctx: ASTContext) {
    return `${indent}${this.value.toWebGL('', ctx)};\n`;
  }
  toWebGL2(indent: string, ctx: ASTContext) {
    return `${indent}${this.value.toWebGL2('', ctx)};\n`;
  }
  toWGSL(indent: string, ctx: ASTContext) {
    if (!this.value.getType().isVoidType()) {
      return `${indent}_ = ${this.value.toWGSL('', ctx)};\n`;
    } else {
      return `${indent}${this.value.toWGSL('', ctx)};\n`;
    }
  }
}

/** @internal */
export class ASTAssignment extends ShaderAST {
  lvalue: ASTLValue;
  rvalue: ASTExpression | number | boolean;
  constructor(lvalue: ASTLValue, rvalue: ASTExpression | number | boolean) {
    super();
    if (!lvalue.isReference()) {
      throw new Error('assignment: l-value required');
    }
    this.lvalue = lvalue;
    this.rvalue = rvalue;
    if (!(this.lvalue instanceof ASTLValueDeclare)) {
      if (this.lvalue.getType().isPointerType()) {
        throw new errors.PBASTError(this.lvalue, 'cannot assign to read-only variable');
      }
      this.lvalue.markWritable();
    } else if (this.lvalue.getType().isPointerType()) {
      if (this.rvalue instanceof ASTPrimitive) {
        this.lvalue.value.ref = this.rvalue.ref;
      } else if (this.rvalue instanceof ASTAddressOf) {
        this.lvalue.value.ref = this.rvalue.value;
      } else {
        throw new errors.PBASTError(this.lvalue, 'invalid pointer assignment');
      }
    } else if (this.rvalue instanceof ASTExpression) {
      this.lvalue.value.constExp = this.rvalue.isConstExp();
    }
    if (this.rvalue instanceof ASTCallFunction) {
      this.rvalue.isStatement = false;
    }
  }
  getType(): typeinfo.PBTypeInfo {
    return null;
  }
  toWebGL(indent: string, ctx: ASTContext) {
    let rhs: string = null;
    const ltype = this.lvalue.getType();
    const rtype = this.checkScalarType(this.rvalue, ltype);
    if (ltype.typeId !== rtype.typeId) {
      throw new errors.PBTypeCastError(this.rvalue instanceof ASTExpression ? this.rvalue.toString('webgl') : `${this.rvalue}`, rtype, ltype);
    }
    if (typeof this.rvalue === 'number' || typeof this.rvalue === 'boolean') {
      rhs = (rtype as typeinfo.PBPrimitiveTypeInfo).primitiveType === typeinfo.PBPrimitiveType.F32 ? toFixed(this.rvalue as number) : String(this.rvalue);
    } else {
      rhs = unbracket(this.rvalue.toWebGL(indent, ctx));
    }
    if (this.lvalue instanceof ASTLValueDeclare) {
      this.lvalue.value.constExp &&= !(this.rvalue instanceof ASTExpression) || this.rvalue.isConstExp();
    }
    return `${indent}${this.lvalue.toWebGL(indent, ctx)} = ${rhs};\n`;
  }
  toWebGL2(indent: string, ctx: ASTContext) {
    let rhs: string = null;
    const ltype = this.lvalue.getType();
    const rtype = this.checkScalarType(this.rvalue, ltype);
    if (ltype.typeId !== rtype.typeId) {
      throw new errors.PBTypeCastError(this.rvalue instanceof ASTExpression ? this.rvalue.toString('webgl2') : `${this.rvalue}`, rtype, ltype);
    }
    if (typeof this.rvalue === 'number' || typeof this.rvalue === 'boolean') {
      rhs = (rtype as typeinfo.PBPrimitiveTypeInfo).primitiveType === typeinfo.PBPrimitiveType.F32 ? toFixed(this.rvalue as number) : String(this.rvalue);
    } else {
      rhs = unbracket(this.rvalue.toWebGL2(indent, ctx));
    }
    if (this.lvalue instanceof ASTLValueDeclare) {
      this.lvalue.value.constExp &&= !(this.rvalue instanceof ASTExpression) || this.rvalue.isConstExp();
    }
    return `${indent}${this.lvalue.toWebGL2(indent, ctx)} = ${rhs};\n`;
  }
  toWGSL(indent: string, ctx: ASTContext) {
    const ltype = this.lvalue.getType();
    const [valueTypeLeft, lvalueIsPtr] = ltype.isPointerType() ? [ltype.pointerType, true] : [ltype, false];
    const rtype = this.checkScalarType(this.rvalue, valueTypeLeft);
    const rvalueIsPtr = rtype && rtype.isPointerType();
    const valueTypeRight = rvalueIsPtr ? (rtype as typeinfo.PBPointerTypeInfo).pointerType : rtype;
    if (valueTypeLeft.typeId !== valueTypeRight.typeId) {
      throw new errors.PBTypeCastError(this.rvalue instanceof ASTExpression ? this.rvalue.toString('webgpu') : `${this.rvalue}`, rtype, ltype);
    }
    if (this.lvalue instanceof ASTLValueScalar || this.lvalue instanceof ASTLValueDeclare) {
      const structName = valueTypeLeft.isStructType() ? valueTypeLeft.structName : null;
      if (structName && ctx.types.findIndex(val => val instanceof ASTStructDefine && val.type.structName === structName) < 0) {
        return '';
      }
    }
    let rhs: string;
    if (typeof this.rvalue === 'number' || typeof this.rvalue === 'boolean') {
      rhs = (rtype as typeinfo.PBPrimitiveTypeInfo).primitiveType === typeinfo.PBPrimitiveType.F32 ? toFixed(this.rvalue as number) : String(this.rvalue);
    } else {
      rhs = unbracket(this.rvalue.toWGSL(indent, ctx));
    }
    const name = this.lvalue.toWGSL(indent, ctx);
    if (lvalueIsPtr && !rvalueIsPtr) {
      if (this.lvalue instanceof ASTLValueDeclare) {
        throw new Error(`rvalue must be pointer type: ${rhs}`);
      } else {
        return `${indent}*(${name}) = ${rhs};\n`;
      }
    } else if (rvalueIsPtr && !lvalueIsPtr) {
      return `${indent}${name} = *(${rhs});\n`
    } else {
      return `${indent}${name} = ${rhs};\n`;
    }
  }
  private checkScalarType(value: number | boolean | ASTExpression, targetType: typeinfo.PBTypeInfo): typeinfo.PBTypeInfo {
    if (value instanceof ASTExpression) {
      return value.getType();
    }
    const isBool = typeof value === 'boolean';
    const isInt = typeof value === 'number' && Number.isInteger(value) && value >= (0x80000000 >> 0) && value <= 0x7fffffff;
    const isUint = typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
    const isFloat = typeof value === 'number';
    if (targetType.isPrimitiveType()) {
      switch (targetType.primitiveType) {
        case typeinfo.PBPrimitiveType.BOOL:
          return isBool ? targetType : isInt ? typeinfo.typeI32 : isUint ? typeinfo.typeU32 : typeinfo.typeF32;
        case typeinfo.PBPrimitiveType.F32:
          return isFloat ? targetType : typeinfo.typeBool;
        case typeinfo.PBPrimitiveType.I32:
          return isInt ? targetType : isBool ? typeinfo.typeBool : isUint ? typeinfo.typeU32 : typeinfo.typeF32;
        case typeinfo.PBPrimitiveType.U32:
          return isUint ? targetType : isBool ? typeinfo.typeBool : isInt ? typeinfo.typeI32 : typeinfo.typeF32;
        default:
          return null;
      }
    } else {
      return isBool ? typeinfo.typeBool : isInt ? typeinfo.typeI32 : isUint ? typeinfo.typeU32 : typeinfo.typeF32;
    }
  }
}

/** @internal */
export class ASTDiscard extends ShaderAST {
  toWebGL(indent: string, ctx: ASTContext) {
    return `${indent}discard;\n`;
  }
  toWebGL2(indent: string, ctx: ASTContext) {
    return `${indent}discard;\n`;
  }
  toWGSL(indent: string, ctx: ASTContext) {
    return `${indent}discard;\n`;
  }
}

/** @internal */
export class ASTBreak extends ShaderAST {
  toWebGL(indent: string, ctx: ASTContext) {
    return `${indent}break;\n`
  }
  toWebGL2(indent: string, ctx: ASTContext) {
    return `${indent}break;\n`
  }
  toWGSL(indent: string, ctx: ASTContext) {
    return `${indent}break;\n`
  }
}

/** @internal */
export class ASTContinue extends ShaderAST {
  toWebGL(indent: string, ctx: ASTContext) {
    return `${indent}continue;\n`;
  }
  toWebGL2(indent: string, ctx: ASTContext) {
    return `${indent}continue;\n`;
  }
  toWGSL(indent: string, ctx: ASTContext) {
    return `${indent}continue;\n`
  }
}

/** @internal */
export class ASTReturn extends ShaderAST {
  value: ASTExpression;
  constructor(value: ASTExpression) {
    super();
    this.value = value;
    if (this.value instanceof ASTCallFunction) {
      this.value.isStatement = false;
    }
  }
  toWebGL(indent: string, ctx: ASTContext) {
    return this.value ? `${indent}return ${unbracket(this.value.toWebGL(indent, ctx))};\n` : `${indent}return;\n`;
  }
  toWebGL2(indent: string, ctx: ASTContext) {
    return this.value ? `${indent}return ${unbracket(this.value.toWebGL2(indent, ctx))};\n` : `${indent}return;\n`;
  }
  toWGSL(indent: string, ctx: ASTContext) {
    return this.value ? `${indent}return ${unbracket(this.value.toWGSL(indent, ctx))};\n` : `${indent}return;\n`;
  }
}

/** @internal */
export class ASTCallFunction extends ASTExpression {
  name: string;
  args: ASTExpression[];
  retType: typeinfo.PBTypeInfo;
  func: ASTFunction;
  isStatement: boolean;
  constructor(name: string, args: ASTExpression[], retType: typeinfo.PBTypeInfo, func: ASTFunction, deviceType: DeviceType) {
    super();
    this.name = name;
    this.args = args;
    this.retType = retType;
    this.func = func;
    this.isStatement = true;
    if (func) {
      if (func.args.length !== this.args.length) {
        throw new errors.PBInternalError(`ASTCallFunction(): number of parameters mismatch`);
      }
      for (let i = 0; i < this.args.length; i++) {
        const funcArg = func.args[i];
        if (funcArg.paramAST instanceof ASTReferenceOf) {
          if (deviceType === 'webgpu') {
            const argAddressSpace = args[i].getAddressSpace();
            if (argAddressSpace !== typeinfo.PBAddressSpace.FUNCTION && argAddressSpace !== typeinfo.PBAddressSpace.PRIVATE) {
              throw new errors.PBParamTypeError(name, 'pointer type of function parameter must be function or private');
            }
            const argType = funcArg.paramAST.value.getType();
            if (!argType.isPointerType()) {
              throw new errors.PBInternalError(`ASTCallFunction(): invalid reference type`);
            }
            if (argType.addressSpace === typeinfo.PBAddressSpace.UNKNOWN) {
              argType.addressSpace = argAddressSpace;
            } else if (argType.addressSpace !== argAddressSpace) {
              throw new errors.PBParamTypeError(name, `invalid pointer parameter address space '${argAddressSpace}', should be '${argType.addressSpace}`);
            }
          }
          this.args[i].markWritable();
        }
      }
    }
    for (const arg of this.args) {
      if (arg instanceof ASTCallFunction) {
        arg.isStatement = false;
      }
    }
  }
  getType(): typeinfo.PBTypeInfo {
    return this.retType;
  }
  isConstExp(): boolean {
    return false;
  }
  markWritable() {
  }
  isWritable(): boolean {
    return false;
  }
  getAddressSpace(): typeinfo.PBAddressSpace {
    return null;
  }
  toWebGL(indent: string, ctx: ASTContext) {
    if (this.name === 'dFdx' || this.name === 'dFdy' || this.name === 'fwidth') {
      ctx.extensions.add('GL_OES_standard_derivatives');
    } else if (this.name === 'texture2DLodEXT' || this.name === 'texture2DProjLodEXT' || this.name === 'textureCubeLodEXT' || this.name === 'texture2DGradEXT' || this.name === 'texture2DProjGradEXT' || this.name === 'textureCubeGradEXT') {
      ctx.extensions.add('GL_EXT_shader_texture_lod');
    }
    const args = this.args.map(arg => unbracket(arg.toWebGL(indent, ctx)));
    return `${this.isStatement ? indent : ''}${this.name}(${args.join(',')})${this.isStatement ? ';\n' : ''}`;
  }
  toWebGL2(indent: string, ctx: ASTContext) {
    const args = this.args.map(arg => unbracket(arg.toWebGL2(indent, ctx)));
    return `${this.isStatement ? indent : ''}${this.name}(${args.join(',')})${this.isStatement ? ';\n' : ''}`;
  }
  toWGSL(indent: string, ctx: ASTContext) {
    let thisArgs = this.args.filter(val => {
      const type = val.getType();
      if ((val instanceof ASTPrimitive)
        && type.isStructType()
        && ctx.types.findIndex(t => (t instanceof ASTStructDefine) && t.type.structName === type.structName) < 0) {
        return false;
      }
      return true;
    });
    const overloads = ctx.global.$getFunction(this.name)?.overloads;
    if (overloads) {
      let argsNew: ASTExpression[];
      for (const overload of overloads) {
        const convertedArgs = convertArgs(thisArgs, overload);
        if (convertedArgs) {
          argsNew = convertedArgs.args;
          break;
        }
      }
      if (!argsNew) {
        throw new Error(`no matching overloading found for function '${this.name}'`);
      }
      thisArgs = argsNew;
    }
    const args = thisArgs.map(arg => unbracket(arg.toWGSL(indent, ctx)));
    return `${this.isStatement ? indent : ''}${this.name}(${args.join(',')})${this.isStatement ? ';\n' : ''}`;
  }
  toString(deviceType: DeviceType): string {
    return `${this.name}(...)`;
  }
}

/** @internal */
export class ASTDeclareVar extends ShaderAST {
  value: ASTPrimitive;
  group: number;
  binding: number;
  blockName: string;
  constructor(exp: ASTPrimitive) {
    super();
    this.value = exp;
    this.group = 0;
    this.binding = 0;
  }
  isReference(): boolean {
    return true;
  }
  isPointer(): boolean {
    return this.value.getType().isPointerType();
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    let prefix = '';
    let builtin = false;
    let valueType = this.value.getType();
    switch (this.value.value.$declareType) {
      case DeclareType.DECLARE_TYPE_IN:
        if (ctx.type === ShaderType.Vertex) {
          prefix = 'attribute ';
          ctx.defines.push(`#define ${this.value.name} ${semanticToAttrib(ctx.vertexAttributes[this.value.value.$location])}\n`);
        } else {
          prefix = 'varying ';
          // ctx.defines.push(`#define ${this.value.$str} ch_varying_${this.value.$location}\n`);
        }
        break;
      case DeclareType.DECLARE_TYPE_OUT:
        if (ctx.type === ShaderType.Vertex) {
          prefix = 'varying ';
          // ctx.defines.push(`#define ${this.value.$str} ch_varying_${this.value.$location}\n`);
        } else {
          builtin = true;
          if (ctx.mrt) {
            ctx.defines.push(`#define ${this.value.name} gl_FragData[${this.value.value.$location}]\n`);
            ctx.extensions.add('GL_EXT_draw_buffers');
          } else {
            ctx.defines.push(`#define ${this.value.name} gl_FragColor\n`);
          }
        }
        break;
      case DeclareType.DECLARE_TYPE_UNIFORM:
        prefix = 'uniform ';
        valueType = ctx.typeReplacement?.get(this.value.value) || valueType;
        break;
      case DeclareType.DECLARE_TYPE_STORAGE:
        throw new Error(`invalid variable declare type: ${this.value.name}`)
    }
    if (!builtin) {
      return `${indent}${prefix}${valueType.toTypeName('webgl', this.value.name)};\n`;
    }
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    let prefix = '';
    const builtin = false;
    let valueType = this.value.getType();
    switch (this.value.value.$declareType) {
      case DeclareType.DECLARE_TYPE_IN:
        prefix = 'in ';
        if (ctx.type === ShaderType.Vertex) {
          ctx.defines.push(`#define ${this.value.name} ${semanticToAttrib(ctx.vertexAttributes[this.value.value.$location])}\n`);
        } else {
          // ctx.defines.push(`#define ${this.value.$str} ch_varying_${this.value.$location}\n`);
        }
        break;
      case DeclareType.DECLARE_TYPE_OUT:
        prefix = 'out ';
        if (ctx.type === ShaderType.Vertex) {
          // ctx.defines.push(`#define ${this.value.$str} ch_varying_${this.value.$location}\n`);
        } else {
          prefix = `layout(location = ${this.value.value.$location}) out `;
        }
        break;
      case DeclareType.DECLARE_TYPE_UNIFORM:
        if (valueType.isStructType()) {
          if (valueType.layout !== 'std140') {
            throw new errors.PBASTError(this, 'uniform buffer layout must be std140');
          }
          return `${indent}layout(std140) uniform ${this.blockName} { ${valueType.structName} ${this.value.name}; };\n`;
        } else {
          valueType = ctx.typeReplacement?.get(this.value.value) || valueType;
          return `${indent}uniform ${valueType.toTypeName('webgl2', this.value.name)};\n`;
        }
        break;
      case DeclareType.DECLARE_TYPE_STORAGE:
        throw new Error(`invalid variable declare type: ${this.value.name}`);
    }
    if (!builtin) {
      return `${indent}${prefix}${this.value.getType().toTypeName('webgl2', this.value.name)};\n`;
    }
  }
  toWGSL(indent: string, ctx: ASTContext): string {
    let prefix: string;
    const builtin = false;
    const isBlock = this.value.getType().isPrimitiveType() || this.value.getType().isStructType() || this.value.getType().isArrayType();
    switch (this.value.value.$declareType) {
      case DeclareType.DECLARE_TYPE_IN:
      case DeclareType.DECLARE_TYPE_OUT:
        // prefix = `@location(${this.value.value.$location}) var<out> `;
        throw new Error(`Internal error`);
      case DeclareType.DECLARE_TYPE_UNIFORM:
        prefix = `@group(${this.group}) @binding(${this.binding}) var${isBlock ? '<uniform>' : ''} `;
        break;
      case DeclareType.DECLARE_TYPE_STORAGE:
        prefix = `@group(${this.group}) @binding(${this.binding}) var<storage, ${this.value.writable ? 'read_write' : 'read'}> `;
        break;
      case DeclareType.DECLARE_TYPE_WORKGROUP:
        prefix = `var<workgroup> `;
        break;
      default:
        prefix = `${this.value.getType().isPointerType() ? 'let' : 'var'}${this.value.value.$global && !this.value.getType().isPointerType() ? '<private>' : ''} `;
    }
    if (!builtin) {
      const type = this.value.getType();
      const structName = type.isStructType() ? type.structName : null;
      if (structName && ctx.types.findIndex(val => val instanceof ASTStructDefine && val.type.structName === structName) < 0) {
        return '';
      } else {
        return `${indent}${prefix}${type.toTypeName('webgpu', this.value.name)};\n`;
      }
    }
  }
  toString(deviceType: DeviceType): string {
    return this.value.toString(deviceType);
  }
}

/** @internal */
export class ASTFunction extends ASTScope {
  isBuiltin: boolean;
  isMainFunc: boolean;
  name: string;
  returnType: typeinfo.PBTypeInfo;
  args: ASTFunctionParameter[];
  funcOverloads: typeinfo.PBFunctionTypeInfo[];
  builtins: string[];
  constructor(name: string, args: ASTFunctionParameter[], isMainFunc: boolean, isBuiltin = false, overloads: typeinfo.PBFunctionTypeInfo[] = null) {
    super();
    this.name = name;
    this.returnType = undefined;
    this.args = args;
    this.args.forEach(arg => {
      if (!(arg instanceof ASTFunctionParameter)) {
        throw new Error('invalid function argument type');
      }
    });
    this.builtins = [];
    this.isBuiltin = isBuiltin;
    this.isMainFunc = isMainFunc;
    this.funcOverloads = null;
  }
  get overloads(): typeinfo.PBFunctionTypeInfo[] {
    return this.getOverloads();
  }
  toWebGL(indent: string, ctx: ASTContext) {
    if (!this.isBuiltin) {
      let str = '';
      const p: string[] = [];
      for (const param of this.args) {
        let exp: PBShaderExp;
        let name: string;
        let qualifier: string;
        if (param.paramAST instanceof ASTPrimitive) {
          exp = param.paramAST.value;
          name = param.paramAST.name;
          qualifier = '';
        } else {
          exp = (param.paramAST.value as ASTPrimitive).value;
          name = (param.paramAST.value as ASTPrimitive).name;
          qualifier = 'inout ';
        }
        p.push(`${qualifier}${param.getType().toTypeName('webgl', name)}`);
      }
      str += `${indent}${this.returnType.toTypeName('webgl')} ${this.name}(${p.join(',')}) {\n`;
      str += super.toWebGL(indent + '  ', ctx);
      str += `${indent}}\n`;
      return str;
    } else {
      return '';
    }
  }
  toWebGL2(indent: string, ctx: ASTContext) {
    if (!this.isBuiltin) {
      let str = '';
      const p: string[] = [];
      for (const param of this.args) {
        let exp: PBShaderExp;
        let name: string;
        let qualifier: string;
        if (param.paramAST instanceof ASTPrimitive) {
          exp = param.paramAST.value;
          name = param.paramAST.name;
          qualifier = '';
        } else {
          exp = (param.paramAST.value as ASTPrimitive).value;
          name = (param.paramAST.value as ASTPrimitive).name;
          qualifier = 'inout ';
        }
        p.push(`${qualifier}${param.getType().toTypeName('webgl2', name)}`);
      }
      str += `${indent}${this.returnType.toTypeName('webgl2')} ${this.name}(${p.join(',')}) {\n`;
      str += super.toWebGL2(indent + '  ', ctx);
      str += `${indent}}\n`;
      return str;
    } else {
      return '';
    }
  }
  toWGSL(indent: string, ctx: ASTContext) {
    if (!this.isBuiltin) {
      let str = '';
      const p: string[] = [...this.builtins];
      for (const param of this.args) {
        const name = param.paramAST instanceof ASTPrimitive ? param.paramAST.name : (param.paramAST.value as ASTPrimitive).name;
        const paramType = param.paramAST instanceof ASTPrimitive ? param.paramAST.getType() : (param.paramAST.value as ASTPrimitive).getType();
        const dataType = paramType.isPointerType() ? paramType.pointerType : paramType;
        if (dataType.isStructType() && ctx.types.findIndex(t => (t instanceof ASTStructDefine) && t.type.structName === dataType.structName) < 0) {
          continue;
        }
        p.push(`${paramType.toTypeName('webgpu', name)}`);
      }
      let t = '';
      if (this.isMainFunc) {
        switch (ctx.type) {
          case ShaderType.Vertex: t = '@vertex '; break;
          case ShaderType.Fragment: t = '@fragment '; break;
          case ShaderType.Compute: t = `@compute @workgroup_size(${ctx.workgroupSize[0]}, ${ctx.workgroupSize[1]}, ${ctx.workgroupSize[2]}) `; break;
        }
      }
      const retName = this.returnType.isVoidType() ? null : this.returnType.toTypeName('webgpu');
      const retStr = retName ? ` -> ${retName}` : '';
      str += `${indent}${t}fn ${this.name}(${p.join(',')})${retStr} {\n`;
      str += super.toWGSL(indent + '  ', ctx);
      str += `${indent}}\n`;
      return str;
    } else {
      return '';
    }
  }
  private getOverloads(): typeinfo.PBFunctionTypeInfo[] {
    if (!this.funcOverloads && this.args) {
      this.funcOverloads = this.args ? [new typeinfo.PBFunctionTypeInfo(this.name, this.returnType, this.args.map(arg => {
        return {
          type: arg.paramAST.getType(),
          byRef: arg.paramAST instanceof ASTReferenceOf
        };
      }))] : [];
    }
    return this.funcOverloads;
  }
}

/** @internal */
export class ASTIf extends ASTScope {
  keyword: string;
  condition: ASTExpression;
  nextElse: ASTIf;
  constructor(keyword: string, condition: ASTExpression) {
    super();
    this.keyword = keyword;
    this.condition = condition;
    this.nextElse = null;
    if (this.condition instanceof ASTCallFunction) {
      this.condition.isStatement = false;
    }
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    let str = `${indent}${this.keyword} ${this.condition ? '(' + unbracket(this.condition.toWebGL(indent, ctx)) + ')' : ''} {\n`;
    str += super.toWebGL(indent + '  ', ctx);
    str += `${indent}}\n`;
    if (this.nextElse) {
      str += this.nextElse.toWebGL(indent, ctx);
    }
    return str;
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    let str = `${indent}${this.keyword} ${this.condition ? '(' + unbracket(this.condition.toWebGL2(indent, ctx)) + ')' : ''} {\n`;
    str += super.toWebGL2(indent + '  ', ctx);
    str += `${indent}}\n`;
    if (this.nextElse) {
      str += this.nextElse.toWebGL2(indent, ctx);
    }
    return str;
  }
  toWGSL(indent: string, ctx: ASTContext): string {
    let str = `${indent}${this.keyword} ${this.condition ? '(' + unbracket(this.condition.toWGSL(indent, ctx)) + ')' : ''} {\n`;
    str += super.toWGSL(indent + '  ', ctx);
    str += `${indent}}\n`;
    if (this.nextElse) {
      str += this.nextElse.toWGSL(indent, ctx);
    }
    return str;
  }
}

/** @internal */
export class ASTRange extends ASTScope {
  init: ASTPrimitive;
  start: ASTExpression;
  end: ASTExpression;
  open: boolean;
  constructor(init: ASTPrimitive, start: ASTExpression, end: ASTExpression, open: boolean) {
    super();
    this.init = init;
    this.start = start;
    this.end = end;
    this.open = open;
    this.statements = [];
    if (this.start instanceof ASTCallFunction) {
      this.start.isStatement = false;
    }
    if (this.end instanceof ASTCallFunction) {
      this.end.isStatement = false;
    }
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    const init = this.init.getType().toTypeName('webgl', this.init.name);
    const start = unbracket(this.start.toWebGL(indent, ctx));
    const end = unbracket(this.end.toWebGL(indent, ctx));
    const comp = this.open ? '<' : '<=';
    let str = `${indent}for (${init} = ${start}; ${this.init.name} ${comp} ${end}; ${this.init.name}++) {\n`;
    str += super.toWebGL(indent + '  ', ctx);
    str += `${indent}}\n`;
    return str;
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    const init = this.init.getType().toTypeName('webgl2', this.init.name);
    const start = unbracket(this.start.toWebGL2(indent, ctx));
    const end = unbracket(this.end.toWebGL2(indent, ctx));
    const comp = this.open ? '<' : '<=';
    let str = `${indent}for (${init} = ${start}; ${this.init.name} ${comp} ${end}; ${this.init.name}++) {\n`;
    str += super.toWebGL2(indent + '  ', ctx);
    str += `${indent}}\n`;
    return str;
  }
  toWGSL(indent: string, ctx: ASTContext): string {
    const init = `var ${this.init.getType().toTypeName('webgpu', this.init.name)}`;
    const start = unbracket(this.start.toWGSL(indent, ctx));
    const end = unbracket(this.end.toWGSL(indent, ctx));
    const incr = new ASTScalar(1, this.init.getType() as typeinfo.PBPrimitiveTypeInfo).toWGSL(indent, ctx);
    const comp = this.open ? '<' : '<=';
    let str = `${indent}for (${init} = ${start}; ${this.init.name} ${comp} ${end}; ${this.init.name} = ${this.init.name} + ${incr}) {\n`;
    str += super.toWGSL(indent + '  ', ctx);
    str += `${indent}}\n`;
    return str;
  }
}

/** @internal */
export class ASTDoWhile extends ASTScope {
  condition: ASTExpression;
  constructor(condition: ASTExpression) {
    super();
    this.condition = condition;
    if (this.condition instanceof ASTCallFunction) {
      this.condition.isStatement = false;
    }
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    let str = `${indent}do {\n`;
    str += super.toWebGL(indent + ' ', ctx);
    str += `${indent}} while(${unbracket(this.condition.toWebGL(indent, ctx))});\n`;
    return str;
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    let str = `${indent}do {\n`;
    str += super.toWebGL2(indent + ' ', ctx);
    str += `${indent}} while(${unbracket(this.condition.toWebGL2(indent, ctx))});\n`;
    return str;
  }
  toWGSL(indent: string, ctx: ASTContext): string {
    let str = `${indent}loop {\n`;
    str += super.toWGSL(indent + ' ', ctx);
    str += `${indent}  if (!(${unbracket(this.condition.toWGSL(indent, ctx))})) { break; }\n`;
    str += `${indent}}\n`;
    return str;
  }
}

/** @internal */
export class ASTWhile extends ASTScope {
  condition: ASTExpression;
  constructor(condition: ASTExpression) {
    super();
    this.condition = condition;
    if (this.condition instanceof ASTCallFunction) {
      this.condition.isStatement = false;
    }
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    let str = `${indent}while(${unbracket(this.condition.toWebGL(indent, ctx))}) {\n`;
    str += super.toWebGL(indent + '  ', ctx);
    str += `${indent}}\n`;
    return str;
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    let str = `${indent}while(${unbracket(this.condition.toWebGL2(indent, ctx))}) {\n`;
    str += super.toWebGL2(indent + '  ', ctx);
    str += `${indent}}\n`;
    return str;
  }
  toWGSL(indent: string, ctx: ASTContext): string {
    let str = `${indent}loop {\n`;
    str += `${indent}  if (!(${unbracket(this.condition.toWGSL(indent, ctx))})) { break; }\n`;
    str += super.toWGSL(indent + ' ', ctx);
    str += `${indent}}\n`;
    return str;
  }
}

/** @internal */
export class ASTStructDefine extends ShaderAST {
  type: typeinfo.PBStructTypeInfo;
  prefix: string[];
  builtin: boolean;
  constructor(type: typeinfo.PBStructTypeInfo, builtin: boolean) {
    super();
    this.prefix = null;
    this.builtin = builtin;
    this.type = type;
  }
  getType(): typeinfo.PBStructTypeInfo {
    return this.type;
  }
  toWebGL(indent: string, ctx: ASTContext): string {
    if (!this.builtin) {
      let str = `${indent}struct ${this.type.structName} {\n`;
      for (const arg of this.type.structMembers) {
        str += `${indent}  ${arg.type.toTypeName('webgl', arg.name)};\n`;
      }
      str += `${indent}};\n`;
      return str;
    } else {
      return '';
    }
  }
  toWebGL2(indent: string, ctx: ASTContext): string {
    if (!this.builtin) {
      let str = `${indent}struct ${this.type.structName} {\n`;
      for (const arg of this.type.structMembers) {
        str += `${indent}  ${arg.type.toTypeName('webgl2', arg.name)};\n`;
      }
      str += `${indent}};\n`;
      return str;
    } else {
      return '';
    }
  }
  toWGSL(indent: string, ctx: ASTContext): string {
    if (!this.builtin) {
      let str = `${indent}struct ${this.type.structName} {\n`;
      str += this.type.structMembers.map((arg, i) => {
        const prefix = this.prefix ? this.prefix[i] : '';
        const sizePrefix = arg.type.getLayoutSize(this.type.layout) !== arg.type.getLayoutSize('default') ? `@size(${arg.type.getLayoutSize(this.type.layout)}) ` : '';
        const alignPrefix = i > 0 && arg.type.getLayoutAlignment(this.type.layout) !== arg.type.getLayoutAlignment('default') ? `@align(${arg.type.getLayoutAlignment(this.type.layout)}) ` : '';
        return `${indent}  ${prefix}${alignPrefix}${sizePrefix}${arg.type.toTypeName('webgpu', arg.name)}`;
      }).join(',\n');
      str += `\n${indent}};\n`;
      return str;
    } else {
      return '';
    }
  }
}

function convertArgs(args: (number | boolean | ASTExpression)[], overload: typeinfo.PBFunctionTypeInfo): { name: string, args: ASTExpression[] } {
  if (args.length !== overload.argTypes.length) {
    return null;
  }
  const result: ASTExpression[] = [];
  for (let i = 0; i < args.length; i++) {
    const isRef = !!overload.argTypes[i].byRef;
    const argType = overload.argTypes[i].type;
    const arg = args[i];
    if (typeof arg === 'number') {
      if (!isRef && argType.isPrimitiveType() && argType.isScalarType() && argType.primitiveType !== typeinfo.PBPrimitiveType.BOOL) {
        result.push(new ASTScalar(arg, argType))
      } else {
        return null;
      }
    } else if (typeof arg === 'boolean') {
      if (!isRef && argType.isPrimitiveType() && argType.primitiveType === typeinfo.PBPrimitiveType.BOOL) {
        result.push(new ASTScalar(arg, argType));
      } else {
        return null;
      }
    } else if (argType.typeId === arg.getType().typeId) {
      if (isRef) {
        arg.markWritable();
        result.push(new ASTAddressOf(arg));
      } else {
        result.push(arg);
      }
    } else {
      return null;
    }
  }
  return { name: overload.name, args: result };
}

