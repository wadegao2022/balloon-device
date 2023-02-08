import { Device } from './device';
import { TypedArray } from '../defs';
import {
  ShaderType,
  PrimitiveType,
  TextureTarget,
  TextureFormat,
  TextureWrapping,
  TextureFilter,
  CompareFunc,
} from './base_types';
import { PBTypeInfo, PBArrayTypeInfo, PBPrimitiveTypeInfo, PBStructTypeInfo, PBPrimitiveType } from './builder/types';
import { VectorBase, CubeFace } from '../math';

export type TextureImageElement = ImageBitmap | HTMLCanvasElement;

export const MAX_VERTEX_ATTRIBUTES = 16;
export const MAX_BINDING_GROUPS = 4;
export const MAX_TEXCOORD_INDEX_COUNT = 8;

export const VERTEX_ATTRIB_POSITION = 0;
export const VERTEX_ATTRIB_NORMAL = 1;
export const VERTEX_ATTRIB_DIFFUSE = 2;
export const VERTEX_ATTRIB_TANGENT = 3;
export const VERTEX_ATTRIB_TEXCOORD0 = 4;
export const VERTEX_ATTRIB_TEXCOORD1 = 5;
export const VERTEX_ATTRIB_TEXCOORD2 = 6;
export const VERTEX_ATTRIB_TEXCOORD3 = 7;
export const VERTEX_ATTRIB_TEXCOORD4 = 8;
export const VERTEX_ATTRIB_TEXCOORD5 = 9;
export const VERTEX_ATTRIB_TEXCOORD6 = 10;
export const VERTEX_ATTRIB_TEXCOORD7 = 11;
export const VERTEX_ATTRIB_BLEND_WEIGHT = 12;
export const VERTEX_ATTRIB_BLEND_INDICES = 13;
export const VERTEX_ATTRIB_CUSTOM0 = 14;
export const VERTEX_ATTRIB_CUSTOM1 = 15;

const vertexAttribFormatMap = {
  position_u8normx2: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.U8VEC2_NORM, 2],
  position_u8normx4: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.U8VEC4_NORM, 4],
  position_i8normx2: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.I8VEC2_NORM, 2],
  position_i8normx4: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.I8VEC4_NORM, 4],
  position_u16x2: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.U16VEC2, 4],
  position_u16x4: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.U16VEC4, 8],
  position_i16x2: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.I16VEC2, 4],
  position_i16x4: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.I16VEC4, 8],
  position_u16normx2: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.U16VEC2_NORM, 4],
  position_u16normx4: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.U16VEC4_NORM, 8],
  position_i16normx2: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.I16VEC2_NORM, 4],
  position_i16normx4: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.I16VEC4_NORM, 8],
  position_f16x2: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.F16VEC2, 4],
  position_f16x4: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.F16VEC4, 8],
  position_f32: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.F32, 4],
  position_f32x2: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.F32VEC2, 8],
  position_f32x3: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.F32VEC3, 12],
  position_f32x4: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.F32VEC4, 16],
  position_i32: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.I32, 4],
  position_i32x2: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.I32VEC2, 8],
  position_i32x3: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.I32VEC3, 12],
  position_i32x4: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.I32VEC4, 16],
  position_u32: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.U32, 4],
  position_u32x2: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.U32VEC2, 8],
  position_u32x3: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.U32VEC3, 12],
  position_u32x4: [VERTEX_ATTRIB_POSITION, PBPrimitiveType.U32VEC4, 16],
  normal_f16x4: [VERTEX_ATTRIB_NORMAL, PBPrimitiveType.F16VEC4, 8],
  normal_f32x3: [VERTEX_ATTRIB_NORMAL, PBPrimitiveType.F32VEC3, 12],
  normal_f32x4: [VERTEX_ATTRIB_NORMAL, PBPrimitiveType.F32VEC4, 16],
  diffuse_u8normx4: [VERTEX_ATTRIB_DIFFUSE, PBPrimitiveType.U8VEC4_NORM, 4],
  diffuse_u16x4: [VERTEX_ATTRIB_DIFFUSE, PBPrimitiveType.U16VEC4, 8],
  diffuse_u16normx4: [VERTEX_ATTRIB_DIFFUSE, PBPrimitiveType.U16VEC4_NORM, 8],
  diffuse_f16x4: [VERTEX_ATTRIB_DIFFUSE, PBPrimitiveType.F16VEC4, 8],
  diffuse_f32x3: [VERTEX_ATTRIB_DIFFUSE, PBPrimitiveType.F32VEC3, 12],
  diffuse_f32x4: [VERTEX_ATTRIB_DIFFUSE, PBPrimitiveType.F32VEC4, 16],
  diffuse_u32x3: [VERTEX_ATTRIB_DIFFUSE, PBPrimitiveType.U32VEC3, 12],
  diffuse_u32x4: [VERTEX_ATTRIB_DIFFUSE, PBPrimitiveType.U32VEC4, 16],
  tangent_f16x4: [VERTEX_ATTRIB_TANGENT, PBPrimitiveType.F16VEC4, 8],
  tangent_f32x3: [VERTEX_ATTRIB_TANGENT, PBPrimitiveType.F32VEC3, 12],
  tangent_f32x4: [VERTEX_ATTRIB_TANGENT, PBPrimitiveType.F32VEC4, 16],
  tex0_u8normx2: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.U8VEC2_NORM, 2],
  tex0_u8normx4: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.U8VEC4_NORM, 4],
  tex0_i8normx2: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.I8VEC2_NORM, 2],
  tex0_i8normx4: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.I8VEC4_NORM, 4],
  tex0_u16x2: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.U16VEC2, 4],
  tex0_u16x4: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.U16VEC4, 8],
  tex0_i16x2: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.I16VEC2, 4],
  tex0_i16x4: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.I16VEC4, 8],
  tex0_u16normx2: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.U16VEC2_NORM, 4],
  tex0_u16normx4: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.U16VEC4_NORM, 8],
  tex0_i16normx2: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.I16VEC2_NORM, 4],
  tex0_i16normx4: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.I16VEC4_NORM, 8],
  tex0_f16x2: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.F16VEC2, 4],
  tex0_f16x4: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.F16VEC4, 8],
  tex0_f32: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.F32, 4],
  tex0_f32x2: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.F32VEC2, 8],
  tex0_f32x3: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.F32VEC3, 12],
  tex0_f32x4: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.F32VEC4, 16],
  tex0_i32: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.I32, 4],
  tex0_i32x2: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.I32VEC2, 8],
  tex0_i32x3: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.I32VEC3, 12],
  tex0_i32x4: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.I32VEC4, 16],
  tex0_u32: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.U32, 4],
  tex0_u32x2: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.U32VEC2, 8],
  tex0_u32x3: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.U32VEC3, 12],
  tex0_u32x4: [VERTEX_ATTRIB_TEXCOORD0, PBPrimitiveType.U32VEC4, 16],
  tex1_u8normx2: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.U8VEC2_NORM, 2],
  tex1_u8normx4: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.U8VEC4_NORM, 4],
  tex1_i8normx2: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.I8VEC2_NORM, 2],
  tex1_i8normx4: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.I8VEC4_NORM, 4],
  tex1_u16x2: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.U16VEC2, 4],
  tex1_u16x4: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.U16VEC4, 8],
  tex1_i16x2: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.I16VEC2, 4],
  tex1_i16x4: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.I16VEC4, 8],
  tex1_u16normx2: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.U16VEC2_NORM, 4],
  tex1_u16normx4: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.U16VEC4_NORM, 8],
  tex1_i16normx2: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.I16VEC2_NORM, 4],
  tex1_i16normx4: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.I16VEC4_NORM, 8],
  tex1_f16x2: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.F16VEC2, 4],
  tex1_f16x4: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.F16VEC4, 8],
  tex1_f32: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.F32, 4],
  tex1_f32x2: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.F32VEC2, 8],
  tex1_f32x3: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.F32VEC3, 12],
  tex1_f32x4: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.F32VEC4, 16],
  tex1_i32: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.I32, 4],
  tex1_i32x2: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.I32VEC2, 8],
  tex1_i32x3: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.I32VEC3, 12],
  tex1_i32x4: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.I32VEC4, 16],
  tex1_u32: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.U32, 4],
  tex1_u32x2: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.U32VEC2, 8],
  tex1_u32x3: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.U32VEC3, 12],
  tex1_u32x4: [VERTEX_ATTRIB_TEXCOORD1, PBPrimitiveType.U32VEC4, 16],
  tex2_u8normx2: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.U8VEC2_NORM, 2],
  tex2_u8normx4: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.U8VEC4_NORM, 4],
  tex2_i8normx2: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.I8VEC2_NORM, 2],
  tex2_i8normx4: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.I8VEC4_NORM, 4],
  tex2_u16x2: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.U16VEC2, 4],
  tex2_u16x4: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.U16VEC4, 8],
  tex2_i16x2: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.I16VEC2, 4],
  tex2_i16x4: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.I16VEC4, 8],
  tex2_u16normx2: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.U16VEC2_NORM, 4],
  tex2_u16normx4: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.U16VEC4_NORM, 8],
  tex2_i16normx2: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.I16VEC2_NORM, 4],
  tex2_i16normx4: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.I16VEC4_NORM, 8],
  tex2_f16x2: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.F16VEC2, 4],
  tex2_f16x4: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.F16VEC4, 8],
  tex2_f32: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.F32, 4],
  tex2_f32x2: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.F32VEC2, 8],
  tex2_f32x3: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.F32VEC3, 12],
  tex2_f32x4: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.F32VEC4, 16],
  tex2_i32: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.I32, 4],
  tex2_i32x2: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.I32VEC2, 8],
  tex2_i32x3: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.I32VEC3, 12],
  tex2_i32x4: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.I32VEC4, 16],
  tex2_u32: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.U32, 4],
  tex2_u32x2: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.U32VEC2, 8],
  tex2_u32x3: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.U32VEC3, 12],
  tex2_u32x4: [VERTEX_ATTRIB_TEXCOORD2, PBPrimitiveType.U32VEC4, 16],
  tex3_u8normx2: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.U8VEC2_NORM, 2],
  tex3_u8normx4: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.U8VEC4_NORM, 4],
  tex3_i8normx2: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.I8VEC2_NORM, 2],
  tex3_i8normx4: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.I8VEC4_NORM, 4],
  tex3_u16x2: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.U16VEC2, 4],
  tex3_u16x4: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.U16VEC4, 8],
  tex3_i16x2: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.I16VEC2, 4],
  tex3_i16x4: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.I16VEC4, 8],
  tex3_u16normx2: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.U16VEC2_NORM, 4],
  tex3_u16normx4: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.U16VEC4_NORM, 8],
  tex3_i16normx2: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.I16VEC2_NORM, 4],
  tex3_i16normx4: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.I16VEC4_NORM, 8],
  tex3_f16x2: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.F16VEC2, 4],
  tex3_f16x4: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.F16VEC4, 8],
  tex3_f32: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.F32, 4],
  tex3_f32x2: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.F32VEC2, 8],
  tex3_f32x3: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.F32VEC3, 12],
  tex3_f32x4: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.F32VEC4, 16],
  tex3_i32: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.I32, 4],
  tex3_i32x2: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.I32VEC2, 8],
  tex3_i32x3: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.I32VEC3, 12],
  tex3_i32x4: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.I32VEC4, 16],
  tex3_u32: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.U32, 4],
  tex3_u32x2: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.U32VEC2, 8],
  tex3_u32x3: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.U32VEC3, 12],
  tex3_u32x4: [VERTEX_ATTRIB_TEXCOORD3, PBPrimitiveType.U32VEC4, 16],
  tex4_u8normx2: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.U8VEC2_NORM, 2],
  tex4_u8normx4: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.U8VEC4_NORM, 4],
  tex4_i8normx2: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.I8VEC2_NORM, 2],
  tex4_i8normx4: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.I8VEC4_NORM, 4],
  tex4_u16x2: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.U16VEC2, 4],
  tex4_u16x4: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.U16VEC4, 8],
  tex4_i16x2: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.I16VEC2, 4],
  tex4_i16x4: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.I16VEC4, 8],
  tex4_u16normx2: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.U16VEC2_NORM, 4],
  tex4_u16normx4: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.U16VEC4_NORM, 8],
  tex4_i16normx2: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.I16VEC2_NORM, 4],
  tex4_i16normx4: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.I16VEC4_NORM, 8],
  tex4_f16x2: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.F16VEC2, 4],
  tex4_f16x4: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.F16VEC4, 8],
  tex4_f32: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.F32, 4],
  tex4_f32x2: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.F32VEC2, 8],
  tex4_f32x3: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.F32VEC3, 12],
  tex4_f32x4: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.F32VEC4, 16],
  tex4_i32: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.I32, 4],
  tex4_i32x2: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.I32VEC2, 8],
  tex4_i32x3: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.I32VEC3, 12],
  tex4_i32x4: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.I32VEC4, 16],
  tex4_u32: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.U32, 4],
  tex4_u32x2: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.U32VEC2, 8],
  tex4_u32x3: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.U32VEC3, 12],
  tex4_u32x4: [VERTEX_ATTRIB_TEXCOORD4, PBPrimitiveType.U32VEC4, 16],
  tex5_u8normx2: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.U8VEC2_NORM, 2],
  tex5_u8normx4: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.U8VEC4_NORM, 4],
  tex5_i8normx2: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.I8VEC2_NORM, 2],
  tex5_i8normx4: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.I8VEC4_NORM, 4],
  tex5_u16x2: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.U16VEC2, 4],
  tex5_u16x4: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.U16VEC4, 8],
  tex5_i16x2: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.I16VEC2, 4],
  tex5_i16x4: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.I16VEC4, 8],
  tex5_u16normx2: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.U16VEC2_NORM, 4],
  tex5_u16normx4: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.U16VEC4_NORM, 8],
  tex5_i16normx2: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.I16VEC2_NORM, 4],
  tex5_i16normx4: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.I16VEC4_NORM, 8],
  tex5_f16x2: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.F16VEC2, 4],
  tex5_f16x4: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.F16VEC4, 8],
  tex5_f32: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.F32, 4],
  tex5_f32x2: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.F32VEC2, 8],
  tex5_f32x3: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.F32VEC3, 12],
  tex5_f32x4: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.F32VEC4, 16],
  tex5_i32: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.I32, 4],
  tex5_i32x2: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.I32VEC2, 8],
  tex5_i32x3: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.I32VEC3, 12],
  tex5_i32x4: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.I32VEC4, 16],
  tex5_u32: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.U32, 4],
  tex5_u32x2: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.U32VEC2, 8],
  tex5_u32x3: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.U32VEC3, 12],
  tex5_u32x4: [VERTEX_ATTRIB_TEXCOORD5, PBPrimitiveType.U32VEC4, 16],
  tex6_u8normx2: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.U8VEC2_NORM, 2],
  tex6_u8normx4: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.U8VEC4_NORM, 4],
  tex6_i8normx2: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.I8VEC2_NORM, 2],
  tex6_i8normx4: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.I8VEC4_NORM, 4],
  tex6_u16x2: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.U16VEC2, 4],
  tex6_u16x4: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.U16VEC4, 8],
  tex6_i16x2: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.I16VEC2, 4],
  tex6_i16x4: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.I16VEC4, 8],
  tex6_u16normx2: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.U16VEC2_NORM, 4],
  tex6_u16normx4: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.U16VEC4_NORM, 8],
  tex6_i16normx2: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.I16VEC2_NORM, 4],
  tex6_i16normx4: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.I16VEC4_NORM, 8],
  tex6_f16x2: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.F16VEC2, 4],
  tex6_f16x4: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.F16VEC4, 8],
  tex6_f32: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.F32, 4],
  tex6_f32x2: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.F32VEC2, 8],
  tex6_f32x3: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.F32VEC3, 12],
  tex6_f32x4: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.F32VEC4, 16],
  tex6_i32: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.I32, 4],
  tex6_i32x2: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.I32VEC2, 8],
  tex6_i32x3: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.I32VEC3, 12],
  tex6_i32x4: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.I32VEC4, 16],
  tex6_u32: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.U32, 4],
  tex6_u32x2: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.U32VEC2, 8],
  tex6_u32x3: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.U32VEC3, 12],
  tex6_u32x4: [VERTEX_ATTRIB_TEXCOORD6, PBPrimitiveType.U32VEC4, 16],
  tex7_u8normx2: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.U8VEC2_NORM, 2],
  tex7_u8normx4: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.U8VEC4_NORM, 4],
  tex7_i8normx2: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.I8VEC2_NORM, 2],
  tex7_i8normx4: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.I8VEC4_NORM, 4],
  tex7_u16x2: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.U16VEC2, 4],
  tex7_u16x4: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.U16VEC4, 8],
  tex7_i16x2: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.I16VEC2, 4],
  tex7_i16x4: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.I16VEC4, 8],
  tex7_u16normx2: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.U16VEC2_NORM, 4],
  tex7_u16normx4: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.U16VEC4_NORM, 8],
  tex7_i16normx2: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.I16VEC2_NORM, 4],
  tex7_i16normx4: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.I16VEC4_NORM, 8],
  tex7_f16x2: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.F16VEC2, 4],
  tex7_f16x4: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.F16VEC4, 8],
  tex7_f32: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.F32, 4],
  tex7_f32x2: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.F32VEC2, 8],
  tex7_f32x3: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.F32VEC3, 12],
  tex7_f32x4: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.F32VEC4, 16],
  tex7_i32: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.I32, 4],
  tex7_i32x2: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.I32VEC2, 8],
  tex7_i32x3: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.I32VEC3, 12],
  tex7_i32x4: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.I32VEC4, 16],
  tex7_u32: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.U32, 4],
  tex7_u32x2: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.U32VEC2, 8],
  tex7_u32x3: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.U32VEC3, 12],
  tex7_u32x4: [VERTEX_ATTRIB_TEXCOORD7, PBPrimitiveType.U32VEC4, 16],
  blendweights_f16x4: [VERTEX_ATTRIB_BLEND_WEIGHT, PBPrimitiveType.F16VEC4, 8],
  blendweights_f32x4: [VERTEX_ATTRIB_BLEND_WEIGHT, PBPrimitiveType.F32VEC4, 16],
  blendindices_u16x4: [VERTEX_ATTRIB_BLEND_INDICES, PBPrimitiveType.U16VEC4, 8],
  blendindices_f16x4: [VERTEX_ATTRIB_BLEND_INDICES, PBPrimitiveType.F16VEC4, 8],
  blendindices_f32x4: [VERTEX_ATTRIB_BLEND_INDICES, PBPrimitiveType.F32VEC4, 16],
  blendindices_u32x4: [VERTEX_ATTRIB_BLEND_INDICES, PBPrimitiveType.U32VEC4, 16],
  custom0_u8normx2: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.U8VEC2_NORM, 2],
  custom0_u8normx4: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.U8VEC4_NORM, 4],
  custom0_i8normx2: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.I8VEC2_NORM, 2],
  custom0_i8normx4: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.I8VEC4_NORM, 4],
  custom0_u16x2: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.U16VEC2, 4],
  custom0_u16x4: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.U16VEC4, 8],
  custom0_i16x2: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.I16VEC2, 4],
  custom0_i16x4: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.I16VEC4, 8],
  custom0_u16normx2: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.U16VEC2_NORM, 4],
  custom0_u16normx4: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.U16VEC4_NORM, 8],
  custom0_i16normx2: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.I16VEC2_NORM, 4],
  custom0_i16normx4: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.I16VEC4_NORM, 8],
  custom0_f16x2: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.F16VEC2, 4],
  custom0_f16x4: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.F16VEC4, 8],
  custom0_f32: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.F32, 4],
  custom0_f32x2: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.F32VEC2, 8],
  custom0_f32x3: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.F32VEC3, 12],
  custom0_f32x4: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.F32VEC4, 16],
  custom0_i32: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.I32, 4],
  custom0_i32x2: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.I32VEC2, 8],
  custom0_i32x3: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.I32VEC3, 12],
  custom0_i32x4: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.I32VEC4, 16],
  custom0_u32: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.U32, 4],
  custom0_u32x2: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.U32VEC2, 8],
  custom0_u32x3: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.U32VEC3, 12],
  custom0_u32x4: [VERTEX_ATTRIB_CUSTOM0, PBPrimitiveType.U32VEC4, 16],
  custom1_u8normx2: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.U8VEC2_NORM, 2],
  custom1_u8normx4: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.U8VEC4_NORM, 4],
  custom1_i8normx2: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.I8VEC2_NORM, 2],
  custom1_i8normx4: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.I8VEC4_NORM, 4],
  custom1_u16x2: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.U16VEC2, 4],
  custom1_u16x4: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.U16VEC4, 8],
  custom1_i16x2: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.I16VEC2, 4],
  custom1_i16x4: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.I16VEC4, 8],
  custom1_u16normx2: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.U16VEC2_NORM, 4],
  custom1_u16normx4: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.U16VEC4_NORM, 8],
  custom1_i16normx2: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.I16VEC2_NORM, 4],
  custom1_i16normx4: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.I16VEC4_NORM, 8],
  custom1_f16x2: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.F16VEC2, 4],
  custom1_f16x4: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.F16VEC4, 8],
  custom1_f32: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.F32, 4],
  custom1_f32x2: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.F32VEC2, 8],
  custom1_f32x3: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.F32VEC3, 12],
  custom1_f32x4: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.F32VEC4, 16],
  custom1_i32: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.I32, 4],
  custom1_i32x2: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.I32VEC2, 8],
  custom1_i32x3: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.I32VEC3, 12],
  custom1_i32x4: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.I32VEC4, 16],
  custom1_u32: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.U32, 4],
  custom1_u32x2: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.U32VEC2, 8],
  custom1_u32x3: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.U32VEC3, 12],
  custom1_u32x4: [VERTEX_ATTRIB_CUSTOM1, PBPrimitiveType.U32VEC4, 16],
} as const;

export type VertexAttribFormat = keyof typeof vertexAttribFormatMap;

const vertexAttribNameMap = {
  position: VERTEX_ATTRIB_POSITION,
  normal: VERTEX_ATTRIB_NORMAL,
  diffuse: VERTEX_ATTRIB_DIFFUSE,
  tangent: VERTEX_ATTRIB_TANGENT,
  blendIndices: VERTEX_ATTRIB_BLEND_INDICES,
  blendWeights: VERTEX_ATTRIB_BLEND_WEIGHT,
  texCoord0: VERTEX_ATTRIB_TEXCOORD0,
  texCoord1: VERTEX_ATTRIB_TEXCOORD1,
  texCoord2: VERTEX_ATTRIB_TEXCOORD2,
  texCoord3: VERTEX_ATTRIB_TEXCOORD3,
  texCoord4: VERTEX_ATTRIB_TEXCOORD4,
  texCoord5: VERTEX_ATTRIB_TEXCOORD5,
  texCoord6: VERTEX_ATTRIB_TEXCOORD6,
  texCoord7: VERTEX_ATTRIB_TEXCOORD7,
  custom0: VERTEX_ATTRIB_CUSTOM0,
  custom1: VERTEX_ATTRIB_CUSTOM1,
} as const;

export type VertexAttribName = keyof typeof vertexAttribNameMap;

const vertexAttribNameRevMap = {
  [VERTEX_ATTRIB_POSITION]: 'position',
  [VERTEX_ATTRIB_NORMAL]: 'normal',
  [VERTEX_ATTRIB_DIFFUSE]: 'diffuse',
  [VERTEX_ATTRIB_TANGENT]: 'tangent',
  [VERTEX_ATTRIB_BLEND_INDICES]: 'blendIndices',
  [VERTEX_ATTRIB_BLEND_WEIGHT]: 'blendWeights',
  [VERTEX_ATTRIB_TEXCOORD0]: 'texCoord0',
  [VERTEX_ATTRIB_TEXCOORD1]: 'texCoord1',
  [VERTEX_ATTRIB_TEXCOORD2]: 'texCoord2',
  [VERTEX_ATTRIB_TEXCOORD3]: 'texCoord3',
  [VERTEX_ATTRIB_TEXCOORD4]: 'texCoord4',
  [VERTEX_ATTRIB_TEXCOORD5]: 'texCoord5',
  [VERTEX_ATTRIB_TEXCOORD6]: 'texCoord6',
  [VERTEX_ATTRIB_TEXCOORD7]: 'texCoord7',
  [VERTEX_ATTRIB_CUSTOM0]: 'custom0',
  [VERTEX_ATTRIB_CUSTOM1]: 'custom1',
} as const;

export enum GPUResourceUsageFlags {
  TF_LINEAR_COLOR_SPACE = (1 << 1),
  TF_NO_MIPMAP = (1 << 2),
  TF_WRITABLE = (1 << 3),
  TF_NO_GC = (1 << 4),
  BF_VERTEX = (1 << 5),
  BF_INDEX = (1 << 6),
  BF_READ = (1 << 7),
  BF_WRITE = (1 << 8),
  BF_UNIFORM = (1 << 9),
  BF_STORAGE = (1 << 10),
  DYNAMIC = (1 << 11),
  MANAGED = (1 << 12),
}

export function getVertexAttribByName(name: VertexAttribName): number {
  return vertexAttribNameMap[name];
}

export function getVertexAttribName(attrib: number): VertexAttribName {
  return vertexAttribNameRevMap[attrib];
}

export function getVertexFormatSize(fmt: VertexAttribFormat): number {
  return vertexAttribFormatMap[fmt][2];
}

export function getVertexBufferLength(vertexBufferType: PBStructTypeInfo) {
  return (vertexBufferType.structMembers[0].type as PBArrayTypeInfo).dimension;
}

export function getVertexBufferStride(vertexBufferType: PBStructTypeInfo) {
  const vertexType = (vertexBufferType.structMembers[0].type as PBArrayTypeInfo).elementType;
  if (vertexType.isStructType()) {
    let stride = 0;
    for (const member of vertexType.structMembers) {
      stride += (member.type as PBPrimitiveTypeInfo).getSize();
    }
    return stride;
  } else {
    return (vertexType as PBPrimitiveTypeInfo).getSize();
  }
}

export function getVertexBufferAttribType(vertexBufferType: PBStructTypeInfo, attrib: number): PBPrimitiveTypeInfo {
  const attribName = getVertexAttribName(attrib);
  if (!attribName) {
    return null;
  }
  const k = vertexBufferType.structMembers[0];
  const vertexType = (k.type as PBArrayTypeInfo).elementType;
  if (vertexType.isStructType()) {
    for (const member of vertexType.structMembers) {
      if (member.name === attribName) {
        return member.type as PBPrimitiveTypeInfo;
      }
    }
    return null;
  } else {
    return k.name === attribName ? vertexType as PBPrimitiveTypeInfo : null;
  }
}

export function makeVertexBufferType(length: number, ...attributes: VertexAttribFormat[]): PBStructTypeInfo {
  if (attributes.length === 0) {
    return null;
  }
  if (attributes.length === 1) {
    const format = vertexAttribFormatMap[attributes[0]];
    return new PBStructTypeInfo(null, 'packed', [{
      name: getVertexAttribName(format[0]),
      type: new PBArrayTypeInfo(PBPrimitiveTypeInfo.getCachedTypeInfo(format[1]), length),
    }]);
  } else {
    const vertexType = new PBStructTypeInfo(null, 'packed', attributes.map(attrib => ({
      name: getVertexAttribName(vertexAttribFormatMap[attrib][0]),
      type: PBPrimitiveTypeInfo.getCachedTypeInfo(vertexAttribFormatMap[attrib][1]),
    })));
    return new PBStructTypeInfo(null, 'packed', [{
      name: 'value',
      type: new PBArrayTypeInfo(vertexType, length),
    }]);
  }
}

export type VertexStepMode = 'vertex' | 'instance';

export const semanticList: string[] = (function () {
  const list: string[] = [];
  for (let i = 0; i < MAX_VERTEX_ATTRIBUTES; i++) {
    list.push(semanticToAttrib(i));
  }
  return list;
})();

export function semanticToAttrib(semantic: number): string {
  switch (semantic) {
    case VERTEX_ATTRIB_POSITION:
      return 'a_position';
    case VERTEX_ATTRIB_NORMAL:
      return 'a_normal';
    case VERTEX_ATTRIB_DIFFUSE:
      return 'a_diffuse';
    case VERTEX_ATTRIB_TANGENT:
      return 'a_tangent';
    case VERTEX_ATTRIB_TEXCOORD0:
      return 'a_texcoord0';
    case VERTEX_ATTRIB_TEXCOORD1:
      return 'a_texcoord1';
    case VERTEX_ATTRIB_TEXCOORD2:
      return 'a_texcoord2';
    case VERTEX_ATTRIB_TEXCOORD3:
      return 'a_texcoord3';
    case VERTEX_ATTRIB_TEXCOORD4:
      return 'a_texcoord4';
    case VERTEX_ATTRIB_TEXCOORD5:
      return 'a_texcoord5';
    case VERTEX_ATTRIB_TEXCOORD6:
      return 'a_texcoord6';
    case VERTEX_ATTRIB_TEXCOORD7:
      return 'a_texcoord7';
    case VERTEX_ATTRIB_BLEND_INDICES:
      return 'a_indices';
    case VERTEX_ATTRIB_BLEND_WEIGHT:
      return 'a_weight';
    case VERTEX_ATTRIB_CUSTOM0:
      return 'a_custom0';
    case VERTEX_ATTRIB_CUSTOM1:
      return 'a_custom1';
    default:
      return null;
  }
}

export interface TextureMipmapLevelData {
  data: TypedArray;
  width: number;
  height: number;
}

export class TextureLoadEvent {
  static readonly NAME = 'textureLoad';
  texture: BaseTexture;
  constructor(texture: BaseTexture) {
    this.texture = texture;
  }
}

export interface TextureMipmapData {
  width: number;
  height: number;
  depth: number;
  isCubemap: boolean;
  isVolume: boolean;
  isCompressed: boolean;
  arraySize: number;
  mipLevels: number;
  format: TextureFormat;
  mipDatas: TextureMipmapLevelData[][];
}

export interface IFrameBufferTextureAttachment {
  texture?: BaseTexture,
  face?: number,
  layer?: number,
  level?: number,
}

export interface IFrameBufferOptions {
  colorAttachments?: IFrameBufferTextureAttachment[];
  depthAttachment?: IFrameBufferTextureAttachment;
}

export interface UniformBufferLayout {
  byteSize: number;
  entries: UniformLayout[];
}

export interface UniformLayout {
  name: string;
  offset: number;
  byteSize: number;
  arraySize: number;
  type: PBPrimitiveType;
  subLayout: UniformBufferLayout;
}

export interface BufferBindingLayout {
  type?: 'uniform' | 'storage' | 'read-only-storage';
  hasDynamicOffset: boolean;
  uniformLayout: UniformBufferLayout;
  minBindingSize?: number;
}

export interface SamplerBindingLayout {
  type: 'filtering' | 'non-filtering' | 'comparison';
}

export interface TextureBindingLayout {
  sampleType: 'float' | 'unfilterable-float' | 'depth' | 'sint' | 'uint';
  viewDimension: '1d' | '2d' | '2d-array' | 'cube' | 'cube-array' | '3d';
  multisampled: boolean;
  autoBindSampler: string;
  autoBindSamplerComparison: string;
}

export interface StorageTextureBindingLayout {
  access: 'write-only';
  format: TextureFormat;
  viewDimension: '1d' | '2d';
}

export interface ExternalTextureBindingLayout {
  autoBindSampler: string;
}

export interface BindGroupLayoutEntry {
  binding: number;
  name: string;
  visibility: number;
  type: PBTypeInfo;
  buffer?: BufferBindingLayout;
  sampler?: SamplerBindingLayout;
  texture?: TextureBindingLayout;
  storageTexture?: StorageTextureBindingLayout;
  externalTexture?: ExternalTextureBindingLayout;
}

export interface BindGroupLayout {
  label?: string;
  nameMap?: { [name: string]: string };
  entries: BindGroupLayoutEntry[];
}

export interface BindPointInfo {
  group: number;
  binding: number;
  type: PBTypeInfo;
}

export interface SamplerOptions {
  addressU?: TextureWrapping,
  addressV?: TextureWrapping,
  addressW?: TextureWrapping,
  magFilter?: TextureFilter,
  minFilter?: TextureFilter,
  mipFilter?: TextureFilter,
  lodMin?: number,
  lodMax?: number,
  compare?: CompareFunc,
  maxAnisotropy?: number
}

export interface GPUObject<T = unknown> {
  readonly device: Device;
  readonly object: T;
  readonly uid: number;
  readonly cid: number;
  readonly disposed: boolean;
  name: string;
  restoreHandler: (tex: GPUObject) => Promise<void>;
  isVAO(): this is VertexInputLayout;
  isFramebuffer(): this is FrameBuffer;
  isSampler(): this is TextureSampler;
  isTexture(): this is BaseTexture;
  isTexture2D(): this is Texture2D;
  isTexture2DArray(): this is Texture2DArray;
  isTexture3D(): this is Texture3D;
  isTextureCube(): this is TextureCube;
  isTextureVideo(): this is TextureVideo;
  isProgram(): this is GPUProgram;
  isBuffer(): this is GPUDataBuffer;
  isBindGroup(): this is BindGroup;
  dispose(): void;
  reload(): Promise<void>;
  destroy(): void;
  restore(): Promise<void>;
}

export interface TextureSampler<T = unknown> extends GPUObject<T> {
  readonly addressModeU: TextureWrapping;
  readonly addressModeV: TextureWrapping;
  readonly addressModeW: TextureWrapping;
  readonly magFilter: TextureFilter;
  readonly minFilter: TextureFilter;
  readonly mipFilter: TextureFilter;
  readonly lodMin: number;
  readonly lodMax: number;
  readonly compare: CompareFunc;
  readonly maxAnisotropy: number;
}

export interface BaseTexture<T = unknown> extends GPUObject<T> {
  readonly target: TextureTarget;
  readonly linearColorSpace: boolean;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly format: TextureFormat;
  readonly mipLevelCount: number;
  init(): void;
  generateMipmaps(): void;
  isFloatFormat(): boolean;
  isIntegerFormat(): boolean;
  isSignedFormat(): boolean;
  isCompressedFormat(): boolean;
  isFilterable(): boolean;
  isDepth(): boolean;
  getDefaultSampler(comparison: boolean): TextureSampler;
}

export interface Texture2D<T = unknown> extends BaseTexture<T> {
  update(data: TypedArray, xOffset: number, yOffset: number, width: number, height: number): void;
  updateFromElement(data: TextureImageElement, xOffset: number, yOffset: number, x: number, y: number, width: number, height: number): void;
  loadFromElement(element: TextureImageElement, creationFlags?: number): void;
  createWithMipmapData(data: TextureMipmapData, creationFlags?: number): void;
  readPixels(x: number, y: number, w: number, h: number, buffer: TypedArray): Promise<void>;
  readPixelsToBuffer(x: number, y: number, w: number, h: number, buffer: GPUDataBuffer): void;
}

export interface Texture2DArray<T = unknown> extends BaseTexture<T> {
  update(data: TypedArray, xOffset: number, yOffset: number, zOffset: number, width: number, height: number, depth: number): void;
  updateFromElement(data: TextureImageElement, xOffset: number, yOffset: number, layerIndex: number, x: number, y: number, width: number, height: number): void;
  readPixels(layer: number, x: number, y: number, w: number, h: number, buffer: TypedArray): Promise<void>;
  readPixelsToBuffer(layer: number, x: number, y: number, w: number, h: number, buffer: GPUDataBuffer): void;
}

export interface Texture3D<T = unknown> extends BaseTexture<T> {
  update(data: TypedArray, xOffset: number, yOffset: number, zOffset: number, width: number, height: number, depth: number): void;
  readPixels(layer: number, x: number, y: number, w: number, h: number, buffer: TypedArray): Promise<void>;
  readPixelsToBuffer(layer: number, x: number, y: number, w: number, h: number, buffer: GPUDataBuffer): void;
}

export interface TextureCube<T = unknown> extends BaseTexture<T> {
  update(
    data: TypedArray,
    xOffset: number,
    yOffset: number,
    width: number,
    height: number,
    face: CubeFace
  ): void;
  updateFromElement(data: TextureImageElement, xOffset: number, yOffset: number, face: number, x: number, y: number, width: number, height: number): void;
  createWithMipmapData(data: TextureMipmapData, creationFlags?: number): void;
  readPixels(face: number, x: number, y: number, w: number, h: number, buffer: TypedArray): Promise<void>;
  readPixelsToBuffer(face: number, x: number, y: number, w: number, h: number, buffer: GPUDataBuffer): void;
}

export interface TextureVideo<T = unknown> extends BaseTexture<T> {
  readonly source: HTMLVideoElement;
  updateVideoFrame(): boolean;
}

export interface GPUDataBuffer<T = unknown> extends GPUObject<T> {
  readonly byteLength: number;
  readonly usage: number;
  bufferSubData(dstByteOffset: number, data: TypedArray, srcOffset?: number, srcLength?: number): void;
  getBufferSubData(dstBuffer?: Uint8Array, offsetInBytes?: number, sizeInBytes?: number): Promise<Uint8Array>;
}

export interface IndexBuffer<T = unknown> extends GPUDataBuffer<T> {
  readonly indexType: PBPrimitiveTypeInfo;
  readonly length: number;
}

export interface StructuredBuffer<T = unknown> extends GPUDataBuffer<T> {
  structure: PBStructTypeInfo;
  set(name: string, value: StructuredValue);
}

export interface VertexInputLayout<T = unknown> extends GPUObject<T> {
  readonly vertexBuffers: {
    [semantic: number]: { buffer: GPUDataBuffer; offset: number };
  };
  readonly indexBuffer: IndexBuffer;
  getDrawOffset(): number;
  getVertexBuffer(location: number): StructuredBuffer;
  getIndexBuffer(): IndexBuffer;
  bind(): void;
  draw(primitiveType: PrimitiveType, first: number, count: number): void;
  drawInstanced(
    primitiveType: PrimitiveType,
    first: number,
    count: number,
    numInstances: number,
  );
}

export interface FrameBuffer<T = unknown> extends GPUObject<T> {
  getViewport(): number[];
  setViewport(vp: number[]): void;
  getWidth(): number;
  getHeight(): number;
  getSampleCount(): number;
  setCubeTextureFace(index: number, face: CubeFace): void;
  setTextureLevel(index: number, level: number): void;
  setTextureLayer(index: number, layer: number): void;
  setDepthTextureLayer(layer: number): void;
  getColorAttachments(): BaseTexture[];
  getDepthAttachment(): BaseTexture;
  bind(): boolean;
  unbind(): void;
}

export interface GPUProgram<T = unknown> extends GPUObject<T> {
  readonly bindGroupLayouts: BindGroupLayout[];
  readonly type: 'render' | 'compute';
  getShaderSource(type: ShaderType): string;
  getCompileError(): string;
  getBindingInfo(name: string): BindPointInfo;
  use(): void;
}

export type StructuredValue = number | TypedArray | VectorBase | { [name: string]: StructuredValue };

export interface BindGroup extends GPUObject<unknown> {
  getLayout(): BindGroupLayout;
  getBuffer(name: string): StructuredBuffer;
  getTexture(name: string): BaseTexture;
  setBuffer(name: string, buffer: StructuredBuffer): void;
  setValue(name: string, value: StructuredValue);
  setRawData(name: string, byteOffset: number, data: TypedArray, srcPos?: number, srcLength?: number);
  setTexture(name: string, texture: BaseTexture, sampler?: TextureSampler);
  setTextureView(name: string, value: BaseTexture, level?: number, face?: number, mipCount?: number);
  setSampler(name: string, sampler: TextureSampler);
}

