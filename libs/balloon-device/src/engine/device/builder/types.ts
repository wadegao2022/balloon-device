import { TextureFormat } from '../base_types';
import { DeviceType } from '../device';
import { assert } from '../../../shared';
import type { UniformBufferLayout } from '../gpuobject';

export const F16_BITMASK = 1
export const F32_BITMASK = 2;
export const BOOL_BITMASK = 3;
export const I8_BITMASK = 4;
export const I16_BITMASK = 5;
export const I32_BITMASK = 6;
export const U8_BITMASK = 7;
export const U16_BITMASK = 8;
export const U32_BITMASK = 9;
export const SCALAR_TYPE_BITMASK = 15;
export const ROWS_BITMASK = 7;
export const ROWS_BITSHIFT = 4;
export const COLS_BITMASK = 7;
export const COLS_BITSHIFT = 7;
export const NORM_BITMASK = 1;
export const NORM_BITSHIFT = 10;

type LayoutableType = PBPrimitiveTypeInfo | PBArrayTypeInfo | PBStructTypeInfo;

export interface ILayoutableType {
  getLayoutAlignment(layout: PBStructLayout): number;
  getLayoutSize(layout: PBStructLayout): number
}

function align(n: number, alignment: number): number {
  return (n + alignment - 1) & ~(alignment - 1);
}

function getAlignment(type: LayoutableType): number {
  if (type.isPrimitiveType()) {
    return type.isScalarType() ? 4 : 1 << Math.min(4, (type.cols + 1));
  } else if (type.isArrayType()) {
    return getAlignment(type.elementType);
  } else {
    let alignment = 0;
    for (const member of type.structMembers) {
      alignment = Math.max(alignment, getAlignment(member.type));
    }
    return alignment;
  }
}
function getAlignmentPacked(type: LayoutableType): number {
  return 1;
}
function getSize(type: LayoutableType): number {
  if (type.isPrimitiveType()) {
    return type.isMatrixType()
      ? type.rows * getAlignment(PBPrimitiveTypeInfo.getCachedTypeInfo(type.resizeType(1, type.cols)))
      : 4 * type.cols;
  } else if (type.isArrayType()) {
    return type.dimension * align(getSize(type.elementType), getAlignment(type.elementType));
  } else {
    let size = 0;
    let structAlignment = 0;
    for (const member of type.structMembers) {
      const memberAlignment = getAlignment(member.type);
      size = align(size, memberAlignment);
      size += getSize(member.type);
      structAlignment = Math.max(structAlignment, memberAlignment);
    }
    return align(size, structAlignment);
  }
}
function getSizePacked(type: LayoutableType): number {
  if (type.isPrimitiveType()) {
    let scalarSize: number;
    switch (type.scalarType) {
      case PBPrimitiveType.U8:
      case PBPrimitiveType.U8_NORM:
      case PBPrimitiveType.I8:
      case PBPrimitiveType.I8_NORM:
        scalarSize = 1;
        break;
      case PBPrimitiveType.F16:
      case PBPrimitiveType.I16:
      case PBPrimitiveType.I16_NORM:
      case PBPrimitiveType.U16:
      case PBPrimitiveType.U16_NORM:
        scalarSize = 2;
        break;
      default:
        scalarSize = 4;
        break;
    }
    return type.rows * type.cols * scalarSize;
  } else if (type.isArrayType()) {
    return type.dimension * getSizePacked(type.elementType);
  } else {
    let size = 0;
    for (const member of type.structMembers) {
      size += getSizePacked(member.type);
    }
    return size;
  }
}

export function makePrimitiveType(scalarTypeMask: number, rows: number, cols: number, norm: 0 | 1): PBPrimitiveType {
  return scalarTypeMask | (rows << ROWS_BITSHIFT) | (cols << COLS_BITSHIFT) | (norm << NORM_BITSHIFT);
}

function typeToTypedArray(type: LayoutableType): PBPrimitiveType {
  if (type.isPrimitiveType()) {
    return type.scalarType;
  } else if (type.isArrayType()) {
    return typeToTypedArray(type.elementType);
  } else {
    return PBPrimitiveType.U8;
  }
}

export type PBStructLayout = 'default' | 'std140' | 'packed';

export enum PBPrimitiveType {
  NONE = 0,
  F16 = makePrimitiveType(F16_BITMASK, 1, 1, 0),
  F16VEC2 = makePrimitiveType(F16_BITMASK, 1, 2, 0),
  F16VEC3 = makePrimitiveType(F16_BITMASK, 1, 3, 0),
  F16VEC4 = makePrimitiveType(F16_BITMASK, 1, 4, 0),
  F32 = makePrimitiveType(F32_BITMASK, 1, 1, 0),
  F32VEC2 = makePrimitiveType(F32_BITMASK, 1, 2, 0),
  F32VEC3 = makePrimitiveType(F32_BITMASK, 1, 3, 0),
  F32VEC4 = makePrimitiveType(F32_BITMASK, 1, 4, 0),
  BOOL = makePrimitiveType(BOOL_BITMASK, 1, 1, 0),
  BVEC2 = makePrimitiveType(BOOL_BITMASK, 1, 2, 0),
  BVEC3 = makePrimitiveType(BOOL_BITMASK, 1, 3, 0),
  BVEC4 = makePrimitiveType(BOOL_BITMASK, 1, 4, 0),
  I8 = makePrimitiveType(I8_BITMASK, 1, 1, 0),
  I8VEC2 = makePrimitiveType(I8_BITMASK, 1, 2, 0),
  I8VEC3 = makePrimitiveType(I8_BITMASK, 1, 3, 0),
  I8VEC4 = makePrimitiveType(I8_BITMASK, 1, 4, 0),
  I8_NORM = makePrimitiveType(I8_BITMASK, 1, 1, 1),
  I8VEC2_NORM = makePrimitiveType(I8_BITMASK, 1, 2, 1),
  I8VEC3_NORM = makePrimitiveType(I8_BITMASK, 1, 3, 1),
  I8VEC4_NORM = makePrimitiveType(I8_BITMASK, 1, 4, 1),
  I16 = makePrimitiveType(I16_BITMASK, 1, 1, 0),
  I16VEC2 = makePrimitiveType(I16_BITMASK, 1, 2, 0),
  I16VEC3 = makePrimitiveType(I16_BITMASK, 1, 3, 0),
  I16VEC4 = makePrimitiveType(I16_BITMASK, 1, 4, 0),
  I16_NORM = makePrimitiveType(I16_BITMASK, 1, 1, 1),
  I16VEC2_NORM = makePrimitiveType(I16_BITMASK, 1, 2, 1),
  I16VEC3_NORM = makePrimitiveType(I16_BITMASK, 1, 3, 1),
  I16VEC4_NORM = makePrimitiveType(I16_BITMASK, 1, 4, 1),
  I32 = makePrimitiveType(I32_BITMASK, 1, 1, 0),
  I32VEC2 = makePrimitiveType(I32_BITMASK, 1, 2, 0),
  I32VEC3 = makePrimitiveType(I32_BITMASK, 1, 3, 0),
  I32VEC4 = makePrimitiveType(I32_BITMASK, 1, 4, 0),
  I32_NORM = makePrimitiveType(I32_BITMASK, 1, 1, 1),
  I32VEC2_NORM = makePrimitiveType(I32_BITMASK, 1, 2, 1),
  I32VEC3_NORM = makePrimitiveType(I32_BITMASK, 1, 3, 1),
  I32VEC4_NORM = makePrimitiveType(I32_BITMASK, 1, 4, 1),
  U8 = makePrimitiveType(U8_BITMASK, 1, 1, 0),
  U8VEC2 = makePrimitiveType(U8_BITMASK, 1, 2, 0),
  U8VEC3 = makePrimitiveType(U8_BITMASK, 1, 3, 0),
  U8VEC4 = makePrimitiveType(U8_BITMASK, 1, 4, 0),
  U8_NORM = makePrimitiveType(U8_BITMASK, 1, 1, 1),
  U8VEC2_NORM = makePrimitiveType(U8_BITMASK, 1, 2, 1),
  U8VEC3_NORM = makePrimitiveType(U8_BITMASK, 1, 3, 1),
  U8VEC4_NORM = makePrimitiveType(U8_BITMASK, 1, 4, 1),
  U16 = makePrimitiveType(U16_BITMASK, 1, 1, 0),
  U16VEC2 = makePrimitiveType(U16_BITMASK, 1, 2, 0),
  U16VEC3 = makePrimitiveType(U16_BITMASK, 1, 3, 0),
  U16VEC4 = makePrimitiveType(U16_BITMASK, 1, 4, 0),
  U16_NORM = makePrimitiveType(U16_BITMASK, 1, 1, 1),
  U16VEC2_NORM = makePrimitiveType(U16_BITMASK, 1, 2, 1),
  U16VEC3_NORM = makePrimitiveType(U16_BITMASK, 1, 3, 1),
  U16VEC4_NORM = makePrimitiveType(U16_BITMASK, 1, 4, 1),
  U32 = makePrimitiveType(U32_BITMASK, 1, 1, 0),
  U32VEC2 = makePrimitiveType(U32_BITMASK, 1, 2, 0),
  U32VEC3 = makePrimitiveType(U32_BITMASK, 1, 3, 0),
  U32VEC4 = makePrimitiveType(U32_BITMASK, 1, 4, 0),
  U32_NORM = makePrimitiveType(U32_BITMASK, 1, 1, 1),
  U32VEC2_NORM = makePrimitiveType(U32_BITMASK, 1, 2, 1),
  U32VEC3_NORM = makePrimitiveType(U32_BITMASK, 1, 3, 1),
  U32VEC4_NORM = makePrimitiveType(U32_BITMASK, 1, 4, 1),
  MAT2 = makePrimitiveType(F32_BITMASK, 2, 2, 0),
  MAT2x3 = makePrimitiveType(F32_BITMASK, 2, 3, 0),
  MAT2x4 = makePrimitiveType(F32_BITMASK, 2, 4, 0),
  MAT3x2 = makePrimitiveType(F32_BITMASK, 3, 2, 0),
  MAT3 = makePrimitiveType(F32_BITMASK, 3, 3, 0),
  MAT3x4 = makePrimitiveType(F32_BITMASK, 3, 4, 0),
  MAT4x2 = makePrimitiveType(F32_BITMASK, 4, 2, 0),
  MAT4x3 = makePrimitiveType(F32_BITMASK, 4, 3, 0),
  MAT4 = makePrimitiveType(F32_BITMASK, 4, 4, 0),
}

const primitiveTypeMapWebGL = {
  [PBPrimitiveType.F32]: 'float',
  [PBPrimitiveType.F32VEC2]: 'vec2',
  [PBPrimitiveType.F32VEC3]: 'vec3',
  [PBPrimitiveType.F32VEC4]: 'vec4',
  [PBPrimitiveType.BOOL]: 'bool',
  [PBPrimitiveType.BVEC2]: 'bvec2',
  [PBPrimitiveType.BVEC3]: 'bvec3',
  [PBPrimitiveType.BVEC4]: 'bvec4',
  [PBPrimitiveType.I32]: 'int',
  [PBPrimitiveType.I32VEC2]: 'ivec2',
  [PBPrimitiveType.I32VEC3]: 'ivec3',
  [PBPrimitiveType.I32VEC4]: 'ivec4',
  [PBPrimitiveType.U32]: 'uint',
  [PBPrimitiveType.U32VEC2]: 'uvec2',
  [PBPrimitiveType.U32VEC3]: 'uvec3',
  [PBPrimitiveType.U32VEC4]: 'uvec4',
  [PBPrimitiveType.MAT2]: 'mat2',
  [PBPrimitiveType.MAT2x3]: 'mat2x3',
  [PBPrimitiveType.MAT2x4]: 'mat2x4',
  [PBPrimitiveType.MAT3x2]: 'mat3x2',
  [PBPrimitiveType.MAT3]: 'mat3',
  [PBPrimitiveType.MAT3x4]: 'mat3x4',
  [PBPrimitiveType.MAT4x2]: 'mat4x2',
  [PBPrimitiveType.MAT4x3]: 'mat4x3',
  [PBPrimitiveType.MAT4]: 'mat4',
};

const primitiveTypeMapWGSL = {
  [PBPrimitiveType.F32]: 'f32',
  [PBPrimitiveType.F32VEC2]: 'vec2<f32>',
  [PBPrimitiveType.F32VEC3]: 'vec3<f32>',
  [PBPrimitiveType.F32VEC4]: 'vec4<f32>',
  [PBPrimitiveType.BOOL]: 'bool',
  [PBPrimitiveType.BVEC2]: 'vec2<bool>',
  [PBPrimitiveType.BVEC3]: 'vec3<bool>',
  [PBPrimitiveType.BVEC4]: 'vec4<bool>',
  [PBPrimitiveType.I32]: 'i32',
  [PBPrimitiveType.I32VEC2]: 'vec2<i32>',
  [PBPrimitiveType.I32VEC3]: 'vec3<i32>',
  [PBPrimitiveType.I32VEC4]: 'vec4<i32>',
  [PBPrimitiveType.U32]: 'u32',
  [PBPrimitiveType.U32VEC2]: 'vec2<u32>',
  [PBPrimitiveType.U32VEC3]: 'vec3<u32>',
  [PBPrimitiveType.U32VEC4]: 'vec4<u32>',
  [PBPrimitiveType.MAT2]: 'mat2x2<f32>',
  [PBPrimitiveType.MAT2x3]: 'mat2x3<f32>',
  [PBPrimitiveType.MAT2x4]: 'mat2x4<f32>',
  [PBPrimitiveType.MAT3x2]: 'mat3x2<f32>',
  [PBPrimitiveType.MAT3]: 'mat3x3<f32>',
  [PBPrimitiveType.MAT3x4]: 'mat3x4<f32>',
  [PBPrimitiveType.MAT4x2]: 'mat4x2<f32>',
  [PBPrimitiveType.MAT4x3]: 'mat4x3<f32>',
  [PBPrimitiveType.MAT4]: 'mat4x4<f32>',
};

const BITFLAG_1D = (1 << 0);
const BITFLAG_2D = (1 << 1);
const BITFLAG_3D = (1 << 2);
const BITFLAG_CUBE = (1 << 3);
const BITFLAG_ARRAY = (1 << 4);
const BITFLAG_MULTISAMPLED = (1 << 5);
const BITFLAG_STORAGE = (1 << 6);
const BITFLAG_DEPTH = (1 << 7);
const BITFLAG_FLOAT = (1 << 8);
const BITFLAG_INT = (1 << 9);
const BITFLAG_UINT = (1 << 10);
const BITFLAG_EXTERNAL = (1 << 11);

export enum PBTextureType {
  TEX_1D = BITFLAG_1D | BITFLAG_FLOAT,
  ITEX_1D = BITFLAG_1D | BITFLAG_INT,
  UTEX_1D = BITFLAG_1D | BITFLAG_UINT,
  TEX_2D = BITFLAG_2D | BITFLAG_FLOAT,
  ITEX_2D = BITFLAG_2D | BITFLAG_INT,
  UTEX_2D = BITFLAG_2D | BITFLAG_UINT,
  TEX_2D_ARRAY = BITFLAG_2D | BITFLAG_FLOAT | BITFLAG_ARRAY,
  ITEX_2D_ARRAY = BITFLAG_2D | BITFLAG_INT | BITFLAG_ARRAY,
  UTEX_2D_ARRAY = BITFLAG_2D | BITFLAG_UINT | BITFLAG_ARRAY,
  TEX_3D = BITFLAG_3D | BITFLAG_FLOAT,
  ITEX_3D = BITFLAG_3D | BITFLAG_INT,
  UTEX_3D = BITFLAG_3D | BITFLAG_UINT,
  TEX_CUBE = BITFLAG_CUBE | BITFLAG_FLOAT,
  ITEX_CUBE = BITFLAG_CUBE | BITFLAG_INT,
  UTEX_CUBE = BITFLAG_CUBE | BITFLAG_UINT,
  TEX_CUBE_ARRAY = BITFLAG_CUBE | BITFLAG_FLOAT | BITFLAG_ARRAY,
  ITEX_CUBE_ARRAY = BITFLAG_CUBE | BITFLAG_INT | BITFLAG_ARRAY,
  UTEX_CUBE_ARRAY = BITFLAG_CUBE | BITFLAG_UINT | BITFLAG_ARRAY,
  TEX_MULTISAMPLED_2D = BITFLAG_2D | BITFLAG_FLOAT | BITFLAG_MULTISAMPLED,
  ITEX_MULTISAMPLED_2D = BITFLAG_2D | BITFLAG_INT | BITFLAG_MULTISAMPLED,
  UTEX_MULTISAMPLED_2D = BITFLAG_2D | BITFLAG_UINT | BITFLAG_MULTISAMPLED,
  TEX_STORAGE_1D = BITFLAG_1D | BITFLAG_STORAGE,
  TEX_STORAGE_2D = BITFLAG_2D | BITFLAG_STORAGE,
  TEX_STORAGE_2D_ARRAY = BITFLAG_2D | BITFLAG_ARRAY | BITFLAG_STORAGE,
  TEX_STORAGE_3D = BITFLAG_3D | BITFLAG_STORAGE,
  TEX_DEPTH_2D = BITFLAG_2D | BITFLAG_DEPTH,
  TEX_DEPTH_2D_ARRAY = BITFLAG_2D | BITFLAG_ARRAY | BITFLAG_DEPTH,
  TEX_DEPTH_CUBE = BITFLAG_CUBE | BITFLAG_DEPTH,
  TEX_DEPTH_CUBE_ARRAY = BITFLAG_CUBE | BITFLAG_ARRAY | BITFLAG_DEPTH,
  TEX_DEPTH_MULTISAMPLED_2D = BITFLAG_2D | BITFLAG_MULTISAMPLED | BITFLAG_DEPTH,
  TEX_EXTERNAL = BITFLAG_EXTERNAL,
}

const textureTypeMapWebGL = {
  [PBTextureType.TEX_1D]: 'highp sampler2D',
  [PBTextureType.TEX_2D]: 'highp sampler2D',
  [PBTextureType.TEX_CUBE]: 'highp samplerCube',
  [PBTextureType.TEX_EXTERNAL]: 'highp sampler2D',
};

const textureTypeMapWebGL2 = {
  [PBTextureType.TEX_1D]: 'highp sampler2D',
  [PBTextureType.TEX_2D]: 'highp sampler2D',
  [PBTextureType.ITEX_1D]: 'highp isampler2D',
  [PBTextureType.ITEX_2D]: 'highp isampler2D',
  [PBTextureType.UTEX_1D]: 'highp usampler2D',
  [PBTextureType.UTEX_2D]: 'highp usampler2D',
  [PBTextureType.TEX_2D_ARRAY]: 'highp sampler2DArray',
  [PBTextureType.ITEX_2D_ARRAY]: 'highp isampler2DArray',
  [PBTextureType.UTEX_2D_ARRAY]: 'highp usampler2DArray',
  [PBTextureType.TEX_3D]: 'highp sampler3D',
  [PBTextureType.ITEX_3D]: 'highp isampler3D',
  [PBTextureType.UTEX_3D]: 'highp usampler3D',
  [PBTextureType.TEX_CUBE]: 'highp samplerCube',
  [PBTextureType.ITEX_CUBE]: 'highp isamplerCube',
  [PBTextureType.UTEX_CUBE]: 'highp usamplerCube',
  [PBTextureType.TEX_DEPTH_2D]: 'highp sampler2DShadow',
  [PBTextureType.TEX_DEPTH_2D_ARRAY]: 'highp sampler2DArrayShadow',
  [PBTextureType.TEX_DEPTH_CUBE]: 'highp samplerCubeShadow',
  [PBTextureType.TEX_EXTERNAL]: 'highp sampler2D',
};

const textureTypeMapWGSL = {
  [PBTextureType.TEX_1D]: 'texture_1d<f32>',
  [PBTextureType.ITEX_1D]: 'texture_1d<i32>',
  [PBTextureType.UTEX_1D]: 'texture_1d<u32>',
  [PBTextureType.TEX_2D]: 'texture_2d<f32>',
  [PBTextureType.ITEX_2D]: 'texture_2d<i32>',
  [PBTextureType.UTEX_2D]: 'texture_2d<u32>',
  [PBTextureType.TEX_2D_ARRAY]: 'texture_2d_array<f32>',
  [PBTextureType.ITEX_2D_ARRAY]: 'texture_2d_array<i32>',
  [PBTextureType.UTEX_2D_ARRAY]: 'texture_2d_array<u32>',
  [PBTextureType.TEX_3D]: 'texture_3d<f32>',
  [PBTextureType.ITEX_3D]: 'texture_3d<i32>',
  [PBTextureType.UTEX_3D]: 'texture_3d<u32>',
  [PBTextureType.TEX_CUBE]: 'texture_cube<f32>',
  [PBTextureType.ITEX_CUBE]: 'texture_cube<i32>',
  [PBTextureType.UTEX_CUBE]: 'texture_cube<u32>',
  [PBTextureType.TEX_CUBE_ARRAY]: 'texture_cube_array<f32>',
  [PBTextureType.ITEX_CUBE_ARRAY]: 'texture_cube_array<i32>',
  [PBTextureType.UTEX_CUBE_ARRAY]: 'texture_cube_array<u32>',
  [PBTextureType.TEX_MULTISAMPLED_2D]: 'texture_multisampled_2d<f32>',
  [PBTextureType.ITEX_MULTISAMPLED_2D]: 'texture_multisampled_2d<i32>',
  [PBTextureType.UTEX_MULTISAMPLED_2D]: 'texture_multisampled_2d<u32>',
  [PBTextureType.TEX_STORAGE_1D]: 'texture_storage_1d',
  [PBTextureType.TEX_STORAGE_2D]: 'texture_storage_2d',
  [PBTextureType.TEX_STORAGE_2D_ARRAY]: 'texture_storage_2d_array',
  [PBTextureType.TEX_STORAGE_3D]: 'texture_storage_3d',
  [PBTextureType.TEX_DEPTH_2D]: 'texture_depth_2d',
  [PBTextureType.TEX_DEPTH_2D_ARRAY]: 'texture_depth_2d_array',
  [PBTextureType.TEX_DEPTH_CUBE]: 'texture_depth_cube',
  [PBTextureType.TEX_DEPTH_CUBE_ARRAY]: 'texture_depth_cube_array',
  [PBTextureType.TEX_DEPTH_MULTISAMPLED_2D]: 'texture_depth_multisampled_2d',
  [PBTextureType.TEX_EXTERNAL]: 'texture_external',
};

const storageTexelFormatMap = {
  [TextureFormat.RGBA8UNORM]: 'rgba8unorm',
  [TextureFormat.RGBA8SNORM]: 'rgba8snorm',
  [TextureFormat.BGRA8UNORM]: 'bgra8unorm',
  [TextureFormat.RGBA8UI]: 'rgba8uint',
  [TextureFormat.RGBA8I]: 'rgba8sint',
  [TextureFormat.RGBA16UI]: 'rgba16uint',
  [TextureFormat.RGBA16I]: 'rgba16sint',
  [TextureFormat.RGBA16F]: 'rgba16float',
  [TextureFormat.R32F]: 'r32float',
  [TextureFormat.R32UI]: 'r32uint',
  [TextureFormat.R32I]: 'r32sint',
  [TextureFormat.RG32F]: 'rg32float',
  [TextureFormat.RG32UI]: 'rg32uint',
  [TextureFormat.RG32I]: 'rg32sint',
  [TextureFormat.RGBA32F]: 'rgba32float',
  [TextureFormat.RGBA32UI]: 'rgba32uint',
  [TextureFormat.RGBA32I]: 'rgba32sint',
};

export enum PBSamplerAccessMode {
  UNKNOWN = 0,
  SAMPLE,
  COMPARISON
}

export enum PBAddressSpace {
  UNKNOWN = 'unknown',
  FUNCTION = 'function',
  PRIVATE = 'private',
  WORKGROUP = 'workgroup',
  UNIFORM = 'uniform',
  STORAGE = 'storage',
}

export enum PBTypeClass {
  UNKNOWN = 0,
  PLAIN,
  ARRAY,
  POINTER,
  ATOMIC,
  TEXTURE,
  SAMPLER,
  FUNCTION,
  VOID,
}

export type TypeInfo = PrimitiveTypeDetail | StructTypeDetail | ArrayTypeDetail | PointerTypeDetail | AtomicTypeInfoDetail | SamplerTypeDetail | TextureTypeDetail | FunctionTypeDetail | null;

export interface PrimitiveTypeDetail {
  primitiveType?: PBPrimitiveType,
}

export interface StructTypeDetail {
  layout: PBStructLayout;
  structName?: string;
  structMembers?: {
    name: string,
    type: PBPrimitiveTypeInfo | PBArrayTypeInfo | PBStructTypeInfo,
    alignment: number,
    size: number,
    defaultAlignment: number,
    defaultSize: number,
  }[];
}

export interface ArrayTypeDetail {
  elementType: PBPrimitiveTypeInfo | PBArrayTypeInfo | PBStructTypeInfo;
  dimension: number;
}

export interface PointerTypeDetail {
  pointerType: PBTypeInfo;
  addressSpace: PBAddressSpace;
}

export interface AtomicTypeInfoDetail {
  type: PBPrimitiveType;
}

export interface SamplerTypeDetail {
  accessMode: PBSamplerAccessMode;
}

export interface TextureTypeDetail {
  textureType: PBTextureType;
  storageTexelFormat: TextureFormat;
  readable: boolean;
  writable: boolean;
}

export interface FunctionTypeDetail {
  name: string;
  returnType: PBTypeInfo;
  argTypes: { type: PBTypeInfo, byRef?: boolean }[];
}

export abstract class PBTypeInfo<DetailType extends TypeInfo = TypeInfo>  {
  /** @internal */
  cls: PBTypeClass;
  /** @internal */
  detail: DetailType;
  /** @internal */
  protected id: string;
  constructor(cls: PBTypeClass, detail: DetailType) {
    this.cls = cls;
    this.detail = detail;
    this.id = null;
  }
  get typeId(): string {
    if (!this.id) {
      this.id = this.genTypeId();
    }
    return this.id;
  }
  isVoidType(): this is PBVoidTypeInfo {
    return false;
  }
  isPrimitiveType(): this is PBPrimitiveTypeInfo {
    return false;
  }
  isStructType(): this is PBStructTypeInfo {
    return false;
  }
  isArrayType(): this is PBArrayTypeInfo {
    return false;
  }
  isPointerType(): this is PBPointerTypeInfo {
    return false;
  }
  isAtomicType(): this is PBAtomicTypeInfo {
    return false;
  }
  isSamplerType(): this is PBSamplerTypeInfo {
    return false;
  }
  isTextureType(): this is PBTextureTypeInfo {
    return false;
  }
  isHostSharable(): boolean {
    return false;
  }
  isConstructible(): boolean {
    return false;
  }
  isStorable(): boolean {
    return false;
  }
  getConstructorOverloads(deviceType: DeviceType): PBFunctionTypeInfo[] {
    return [];
  }
  abstract toBufferLayout(offset: number, layout: PBStructLayout): UniformBufferLayout;
  abstract toTypeName(deviceType: DeviceType, varName?: string): string;
  /** @internal */
  protected abstract genTypeId(): string;
}

export class PBVoidTypeInfo extends PBTypeInfo<null> {
  constructor() {
    super(PBTypeClass.VOID, null);
  }
  isVoidType(): this is PBVoidTypeInfo {
    return true;
  }
  toTypeName(deviceType: DeviceType, varName?: string): string {
    return 'void';
  }
  /** @internal */
  protected genTypeId(): string {
    return 'void';
  }
  toBufferLayout(offset: number): UniformBufferLayout {
    return null;
  }
}
export class PBPrimitiveTypeInfo extends PBTypeInfo<PrimitiveTypeDetail> implements ILayoutableType {
  /** @internal */
  private static cachedTypes: { [primitiveType: number]: PBPrimitiveTypeInfo } = {};
  /** @internal */
  private static cachedCtorOverloads: { [deviceType: string]: { [primitiveType: number]: PBFunctionTypeInfo[] } } = {};
  constructor(type: PBPrimitiveType) {
    super(PBTypeClass.PLAIN, { primitiveType: type });
  }
  static getCachedTypeInfo(primitiveType: PBPrimitiveType): PBPrimitiveTypeInfo {
    let typeinfo = this.cachedTypes[primitiveType];
    if (!typeinfo) {
      typeinfo = new PBPrimitiveTypeInfo(primitiveType);
      this.cachedTypes[primitiveType] = typeinfo;
    }
    return typeinfo;
  }
  static getCachedOverloads(deviceType: DeviceType, primitiveType: PBPrimitiveType): PBFunctionTypeInfo[] {
    let deviceOverloads = this.cachedCtorOverloads[deviceType];
    if (!deviceOverloads) {
      deviceOverloads = {};
      this.cachedCtorOverloads[deviceType] = deviceOverloads;
    }
    let result = deviceOverloads[primitiveType];
    if (!result) {
      const typeinfo = this.getCachedTypeInfo(primitiveType);
      const name = typeinfo.toTypeName(deviceType);
      result = [new PBFunctionTypeInfo(name, typeinfo, [])];
      if (typeinfo.isScalarType()) {
        result.push(new PBFunctionTypeInfo(name, typeinfo, [{ type: this.getCachedTypeInfo(PBPrimitiveType.F32) }]));
        result.push(new PBFunctionTypeInfo(name, typeinfo, [{ type: this.getCachedTypeInfo(PBPrimitiveType.I32) }]));
        result.push(new PBFunctionTypeInfo(name, typeinfo, [{ type: this.getCachedTypeInfo(PBPrimitiveType.U32) }]));
        result.push(new PBFunctionTypeInfo(name, typeinfo, [{ type: this.getCachedTypeInfo(PBPrimitiveType.BOOL) }]));
      } else if (typeinfo.isVectorType()) {
        const scalarTypeInfo = { type: this.getCachedTypeInfo(typeinfo.scalarType) };
        const vec2TypeInfo = { type: this.getCachedTypeInfo(typeinfo.resizeType(1, 2)) };
        const vec3TypeInfo = { type: this.getCachedTypeInfo(typeinfo.resizeType(1, 3)) };
        result.push(new PBFunctionTypeInfo(name, typeinfo, [scalarTypeInfo]));
        switch (typeinfo.cols) {
          case 2:
            result.push(new PBFunctionTypeInfo(name, typeinfo, [scalarTypeInfo, scalarTypeInfo]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [{ type: typeF32Vec2 }]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [{ type: typeI32Vec2 }]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [{ type: typeU32Vec2 }]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [{ type: typeBVec2 }]));
            break;
          case 3:
            result.push(new PBFunctionTypeInfo(name, typeinfo, [scalarTypeInfo, scalarTypeInfo, scalarTypeInfo]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [scalarTypeInfo, vec2TypeInfo]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [vec2TypeInfo, scalarTypeInfo]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [{ type: typeF32Vec3 }]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [{ type: typeI32Vec3 }]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [{ type: typeU32Vec3 }]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [{ type: typeBVec3 }]));
            break;
          case 4:
            result.push(new PBFunctionTypeInfo(name, typeinfo, [scalarTypeInfo, scalarTypeInfo, scalarTypeInfo, scalarTypeInfo]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [scalarTypeInfo, scalarTypeInfo, vec2TypeInfo]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [scalarTypeInfo, vec2TypeInfo, scalarTypeInfo]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [vec2TypeInfo, scalarTypeInfo, scalarTypeInfo]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [vec2TypeInfo, vec2TypeInfo]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [scalarTypeInfo, vec3TypeInfo]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [vec3TypeInfo, scalarTypeInfo]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [{ type: typeF32Vec4 }]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [{ type: typeI32Vec4 }]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [{ type: typeU32Vec4 }]));
            result.push(new PBFunctionTypeInfo(name, typeinfo, [{ type: typeBVec4 }]));
        }
      } else if (typeinfo.isMatrixType()) {
        const colType = this.getCachedTypeInfo(typeinfo.resizeType(1, typeinfo.cols));
        result.push(new PBFunctionTypeInfo(name, typeinfo, Array.from({ length: typeinfo.rows }).map(() => ({ type: colType }))));
        result.push(new PBFunctionTypeInfo(name, typeinfo, Array.from({ length: typeinfo.rows * typeinfo.cols }).map(() => ({ type: typeF32 }))));
      }
      deviceOverloads[primitiveType] = result;
    }
    return result;
  }
  get primitiveType(): PBPrimitiveType {
    return this.detail.primitiveType;
  }
  get scalarType(): PBPrimitiveType {
    return this.resizeType(1, 1);
  }
  get rows(): number {
    return (this.primitiveType >> ROWS_BITSHIFT) & ROWS_BITMASK;
  }
  get cols(): number {
    return (this.primitiveType >> COLS_BITSHIFT) & COLS_BITMASK;
  }
  get normalized(): boolean {
    return !!((this.primitiveType >> NORM_BITSHIFT) & NORM_BITMASK);
  }
  getLayoutAlignment(layout: PBStructLayout): number {
    return layout === 'packed' ? 1 : this.isScalarType() ? 4 : 1 << Math.min(4, (this.cols + 1));
  }
  getLayoutSize(): number {
    return this.getSize();
  }
  getSize(): number {
    let scalarSize: number;
    switch (this.scalarType) {
      case PBPrimitiveType.BOOL:
      case PBPrimitiveType.I32:
      case PBPrimitiveType.I32_NORM:
      case PBPrimitiveType.U32:
      case PBPrimitiveType.U32_NORM:
      case PBPrimitiveType.F32:
        scalarSize = 4;
        break;
      case PBPrimitiveType.F16:
      case PBPrimitiveType.I16:
      case PBPrimitiveType.I16_NORM:
      case PBPrimitiveType.U16:
      case PBPrimitiveType.U16_NORM:
        scalarSize = 2;
        break;
      default:
        scalarSize = 1;
        break;
    }
    return scalarSize * this.cols * this.rows;
  }
  resizeType(rows: number, cols: number): PBPrimitiveType {
    return makePrimitiveType(this.primitiveType & SCALAR_TYPE_BITMASK, rows, cols, this.normalized ? 1 : 0);
  }
  isScalarType(): boolean {
    return this.rows === 1 && this.cols === 1;
  }
  isVectorType(): boolean {
    return this.rows === 1 && this.cols > 1;
  }
  isMatrixType(): boolean {
    return this.rows > 1 && this.cols > 1;
  }
  isPrimitiveType(): this is PBPrimitiveTypeInfo {
    return true;
  }
  isHostSharable(): boolean {
    return this.scalarType !== PBPrimitiveType.BOOL
  }
  isConstructible(): boolean {
    return true;
  }
  isStorable(): boolean {
    return true;
  }
  getConstructorOverloads(deviceType: DeviceType): PBFunctionTypeInfo[] {
    return PBPrimitiveTypeInfo.getCachedOverloads(deviceType, this.primitiveType);
  }
  toTypeName(deviceType: DeviceType, varName?: string): string {
    if (deviceType === 'webgpu') {
      const typename = primitiveTypeMapWGSL[this.primitiveType];
      return varName ? `${varName}: ${typename}` : typename;
    } else {
      const typename = primitiveTypeMapWebGL[this.primitiveType];
      return varName ? `${typename} ${varName}` : typename;
    }
  }
  toBufferLayout(offset: number): UniformBufferLayout {
    return null;
  }
  /** @internal */
  protected genTypeId(): string {
    return `PRIM:${this.primitiveType}`;
  }
}

export class PBStructTypeInfo extends PBTypeInfo<StructTypeDetail> implements ILayoutableType {
  constructor(name: string, layout: PBStructLayout, members: { name: string, type: PBPrimitiveTypeInfo | PBArrayTypeInfo | PBStructTypeInfo }[]) {
    super(PBTypeClass.PLAIN, {
      layout: layout || 'default',
      structName: name,
      structMembers: members.map(val => {
        const defaultAlignment = getAlignment(val.type);
        const defaultSize = getSize(val.type);
        return {
          name: val.name,
          type: val.type,
          alignment: defaultAlignment,
          size: defaultSize,
          defaultAlignment: defaultAlignment,
          defaultSize: defaultSize,
        };
      }),
    });
    if (this.layout === 'std140') {
      this.calcAlignmentAndSizeSTD140();
    } else if (this.layout === 'packed') {
      this.calcAlignmentAndSizePacked();
    }
  }
  get layout(): PBStructLayout {
    return this.detail.layout;
  }
  get structName(): string {
    return this.detail.structName;
  }
  set structName(val: string) {
    this.detail.structName = val;
  }
  get structMembers() {
    return this.detail.structMembers;
  }
  extends(name: string, members: { name: string, type: PBPrimitiveTypeInfo | PBArrayTypeInfo | PBStructTypeInfo }[]): PBStructTypeInfo {
    const oldMembers = this.structMembers.map(member => ({ name: member.name, type: member.type }));
    return new PBStructTypeInfo(name, this.layout, [...oldMembers, ...members]);
  }
  isStructType(): this is PBStructTypeInfo {
    return true;
  }
  isHostSharable(): boolean {
    return this.detail.structMembers.every(val => val.type.isHostSharable());
  }
  isConstructible(): boolean {
    return this.detail.structMembers.every(val => val.type.isConstructible());
  }
  isStorable(): boolean {
    return true;
  }
  getConstructorOverloads(): PBFunctionTypeInfo[] {
    const result: PBFunctionTypeInfo[] = [new PBFunctionTypeInfo(this.structName, this, [])];
    if (this.isConstructible()) {
      result.push(new PBFunctionTypeInfo(this.structName, this, this.structMembers.map(val => ({ type: val.type }))));
    }
    return result;
  }
  toTypeName(deviceType: DeviceType, varName?: string): string {
    if (deviceType === 'webgpu') {
      return varName ? `${varName}: ${this.structName}` : this.structName;
    } else {
      return varName ? `${this.structName} ${varName}` : this.structName;
    }
  }
  getLayoutAlignment(layout: PBStructLayout): number {
    if (layout === 'packed') {
      return 1;
    }
    let alignment = 0;
    for (const member of this.structMembers) {
      alignment = Math.max(alignment, member.type.getLayoutAlignment(layout));
    }
    if (layout === 'std140') {
      alignment = align(alignment, 16);
    }
    return alignment;
  }
  getLayoutSize(layout: PBStructLayout): number {
    let size = 0;
    let structAlignment = 0;
    for (const member of this.structMembers) {
      const memberAlignment = member.type.getLayoutAlignment(layout);
      size = align(size, memberAlignment);
      size += member.type.getLayoutSize(layout);
      structAlignment = Math.max(structAlignment, memberAlignment);
    }
    if (layout === 'packed') {
      return size;
    }
    size = align(size, structAlignment);
    if (layout === 'std140') {
      size = align(size, 16);
    }
    return size;
  }
  toBufferLayout(offset: number, layout: PBStructLayout): UniformBufferLayout {
    const bufferLayout: UniformBufferLayout = {
      byteSize: 0,
      entries: []
    };
    const start = offset;
    for (const member of this.structMembers) {
      offset = align(offset, member.type.getLayoutAlignment(layout));
      const size = member.type.getLayoutSize(layout);
      bufferLayout.entries.push({
        name: member.name,
        offset: offset,
        byteSize: size,
        type: typeToTypedArray(member.type),
        subLayout: member.type.isStructType() ? member.type.toBufferLayout(offset, layout) : null,
        arraySize: member.type.isArrayType() ? member.type.dimension : 0,
      });
      offset += size;
    }
    bufferLayout.byteSize = layout === 'std140' ? align(offset - start, 16) : offset - start;
    return bufferLayout;
  }
  clone(newName?: string): PBStructTypeInfo {
    return new PBStructTypeInfo(newName || this.structName, this.layout, this.structMembers);
  }
  reset(name: string, layout: PBStructLayout, members: { name: string, type: PBPrimitiveTypeInfo | PBArrayTypeInfo | PBStructTypeInfo }[]) {
    this.detail = {
      layout: layout || 'default',
      structName: name,
      structMembers: members.map(val => {
        const defaultAlignment = getAlignment(val.type);
        const defaultSize = getSize(val.type);
        return {
          name: val.name,
          type: val.type,
          alignment: defaultAlignment,
          size: defaultSize,
          defaultAlignment: defaultAlignment,
          defaultSize: defaultSize,
        };
      }),
    }
    if (this.layout === 'std140') {
      this.calcAlignmentAndSizeSTD140();
    } else if (this.layout === 'packed') {
      this.calcAlignmentAndSizePacked();
    }
    this.id = null;
  }
  /** @internal */
  protected genTypeId(): string {
    return `STRUCT:${this.structName}:${this.layout}:${this.structMembers.map(val => `${val.name}(${val.type.typeId})`).join(':')}`
  }
  /** @internal */
  private calcAlignmentAndSizeSTD140() {
    for (const member of this.structMembers) {
      if (member.type.isPrimitiveType()) {
        if (member.type.isMatrixType() && member.type.cols === 2) {
          throw new Error(`matrix${member.type.rows}x${member.type.cols} can not be used in std140 layout`);
        }
      } else if (member.type.isArrayType() && getAlignment(member.type.elementType) !== 16) {
        throw new Error('array element must be 16 bytes aligned in std140 layout');
      } else if (member.type.isStructType()) {
        member.alignment = 16;
        member.size = align(member.defaultSize, 16);
      }
    }
  }
  /** @internal */
  private calcAlignmentAndSizePacked() {
    for (const member of this.structMembers) {
      member.alignment = getAlignmentPacked(member.type);
      member.size = getSizePacked(member.type);
    }
  }
}

export class PBArrayTypeInfo extends PBTypeInfo<ArrayTypeDetail> implements ILayoutableType {
  constructor(elementType: PBPrimitiveTypeInfo | PBArrayTypeInfo | PBStructTypeInfo, dimension?: number) {
    super(PBTypeClass.ARRAY, {
      elementType: elementType,
      dimension: Number(dimension) || 0,
    });
  }
  get elementType(): PBPrimitiveTypeInfo | PBArrayTypeInfo | PBStructTypeInfo {
    return this.detail.elementType;
  }
  get dimension(): number {
    return this.detail.dimension;
  }
  isArrayType(): this is PBArrayTypeInfo {
    return true;
  }
  isHostSharable(): boolean {
    return this.detail.elementType.isHostSharable();
  }
  isConstructible(): boolean {
    return this.dimension && this.detail.elementType.isConstructible();
  }
  isStorable(): boolean {
    return true;
  }
  getConstructorOverloads(deviceType: DeviceType): PBFunctionTypeInfo[] {
    const name = this.toTypeName(deviceType);
    const result: PBFunctionTypeInfo[] = [new PBFunctionTypeInfo(name, this, [])];
    if (deviceType !== 'webgl' && this.isConstructible()) {
      result.push(new PBFunctionTypeInfo(name, this, Array.from({ length: this.dimension }).map(() => ({ type: this.elementType }))));
    }
    return result;
  }
  toTypeName(deviceType: DeviceType, varName?: string): string {
    if (deviceType === 'webgpu') {
      const elementTypeName = this.elementType.toTypeName(deviceType);
      const typename = `array<${elementTypeName}${this.dimension ? ', ' + this.dimension : ''}>`;
      return varName ? `${varName}: ${typename}` : typename;
    } else {
      assert(!!this.dimension, 'runtime-sized array not supported for webgl', true);
      assert(!this.elementType.isArrayType(), 'multi-dimensional arrays not supported for webgl', true);
      const elementTypeName = this.elementType.toTypeName(deviceType, varName);
      return `${elementTypeName}[${this.dimension}]`;
    }
  }
  getLayoutAlignment(layout: PBStructLayout): number {
    return this.elementType.getLayoutAlignment(layout);
  }
  getLayoutSize(layout: PBStructLayout): number {
    const elementAlignment = this.elementType.getLayoutAlignment(layout);
    if (layout === 'std140' && !!(elementAlignment & 15)) {
      // array element stride of std140 layout must be multiple of 16
      throw new Error('Error: array element stride of std140 must be multiple of 16');
    }
    return this.dimension * align(this.elementType.getLayoutSize(layout), elementAlignment);
  }
  toBufferLayout(offset: number): UniformBufferLayout {
    return null;
  }
  /** @internal */
  protected genTypeId(): string {
    return `ARRAY:(${this.elementType.typeId})[${this.dimension}]`;
  }
}

export class PBPointerTypeInfo extends PBTypeInfo<PointerTypeDetail> {
  /** @internal */
  writable: boolean;
  constructor(pointerType: PBTypeInfo, addressSpace: PBAddressSpace) {
    super(PBTypeClass.POINTER, {
      pointerType,
      addressSpace,
    });
    assert(pointerType.isStorable(), 'the pointee type must be storable', true);
    this.writable = false;
  }
  get pointerType(): PBTypeInfo {
    return this.detail.pointerType;
  }
  get addressSpace(): PBAddressSpace {
    return this.detail.addressSpace;
  }
  set addressSpace(val: PBAddressSpace) {
    if (this.detail.addressSpace !== val) {
      this.detail.addressSpace = val;
      this.id = null;
    }
  }
  isPointerType(): this is PBPointerTypeInfo {
    return true;
  }
  toTypeName(device: DeviceType, varName?: string): string {
    if (device === 'webgpu') {
      const addressSpace = this.addressSpace === PBAddressSpace.UNKNOWN ? PBAddressSpace.FUNCTION : this.addressSpace;
      /*
      const mode = addressSpace === PBAddressSpace.UNIFORM || (addressSpace === PBAddressSpace.STORAGE && !this.writable) ? 'read' : 'read_write'
      const typename = `ptr<${addressSpace}, ${this.pointerType.toTypeName(device)}, ${mode}>`;
      */
      /* WGSL spec:
        When writing a variable declaration or a pointer type in WGSL source:
        For the storage address space, the access mode is optional, and defaults to read.
        For other address spaces, the access mode must not be written.
      */
      const mode = addressSpace === PBAddressSpace.STORAGE && this.writable ? ', read_write' : '';
      const typename = `ptr<${addressSpace}, ${this.pointerType.toTypeName(device)} ${mode}>`;
      return varName ? `${varName}: ${typename}` : typename;
    } else {
      throw new Error('pointer type not supported for webgl');
    }
  }
  toBufferLayout(offset: number): UniformBufferLayout {
    return null;
  }
  /** @internal */
  protected genTypeId(): string {
    return `PTR:(${this.pointerType.typeId})`;
  }
}

export class PBAtomicTypeInfo extends PBTypeInfo<AtomicTypeInfoDetail> {
  constructor(type: PBPrimitiveType) {
    assert(type === PBPrimitiveType.I32 || type === PBPrimitiveType.U32, 'invalid atomic type', true);
    super(PBTypeClass.ATOMIC, {
      type
    });
  }
  get type(): PBPrimitiveType {
    return this.detail.type;
  }
  isAtomicType(): this is PBAtomicTypeInfo {
    return true;
  }
  isHostSharable(): boolean {
    return true;
  }
  isStorable(): boolean {
    return true;
  }
  toTypeName(deviceType: DeviceType, varName?: string): string {
    if (deviceType === 'webgpu') {
      const typename = `atomic<${primitiveTypeMapWGSL[this.type]}>`;
      return varName ? `${varName}: ${typename}` : typename;
    } else {
      throw new Error('atomic type not supported for webgl');
    }
  }
  toBufferLayout(offset: number): UniformBufferLayout {
    return null;
  }
  /** @internal */
  protected genTypeId(): string {
    return `ATOMIC:${this.type}`;
  }
}

export class PBSamplerTypeInfo extends PBTypeInfo<SamplerTypeDetail> {
  constructor(accessMode: PBSamplerAccessMode) {
    super(PBTypeClass.SAMPLER, {
      accessMode: accessMode
    });
  }
  get accessMode(): PBSamplerAccessMode {
    return this.detail.accessMode;
  }
  isSamplerType(): this is PBSamplerTypeInfo {
    return true;
  }
  isStorable(): boolean {
    return true;
  }
  toTypeName(deviceType: DeviceType, varName?: string): string {
    if (deviceType === 'webgpu') {
      const typename = this.accessMode === PBSamplerAccessMode.SAMPLE ? 'sampler' : 'sampler_comparison';
      return varName ? `${varName}: ${typename}` : typename;
    } else {
      throw new Error('sampler type not supported for webgl');
    }
  }
  toBufferLayout(offset: number): UniformBufferLayout {
    return null;
  }
  /** @internal */
  protected genTypeId(): string {
    return `SAMPLER:${this.accessMode}`;
  }
}

export class PBTextureTypeInfo extends PBTypeInfo<TextureTypeDetail> {
  constructor(textureType: PBTextureType, texelFormat?: TextureFormat, readable?: boolean, writable?: boolean) {
    super(PBTypeClass.TEXTURE, {
      textureType: textureType,
      readable,
      writable,
      storageTexelFormat: texelFormat || null
    });
    assert(!!textureTypeMapWGSL[textureType], 'unsupported texture type');
    assert(!(textureType & BITFLAG_STORAGE) || !!storageTexelFormatMap[texelFormat], 'invalid texel format for storage texture');
  }
  get textureType(): PBTextureType {
    return this.detail.textureType;
  }
  get storageTexelFormat(): TextureFormat {
    return this.detail.storageTexelFormat;
  }
  get readable(): boolean {
    return this.detail.readable;
  }
  get writable(): boolean {
    return this.detail.writable;
  }
  isStorable(): boolean {
    return true;
  }
  is1DTexture(): boolean {
    return !!(this.detail.textureType & BITFLAG_1D);
  }
  is2DTexture(): boolean {
    return !!(this.detail.textureType & BITFLAG_2D);
  }
  is3DTexture(): boolean {
    return !!(this.detail.textureType & BITFLAG_3D);
  }
  isCubeTexture(): boolean {
    return !!(this.detail.textureType & BITFLAG_CUBE);
  }
  isArrayTexture(): boolean {
    return !!(this.detail.textureType & BITFLAG_ARRAY);
  }
  isStorageTexture(): boolean {
    return !!(this.detail.textureType & BITFLAG_STORAGE);
  }
  isDepthTexture(): boolean {
    return !!(this.detail.textureType & BITFLAG_DEPTH);
  }
  isMultisampledTexture(): boolean {
    return !!(this.detail.textureType & BITFLAG_MULTISAMPLED);
  }
  isExternalTexture(): boolean {
    return !!(this.detail.textureType & BITFLAG_EXTERNAL);
  }
  isIntTexture(): boolean {
    return !!(this.detail.textureType & BITFLAG_INT);
  }
  isUIntTexture(): boolean {
    return !!(this.detail.textureType & BITFLAG_UINT);
  }
  isTextureType(): this is PBTextureTypeInfo {
    return true;
  }
  toTypeName(deviceType: DeviceType, varName?: string): string {
    if (deviceType === 'webgpu') {
      let typename = textureTypeMapWGSL[this.textureType];
      if (this.isStorageTexture()) {
        const storageTexelFormat = storageTexelFormatMap[this.storageTexelFormat];
        // storage textures currently only support 'write' access control
        const accessMode = 'write'; //this.readable ? (this.writable ? 'read_write' : 'read') : 'write';
        typename = `${typename}<${storageTexelFormat}, ${accessMode}>`;
      }
      return varName ? `${varName}: ${typename}` : typename;
    } else {
      const typename = (deviceType === 'webgl' ? textureTypeMapWebGL : textureTypeMapWebGL2)[this.textureType];
      assert(!!typename, 'unsupported texture type');
      return varName ? `${typename} ${varName}` : typename;
    }
  }
  toBufferLayout(offset: number): UniformBufferLayout {
    return null;
  }
  /** @internal */
  protected genTypeId(): string {
    return `TEXTURE:${this.textureType}`;
  }
}

export class PBFunctionTypeInfo extends PBTypeInfo<FunctionTypeDetail> {
  constructor(name: string, returnType: PBTypeInfo, argTypes: { type: PBTypeInfo, byRef?: boolean }[]) {
    super(PBTypeClass.FUNCTION, {
      name,
      returnType,
      argTypes
    });
  }
  get name(): string {
    return this.detail.name;
  }
  get returnType(): PBTypeInfo {
    return this.detail.returnType;
  }
  get argTypes(): { type: PBTypeInfo, byRef?: boolean }[] {
    return this.detail.argTypes;
  }
  /** @internal */
  protected genTypeId(): string {
    return `FUNCTION:(${this.argTypes.map(val => val.type.typeId).join(',')}):${this.returnType?.typeId || 'void'}`;
  }
  toBufferLayout(offset: number): UniformBufferLayout {
    return null;
  }
  toTypeName(deviceType: DeviceType, varName?: string): string {
    throw new Error('not supported');
  }
}

export const typeF16 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.F16);
export const typeF16Vec2 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.F16VEC2);
export const typeF16Vec3 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.F16VEC3);
export const typeF16Vec4 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.F16VEC4);
export const typeF32 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.F32);
export const typeF32Vec2 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.F32VEC2);
export const typeF32Vec3 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.F32VEC3);
export const typeF32Vec4 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.F32VEC4);
export const typeI8 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I8);
export const typeI8Vec2 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I8VEC2);
export const typeI8Vec3 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I8VEC3);
export const typeI8Vec4 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I8VEC4);
export const typeI8_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I8_NORM);
export const typeI8Vec2_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I8VEC2_NORM);
export const typeI8Vec3_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I8VEC3_NORM);
export const typeI8Vec4_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I8VEC4_NORM);
export const typeI16 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I16);
export const typeI16Vec2 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I16VEC2);
export const typeI16Vec3 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I16VEC3);
export const typeI16Vec4 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I16VEC4);
export const typeI16_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I16_NORM);
export const typeI16Vec2_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I16VEC2_NORM);
export const typeI16Vec3_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I16VEC3_NORM);
export const typeI16Vec4_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I16VEC4_NORM);
export const typeI32 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I32);
export const typeI32Vec2 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I32VEC2);
export const typeI32Vec3 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I32VEC3);
export const typeI32Vec4 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I32VEC4);
export const typeI32_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I32);
export const typeI32Vec2_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I32VEC2_NORM);
export const typeI32Vec3_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I32VEC3_NORM);
export const typeI32Vec4_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.I32VEC4_NORM);
export const typeU8 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U8);
export const typeU8Vec2 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U8VEC2);
export const typeU8Vec3 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U8VEC3);
export const typeU8Vec4 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U8VEC4);
export const typeU8_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U8_NORM);
export const typeU8Vec2_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U8VEC2_NORM);
export const typeU8Vec3_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U8VEC3_NORM);
export const typeU8Vec4_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U8VEC4_NORM);
export const typeU16 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U16);
export const typeU16Vec2 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U16VEC2);
export const typeU16Vec3 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U16VEC3);
export const typeU16Vec4 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U16VEC4);
export const typeU16_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U16_NORM);
export const typeU16Vec2_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U16VEC2_NORM);
export const typeU16Vec3_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U16VEC3_NORM);
export const typeU16Vec4_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U16VEC4_NORM);
export const typeU32 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U32);
export const typeU32Vec2 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U32VEC2);
export const typeU32Vec3 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U32VEC3);
export const typeU32Vec4 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U32VEC4);
export const typeU32_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U32_NORM);
export const typeU32Vec2_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U32VEC2_NORM);
export const typeU32Vec3_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U32VEC3_NORM);
export const typeU32Vec4_Norm = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.U32VEC4_NORM);
export const typeBool = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.BOOL);
export const typeBVec2 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.BVEC2);
export const typeBVec3 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.BVEC3);
export const typeBVec4 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.BVEC4);
export const typeMat2 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.MAT2);
export const typeMat2x3 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.MAT2x3);
export const typeMat2x4 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.MAT2x4);
export const typeMat3x2 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.MAT3x2);
export const typeMat3 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.MAT3);
export const typeMat3x4 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.MAT3x4);
export const typeMat4x2 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.MAT4x2);
export const typeMat4x3 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.MAT4x3);
export const typeMat4 = PBPrimitiveTypeInfo.getCachedTypeInfo(PBPrimitiveType.MAT4);
export const typeTex1D = new PBTextureTypeInfo(PBTextureType.TEX_1D);
export const typeITex1D = new PBTextureTypeInfo(PBTextureType.ITEX_1D);
export const typeUTex1D = new PBTextureTypeInfo(PBTextureType.UTEX_1D);
export const typeTex2D = new PBTextureTypeInfo(PBTextureType.TEX_2D);
export const typeITex2D = new PBTextureTypeInfo(PBTextureType.ITEX_2D);
export const typeUTex2D = new PBTextureTypeInfo(PBTextureType.UTEX_2D);
export const typeTex2DArray = new PBTextureTypeInfo(PBTextureType.TEX_2D_ARRAY);
export const typeITex2DArray = new PBTextureTypeInfo(PBTextureType.ITEX_2D_ARRAY);
export const typeUTex2DArray = new PBTextureTypeInfo(PBTextureType.UTEX_2D_ARRAY);
export const typeTex3D = new PBTextureTypeInfo(PBTextureType.TEX_3D);
export const typeITex3D = new PBTextureTypeInfo(PBTextureType.ITEX_3D);
export const typeUTex3D = new PBTextureTypeInfo(PBTextureType.UTEX_3D);
export const typeTexCube = new PBTextureTypeInfo(PBTextureType.TEX_CUBE);
export const typeITexCube = new PBTextureTypeInfo(PBTextureType.ITEX_CUBE);
export const typeUTexCube = new PBTextureTypeInfo(PBTextureType.UTEX_CUBE);
export const typeTexExternal = new PBTextureTypeInfo(PBTextureType.TEX_EXTERNAL);
export const typeTexCubeArray = new PBTextureTypeInfo(PBTextureType.TEX_CUBE_ARRAY);
export const typeITexCubeArray = new PBTextureTypeInfo(PBTextureType.ITEX_CUBE_ARRAY);
export const typeUTexCubeArray = new PBTextureTypeInfo(PBTextureType.UTEX_CUBE_ARRAY);
export const typeTexMultisampled2D = new PBTextureTypeInfo(PBTextureType.TEX_MULTISAMPLED_2D);
export const typeITexMultisampled2D = new PBTextureTypeInfo(PBTextureType.ITEX_MULTISAMPLED_2D);
export const typeUTexMultisampled2D = new PBTextureTypeInfo(PBTextureType.UTEX_MULTISAMPLED_2D);
export const typeTexStorage1D_rgba8unorm = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_1D, TextureFormat.RGBA8UNORM);
export const typeTexStorage1D_rgba8snorm = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_1D, TextureFormat.RGBA8SNORM);
export const typeTexStorage1D_bgra8unorm = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_1D, TextureFormat.BGRA8UNORM);
export const typeTexStorage1D_rgba8uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_1D, TextureFormat.RGBA8UI);
export const typeTexStorage1D_rgba8sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_1D, TextureFormat.RGBA8I);
export const typeTexStorage1D_rgba16uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_1D, TextureFormat.RGBA16UI);
export const typeTexStorage1D_rgba16sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_1D, TextureFormat.RGBA16I);
export const typeTexStorage1D_rgba16float = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_1D, TextureFormat.RGBA16F);
export const typeTexStorage1D_rgba32uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_1D, TextureFormat.RGBA32UI);
export const typeTexStorage1D_rgba32sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_1D, TextureFormat.RGBA32I);
export const typeTexStorage1D_rgba32float = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_1D, TextureFormat.RGBA32F);
export const typeTexStorage1D_rg32uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_1D, TextureFormat.RG32UI);
export const typeTexStorage1D_rg32sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_1D, TextureFormat.RG32I);
export const typeTexStorage1D_rg32float = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_1D, TextureFormat.RG32F);
export const typeTexStorage1D_r32uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_1D, TextureFormat.R32UI);
export const typeTexStorage1D_r32sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_1D, TextureFormat.R32I);
export const typeTexStorage1D_r32float = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_1D, TextureFormat.R32F);
export const typeTexStorage2D_rgba8unorm = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D, TextureFormat.RGBA8UNORM);
export const typeTexStorage2D_rgba8snorm = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D, TextureFormat.RGBA8SNORM);
export const typeTexStorage2D_bgra8unorm = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D, TextureFormat.BGRA8UNORM);
export const typeTexStorage2D_rgba8uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D, TextureFormat.RGBA8UI);
export const typeTexStorage2D_rgba8sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D, TextureFormat.RGBA8I);
export const typeTexStorage2D_rgba16uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D, TextureFormat.RGBA16UI);
export const typeTexStorage2D_rgba16sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D, TextureFormat.RGBA16I);
export const typeTexStorage2D_rgba16float = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D, TextureFormat.RGBA16F);
export const typeTexStorage2D_rgba32uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D, TextureFormat.RGBA32UI);
export const typeTexStorage2D_rgba32sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D, TextureFormat.RGBA32I);
export const typeTexStorage2D_rgba32float = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D, TextureFormat.RGBA32F);
export const typeTexStorage2D_rg32uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D, TextureFormat.RG32UI);
export const typeTexStorage2D_rg32sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D, TextureFormat.RG32I);
export const typeTexStorage2D_rg32float = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D, TextureFormat.RG32F);
export const typeTexStorage2D_r32uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D, TextureFormat.R32UI);
export const typeTexStorage2D_r32sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D, TextureFormat.R32I);
export const typeTexStorage2D_r32float = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D, TextureFormat.R32F);
export const typeTexStorage2DArray_rgba8unorm = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D_ARRAY, TextureFormat.RGBA8UNORM);
export const typeTexStorage2DArray_rgba8snorm = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D_ARRAY, TextureFormat.RGBA8SNORM);
export const typeTexStorage2DArray_bgra8unorm = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D_ARRAY, TextureFormat.BGRA8UNORM);
export const typeTexStorage2DArray_rgba8uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D_ARRAY, TextureFormat.RGBA8UI);
export const typeTexStorage2DArray_rgba8sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D_ARRAY, TextureFormat.RGBA8I);
export const typeTexStorage2DArray_rgba16uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D_ARRAY, TextureFormat.RGBA16UI);
export const typeTexStorage2DArray_rgba16sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D_ARRAY, TextureFormat.RGBA16I);
export const typeTexStorage2DArray_rgba16float = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D_ARRAY, TextureFormat.RGBA16F);
export const typeTexStorage2DArray_rgba32uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D_ARRAY, TextureFormat.RGBA32UI);
export const typeTexStorage2DArray_rgba32sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D_ARRAY, TextureFormat.RGBA32I);
export const typeTexStorage2DArray_rgba32float = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D_ARRAY, TextureFormat.RGBA32F);
export const typeTexStorage2DArray_rg32uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D_ARRAY, TextureFormat.RG32UI);
export const typeTexStorage2DArray_rg32sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D_ARRAY, TextureFormat.RG32I);
export const typeTexStorage2DArray_rg32float = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D_ARRAY, TextureFormat.RG32F);
export const typeTexStorage2DArray_r32uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D_ARRAY, TextureFormat.R32UI);
export const typeTexStorage2DArray_r32sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D_ARRAY, TextureFormat.R32I);
export const typeTexStorage2DArray_r32float = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_2D_ARRAY, TextureFormat.R32F);
export const typeTexStorage3D_rgba8unorm = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_3D, TextureFormat.RGBA8UNORM);
export const typeTexStorage3D_rgba8snorm = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_3D, TextureFormat.RGBA8SNORM);
export const typeTexStorage3D_bgra8unorm = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_3D, TextureFormat.BGRA8UNORM);
export const typeTexStorage3D_rgba8uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_3D, TextureFormat.RGBA8UI);
export const typeTexStorage3D_rgba8sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_3D, TextureFormat.RGBA8I);
export const typeTexStorage3D_rgba16uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_3D, TextureFormat.RGBA16UI);
export const typeTexStorage3D_rgba16sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_3D, TextureFormat.RGBA16I);
export const typeTexStorage3D_rgba16float = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_3D, TextureFormat.RGBA16F);
export const typeTexStorage3D_rgba32uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_3D, TextureFormat.RGBA32UI);
export const typeTexStorage3D_rgba32sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_3D, TextureFormat.RGBA32I);
export const typeTexStorage3D_rgba32float = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_3D, TextureFormat.RGBA32F);
export const typeTexStorage3D_rg32uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_3D, TextureFormat.RG32UI);
export const typeTexStorage3D_rg32sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_3D, TextureFormat.RG32I);
export const typeTexStorage3D_rg32float = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_3D, TextureFormat.RG32F);
export const typeTexStorage3D_r32uint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_3D, TextureFormat.R32UI);
export const typeTexStorage3D_r32sint = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_3D, TextureFormat.R32I);
export const typeTexStorage3D_r32float = new PBTextureTypeInfo(PBTextureType.TEX_STORAGE_3D, TextureFormat.R32F);
export const typeTexDepth2D = new PBTextureTypeInfo(PBTextureType.TEX_DEPTH_2D);
export const typeTexDepth2DArray = new PBTextureTypeInfo(PBTextureType.TEX_DEPTH_2D_ARRAY);
export const typeTexDepthCube = new PBTextureTypeInfo(PBTextureType.TEX_DEPTH_CUBE);
export const typeTexDepthCubeArray = new PBTextureTypeInfo(PBTextureType.TEX_DEPTH_CUBE_ARRAY);
export const typeTexDepthMultisampled2D = new PBTextureTypeInfo(PBTextureType.TEX_DEPTH_MULTISAMPLED_2D);
export const typeSampler = new PBSamplerTypeInfo(PBSamplerAccessMode.SAMPLE);
export const typeSamplerComparison = new PBSamplerTypeInfo(PBSamplerAccessMode.COMPARISON);
export const typeVoid = new PBVoidTypeInfo();
export const typeFrexpResult = new PBStructTypeInfo('FrexpResult', 'default', [{ name: 'sig', type: typeF32 }, { name: 'exp', type: typeI32 }]);
export const typeFrexpResultVec2 = new PBStructTypeInfo('FrexpResultVec2', 'default', [{ name: 'sig', type: typeF32Vec2 }, { name: 'exp', type: typeI32Vec2 }]);
export const typeFrexpResultVec3 = new PBStructTypeInfo('FrexpResultVec3', 'default', [{ name: 'sig', type: typeF32Vec3 }, { name: 'exp', type: typeI32Vec3 }]);
export const typeFrexpResultVec4 = new PBStructTypeInfo('FrexpResultVec4', 'default', [{ name: 'sig', type: typeF32Vec4 }, { name: 'exp', type: typeI32Vec4 }]);
