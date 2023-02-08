/**
 * Basic types
 */

import { IterableWrapper, TypedArray } from '../defs';
import { Constructor } from '../../shared/utils';

export type WebGLContext = WebGLRenderingContext | WebGL2RenderingContext;
/*
export enum BufferUsage {
  Unknown = 0,
  Vertex = (1<<1),
  Index = (1<<2),
  Read = (1<<3),
  Write = (1<<4),
  Uniform = (1<<5),
  Storage = (1<<6),
  Dynamic = (1<<7),
}
*/
export enum TextureTarget {
  Unknown = 0,
  Texture2D = 1,
  Texture3D = 2,
  TextureCubemap = 3,
  Texture2DArray = 4,
}

export enum TextureOption {
  GENERATE_MIPMAP = 1 << 0,
  RENDERABLE = 1 << 1,
  MAGFILTER_LINEAR = 1 << 2,
  MINFILTER_LINEAR = 1 << 3,
  MIPFILTER_LINEAR = 1 << 4,
  REPEATABLE_U = 1 << 3,
  REPEATABLE_V = 1 << 4,
}

export enum CompareFunc {
  Unknown = 0,
  Always = 1,
  LessEqual = 2,
  GreaterEqual = 3,
  Less = 4,
  Greater = 5,
  Equal = 6,
  NotEqual = 7,
  Never = 8
}

export enum CompareMode {
  None = 0,
  RefToTexture = 1
}

export enum TextureWrapping {
  Unknown = 0,
  Repeat,
  MirroredRepeat,
  ClampToEdge,
}

export enum TextureFilter {
  Unknown = 0,
  None,
  Nearest,
  Linear,
}

const RED_SHIFT = 0;
const GREEN_SHIFT = 1;
const BLUE_SHIFT = 2;
const ALPHA_SHIFT = 3;
const DEPTH_SHIFT = 4;
const STENCIL_SHIFT = 5;
const FLOAT_SHIFT = 6;
const INTEGER_SHIFT = 7;
const SIGNED_SHIFT = 8;
const SRGB_SHIFT = 9;
const BGR_SHIFT = 10;
const BLOCK_SIZE_SHIFT = 11;
const BLOCK_SIZE_MASK = 0x1f << BLOCK_SIZE_SHIFT;
const BLOCK_WIDTH_SHIFT = 16;
const BLOCK_WIDTH_MASK = 0xf << BLOCK_WIDTH_SHIFT;
const BLOCK_HEIGHT_SHIFT = 20;
const BLOCK_HEIGHT_MASK = 0xf << BLOCK_HEIGHT_SHIFT;
const COMPRESSED_FORMAT_SHIFT = 24;
const COMPRESSED_FORMAT_MASK = 0x1f << COMPRESSED_FORMAT_SHIFT;

const COMPRESSION_FORMAT_BC1 = 1 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_BC2 = 2 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_BC3 = 3 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_BC4 = 4 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_BC5 = 5 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_BC6 = 6 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_BC7 = 7 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_ETC2_RGB8 = 8 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_ETC2_RGB8_A1 = 9 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_ETC2_RGBA8 = 10 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_ASTC_4x4 = 11 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_ASTC_5x4 = 12 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_ASTC_5x5 = 13 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_ASTC_6x5 = 14 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_ASTC_6x6 = 15 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_ASTC_8x5 = 16 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_ASTC_8x6 = 17 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_ASTC_8x8 = 18 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_ASTC_10x5 = 19 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_ASTC_10x6 = 20 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_ASTC_10x8 = 21 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_ASTC_10x10 = 22 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_ASTC_12x10 = 23 << COMPRESSED_FORMAT_SHIFT;
const COMPRESSION_FORMAT_ASTC_12x12 = 24 << COMPRESSED_FORMAT_SHIFT;


const COMPRESSION_FORMAT_BITMASK = 0x1f << COMPRESSED_FORMAT_SHIFT;
const RED_BITMASK = 1 << RED_SHIFT;
const GREEN_BITMASK = 1 << GREEN_SHIFT;
const BLUE_BITMASK = 1 << BLUE_SHIFT;
const ALPHA_BITMASK = 1 << ALPHA_SHIFT;
const DEPTH_BITMASK = 1 << DEPTH_SHIFT;
const STENCIL_BITMASK = 1 << STENCIL_SHIFT;
const FLOAT_BITMASK = 1 << FLOAT_SHIFT;
const INTEGER_BITMASK = 1 << INTEGER_SHIFT;
const SIGNED_BITMASK = 1 << SIGNED_SHIFT;
const SRGB_BITMASK = 1 << SRGB_SHIFT;
const BGR_BITMASK = 1 << BGR_SHIFT;

export function makeTextureFormat(compression: number, r: boolean, g: boolean, b: boolean, a: boolean, depth: boolean, stencil: boolean, float: boolean, integer: boolean, signed: boolean, srgb: boolean, bgr: boolean, blockWidth: number, blockHeight: number, blockSize: number): TextureFormat {
  const compressionBits = compression << COMPRESSED_FORMAT_SHIFT;
  const colorBits = (r ? RED_BITMASK : 0) | (g ? GREEN_BITMASK : 0) | (b ? BLUE_BITMASK : 0) | (a ? ALPHA_BITMASK : 0);
  const depthStencilBits = (depth ? DEPTH_BITMASK : 0) | (stencil ? STENCIL_BITMASK : 0);
  const floatBits = float ? FLOAT_BITMASK : 0;
  const integerBits = integer ? INTEGER_BITMASK : 0;
  const signedBits = signed ? SIGNED_BITMASK : 0;
  const srgbBits = srgb ? SRGB_BITMASK : 0;
  const bgrBits = bgr ? BGR_BITMASK : 0;
  const blockBits = (blockWidth << BLOCK_WIDTH_SHIFT) | (blockHeight << BLOCK_HEIGHT_SHIFT) | (blockSize << BLOCK_SIZE_SHIFT);
  return compressionBits | colorBits | depthStencilBits | floatBits | integerBits | signedBits | srgbBits | bgrBits | blockBits;
}

export enum TextureFormat {
  Unknown = 0,
  R8UNORM = makeTextureFormat(0, true, false, false, false, false, false, false, false, false, false, false, 1, 1, 1),
  R8SNORM = makeTextureFormat(0, true, false, false, false, false, false, false, false, true, false, false, 1, 1, 1),
  R16F = makeTextureFormat(0, true, false, false, false, false, false, true, false, true, false, false, 1, 1, 2),
  R32F = makeTextureFormat(0, true, false, false, false, false, false, true, false, true, false, false, 1, 1, 4),
  R8UI = makeTextureFormat(0, true, false, false, false, false, false, false, true, false, false, false, 1, 1, 1),
  R8I = makeTextureFormat(0, true, false, false, false, false, false, false, true, true, false, false, 1, 1, 1),
  R16UI = makeTextureFormat(0, true, false, false, false, false, false, false, true, false, false, false, 1, 1, 2),
  R16I = makeTextureFormat(0, true, false, false, false, false, false, false, true, true, false, false, 1, 1, 2),
  R32UI = makeTextureFormat(0, true, false, false, false, false, false, false, true, false, false, false, 1, 1, 4),
  R32I = makeTextureFormat(0, true, false, false, false, false, false, false, true, true, false, false, 1, 1, 4),
  RG8UNORM = makeTextureFormat(0, true, true, false, false, false, false, false, false, false, false, false, 1, 1, 2),
  RG8SNORM = makeTextureFormat(0, true, true, false, false, false, false, false, false, true, false, false, 1, 1, 2),
  RG16F = makeTextureFormat(0, true, true, false, false, false, false, true, false, true, false, false, 1, 1, 4),
  RG32F = makeTextureFormat(0, true, true, false, false, false, false, true, false, true, false, false, 1, 1, 8),
  RG8UI = makeTextureFormat(0, true, true, false, false, false, false, false, true, false, false, false, 1, 1, 2),
  RG8I = makeTextureFormat(0, true, true, false, false, false, false, false, true, true, false, false, 1, 1, 2),
  RG16UI = makeTextureFormat(0, true, true, false, false, false, false, false, true, false, false, false, 1, 1, 4),
  RG16I = makeTextureFormat(0, true, true, false, false, false, false, false, true, true, false, false, 1, 1, 4),
  RG32UI = makeTextureFormat(0, true, true, false, false, false, false, false, true, false, false, false, 1, 1, 8),
  RG32I = makeTextureFormat(0, true, true, false, false, false, false, false, true, true, false, false, 1, 1, 8),
  RGBA8UNORM = makeTextureFormat(0, true, true, true, true, false, false, false, false, false, false, false, 1, 1, 4),
  RGBA8UNORM_SRGB = makeTextureFormat(0, true, true, true, true, false, false, false, false, false, true, false, 1, 1, 4),
  RGBA8SNORM = makeTextureFormat(0, true, true, true, true, false, false, false, false, true, false, false, 1, 1, 4),
  BGRA8UNORM = makeTextureFormat(0, true, true, true, true, false, false, false, false, false, false, true, 1, 1, 4),
  BGRA8UNORM_SRGB = makeTextureFormat(0, true, true, true, true, false, false, false, false, false, true, true, 1, 1, 4),
  RGBA16F = makeTextureFormat(0, true, true, true, true, false, false, true, false, true, false, false, 1, 1, 8),
  RGBA32F = makeTextureFormat(0, true, true, true, true, false, false, true, false, true, false, false, 1, 1, 16),
  RGBA8UI = makeTextureFormat(0, true, true, true, true, false, false, false, true, false, false, false, 1, 1, 4),
  RGBA8I = makeTextureFormat(0, true, true, true, true, false, false, false, true, true, false, false, 1, 1, 4),
  RGBA16UI = makeTextureFormat(0, true, true, true, true, false, false, false, true, false, false, false, 1, 1, 8),
  RGBA16I = makeTextureFormat(0, true, true, true, true, false, false, false, true, true, false, false, 1, 1, 8),
  RGBA32UI = makeTextureFormat(0, true, true, true, true, false, false, false, true, false, false, false, 1, 1, 16),
  RGBA32I = makeTextureFormat(0, true, true, true, true, false, false, false, true, true, false, false, 1, 1, 16),
  D16 = makeTextureFormat(0, false, false, false, false, true, false, false, false, false, false, false, 1, 1, 2),
  D24 = makeTextureFormat(0, false, false, false, false, true, false, false, false, false, false, false, 0, 0, 0),
  D32F = makeTextureFormat(0, false, false, false, false, true, false, true, false, true, false, false, 1, 1, 4),
  D24S8 = makeTextureFormat(0, false, false, false, false, true, true, false, false, false, false, false, 1, 1, 4),
  D32FS8 = makeTextureFormat(0, false, false, false, false, true, true, true, false, true, false, false, 1, 1, 5),
  // compressed texture formats
  DXT1 = makeTextureFormat(COMPRESSION_FORMAT_BC1, true, true, true, true, false, false, false, false, false, false, false, 4, 4, 8),
  DXT1_SRGB = makeTextureFormat(COMPRESSION_FORMAT_BC1, true, true, true, true, false, false, false, false, false, true, false, 4, 4, 8),
  DXT3 = makeTextureFormat(COMPRESSION_FORMAT_BC2, true, true, true, true, false, false, false, false, false, false, false, 4, 4, 16),
  DXT3_SRGB = makeTextureFormat(COMPRESSION_FORMAT_BC2, true, true, true, true, false, false, false, false, false, true, false, 4, 4, 16),
  DXT5 = makeTextureFormat(COMPRESSION_FORMAT_BC3, true, true, true, true, false, false, false, false, false, false, false, 4, 4, 16),
  DXT5_SRGB = makeTextureFormat(COMPRESSION_FORMAT_BC3, true, true, true, true, false, false, false, false, false, true, false, 4, 4, 16),
}

export function linearTextureFormatToSRGB(format: TextureFormat): TextureFormat {
  switch (format) {
    case TextureFormat.RGBA8UNORM: return TextureFormat.RGBA8UNORM_SRGB;
    case TextureFormat.BGRA8UNORM: return TextureFormat.BGRA8UNORM_SRGB;
    case TextureFormat.DXT1: return TextureFormat.DXT1_SRGB;
    case TextureFormat.DXT3: return TextureFormat.DXT3_SRGB;
    case TextureFormat.DXT5: return TextureFormat.DXT5_SRGB;
    default: return format;
  }
}
export function hasAlphaChannel(format: TextureFormat): boolean {
  return !!(format & ALPHA_BITMASK);
}
export function hasRedChannel(format: TextureFormat): boolean {
  return !!(format & RED_BITMASK);
}
export function hasGreenChannel(format: TextureFormat): boolean {
  return !!(format & GREEN_BITMASK);
}
export function hasBlueChannel(format: TextureFormat): boolean {
  return !!(format & BLUE_BITMASK);
}
export function hasDepthChannel(format: TextureFormat): boolean {
  return !!(format & DEPTH_BITMASK);
}
export function hasStencilChannel(format: TextureFormat): boolean {
  return !!(format & STENCIL_BITMASK);
}
export function isFloatTextureFormat(format: TextureFormat): boolean {
  return !!(format & FLOAT_BITMASK);
}
export function isIntegerTextureFormat(format: TextureFormat): boolean {
  return !!(format & INTEGER_BITMASK);
}
export function isSignedTextureFormat(format: TextureFormat): boolean {
  return !!(format & SIGNED_BITMASK);
}
export function isCompressedTextureFormat(format: TextureFormat): boolean {
  return !!(format & COMPRESSION_FORMAT_BITMASK);
}
export function isDepthTextureFormat(format: TextureFormat): boolean {
  return !!(format & DEPTH_BITMASK);
}
export function isSRGBTextureFormat(format: TextureFormat): boolean {
  return !!(format & SRGB_BITMASK);
}
export function getTextureFormatBlockSize(format: TextureFormat): number {
  return (format & BLOCK_SIZE_MASK) >> BLOCK_SIZE_SHIFT;
}
export function getTextureFormatBlockWidth(format: TextureFormat): number {
  return (format & BLOCK_WIDTH_MASK) >> BLOCK_WIDTH_SHIFT;
}
export function getTextureFormatBlockHeight(format: TextureFormat): number {
  return (format & BLOCK_HEIGHT_MASK) >> BLOCK_HEIGHT_SHIFT;
}
export function getCompressedTextureFormat(format: TextureFormat): number {
  return (format & COMPRESSED_FORMAT_MASK) >> COMPRESSED_FORMAT_SHIFT;
}

function normalizeColorComponent(val: number, maxval: number) {
  return Math.min(maxval, Math.max(Math.floor(val * maxval), 0));
}

function normalizeColorComponentSigned(val: number, maxval: number) {
  return normalizeColorComponent(val * 0.5 + 0.5, maxval) - (maxval + 1) / 2;
}

const _floatView = new Float32Array(1);
const _int32View = new Int32Array(_floatView.buffer);
export function floatToHalf(val: number): number {
  _floatView[0] = val;
  const x = _int32View[0];
  let bits = (x >> 16) & 0x8000;
  let m = (x >> 12) & 0x07ff;
  const e = (x >> 23) & 0xff;
  if (e < 103) {
    return bits;
  }
  if (e > 142) {
    bits |= 0x7c00;
    bits |= (e === 255 ? 0 : 1) && x & 0x007fffff;
    return bits;
  }
  if (e < 113) {
    m |= 0x0800;
    bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
    return bits;
  }
  bits |= ((e - 112) << 10) | (m >> 1);
  bits += m & 1;
  return bits;
}

export function halfToFloat(val: number): number {
  const s = (val & 0x8000) >> 15;
  const e = (val & 0x7c00) >> 10;
  const f = val & 0x03ff;
  if (e === 0) {
    return (s ? -1 : 1) * Math.pow(2, -14) * (f / Math.pow(2, 10));
  } else if (e === 0x1f) {
    return f ? NaN : (s ? -1 : 1) * Infinity;
  }
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / Math.pow(2, 10));
}

function encode565(r: number, g: number, b: number): number {
  r = normalizeColorComponent(r, 255) >> 3;
  g = normalizeColorComponent(g, 255) >> 2;
  b = normalizeColorComponent(b, 255) >> 3;
  return (b & 0x1f) | ((g & 0x3f) << 5) | ((r & 0x1f) << 11);
}

function encode4444(r: number, g: number, b: number, a: number) {
  r = normalizeColorComponent(r, 255) >> 4;
  g = normalizeColorComponent(g, 255) >> 4;
  b = normalizeColorComponent(b, 255) >> 4;
  a = normalizeColorComponent(a, 255) >> 4;
  return (a & 0x0f) | ((b & 0x0f) << 4) | ((g & 0x0f) << 8) | ((r & 0x0f) << 12);
}

function encode5551(r: number, g: number, b: number, a: number) {
  r = normalizeColorComponent(r, 255) >> 3;
  g = normalizeColorComponent(g, 255) >> 3;
  b = normalizeColorComponent(b, 255) >> 3;
  return ((b & 0x1f) << 1) | ((g & 0x1f) << 6) | ((r & 0x1f) << 11) | (a >= 0.5 ? 1 : 0);
}

export function formatToTypedArray(format: TextureFormat): {
  new(...args: unknown[]): TypedArray;
} {
  switch (format) {
    case TextureFormat.R8UNORM:
    case TextureFormat.RGBA8UNORM:
    case TextureFormat.RGBA8UNORM_SRGB:
    case TextureFormat.BGRA8UNORM:
    case TextureFormat.BGRA8UNORM_SRGB:
    case TextureFormat.R8UI:
    case TextureFormat.RG8UNORM:
    case TextureFormat.RG8UI:
    case TextureFormat.RGBA8UI:
      return Uint8Array;
    case TextureFormat.R8SNORM:
    case TextureFormat.R8I:
    case TextureFormat.RG8SNORM:
    case TextureFormat.RG8I:
    case TextureFormat.RGBA8SNORM:
    case TextureFormat.RGBA8I:
      return Int8Array;
    case TextureFormat.R16F:
    case TextureFormat.R16UI:
    case TextureFormat.RG16F:
    case TextureFormat.RG16UI:
    case TextureFormat.RGBA16F:
    case TextureFormat.RGBA16UI:
      return Uint16Array;
    case TextureFormat.R16I:
    case TextureFormat.RG16I:
    case TextureFormat.RGBA16I:
      return Int16Array;
    case TextureFormat.R32F:
    case TextureFormat.RG32F:
    case TextureFormat.RGBA32F:
      return Float32Array;
    case TextureFormat.R32UI:
    case TextureFormat.RG32UI:
    case TextureFormat.RGBA32UI:
      return Uint32Array;
    case TextureFormat.R32I:
    case TextureFormat.RG32I:
    case TextureFormat.RGBA32I:
      return Int32Array;
    default:
      return null;
  }
}
export function encodePixel(
  format: TextureFormat,
  r: number,
  g: number,
  b: number,
  a: number,
): TypedArray {
  switch (format) {
    case TextureFormat.R8UNORM:
      return new Uint8Array([normalizeColorComponent(r, 255)]);
    case TextureFormat.R8SNORM:
      return new Int8Array([normalizeColorComponentSigned(r, 255)]);
    case TextureFormat.R16F:
      return new Uint16Array([floatToHalf(r)]);
    case TextureFormat.R32F:
      return new Float32Array([r]);
    case TextureFormat.R8UI:
      return new Uint8Array([r | 0]);
    case TextureFormat.R8I:
      return new Int8Array([r | 0]);
    case TextureFormat.R16UI:
      return new Uint16Array([r | 0]);
    case TextureFormat.R16I:
      return new Int16Array([r | 0]);
    case TextureFormat.R32UI:
      return new Uint32Array([r | 0]);
    case TextureFormat.R32I:
      return new Int32Array([r | 0]);
    case TextureFormat.RG8UNORM:
      return new Uint8Array([normalizeColorComponent(r, 255), normalizeColorComponent(g, 255)]);
    case TextureFormat.RG8SNORM:
      return new Int8Array([normalizeColorComponentSigned(r, 255), normalizeColorComponentSigned(g, 255)]);
    case TextureFormat.RG16F:
      return new Uint16Array([floatToHalf(r), floatToHalf(g)]);
    case TextureFormat.RG32F:
      return new Float32Array([r, g]);
    case TextureFormat.RG8UI:
      return new Uint8Array([r | 0, g | 0]);
    case TextureFormat.RG8I:
      return new Int8Array([r | 0, g | 0]);
    case TextureFormat.RG16UI:
      return new Uint16Array([r | 0, g | 0]);
    case TextureFormat.RG16I:
      return new Int16Array([r | 0, g | 0]);
    case TextureFormat.RG32UI:
      return new Uint32Array([r | 0, g | 0]);
    case TextureFormat.RG32I:
      return new Int32Array([r | 0, g | 0]);
    case TextureFormat.RGBA8UNORM:
    case TextureFormat.RGBA8UNORM_SRGB:
      return new Uint8Array([
        normalizeColorComponent(r, 255),
        normalizeColorComponent(g, 255),
        normalizeColorComponent(b, 255),
        normalizeColorComponent(a, 255),
      ]);
    case TextureFormat.BGRA8UNORM:
    case TextureFormat.BGRA8UNORM_SRGB:
      return new Uint8Array([
        normalizeColorComponent(b, 255),
        normalizeColorComponent(g, 255),
        normalizeColorComponent(r, 255),
        normalizeColorComponent(a, 255),
      ]);
    case TextureFormat.RGBA8SNORM:
      return new Int8Array([
        normalizeColorComponentSigned(r, 255),
        normalizeColorComponentSigned(g, 255),
        normalizeColorComponentSigned(b, 255),
        normalizeColorComponentSigned(a, 255),
      ]);
    case TextureFormat.RGBA16F:
      return new Uint16Array([floatToHalf(r), floatToHalf(g), floatToHalf(b), floatToHalf(a)]);
    case TextureFormat.RGBA32F:
      return new Float32Array([r, g, b, a]);
    case TextureFormat.RGBA8UI:
      return new Uint8Array([r | 0, g | 0, b | 0, a | 0]);
    case TextureFormat.RGBA8I:
      return new Int8Array([r | 0, g | 0, b | 0, a | 0]);
    case TextureFormat.RGBA16UI:
      return new Uint16Array([r | 0, g | 0, b | 0, a | 0]);
    case TextureFormat.RGBA16I:
      return new Int16Array([r | 0, g | 0, b | 0, a | 0]);
    case TextureFormat.RGBA32UI:
      return new Uint32Array([r | 0, g | 0, b | 0, a | 0]);
    case TextureFormat.RGBA32I:
      return new Int32Array([r | 0, g | 0, b | 0, a | 0]);
    default:
      return null;
  }
}

export function encodePixelToArray(
  format: TextureFormat,
  r: number,
  g: number,
  b: number,
  a: number,
  arr: Array<number>,
): void {
  switch (format) {
    case TextureFormat.R8UNORM:
      arr.push(normalizeColorComponent(r, 255));
      break;
    case TextureFormat.R8SNORM:
      arr.push(normalizeColorComponentSigned(r, 255));
      break;
    case TextureFormat.R16F:
      arr.push(floatToHalf(r));
      break;
    case TextureFormat.R32F:
      arr.push(r);
      break;
    case TextureFormat.R8UI:
      arr.push(r | 0);
      break;
    case TextureFormat.R8I:
      arr.push(r | 0);
      break;
    case TextureFormat.R16UI:
      arr.push(r | 0);
      break;
    case TextureFormat.R16I:
      arr.push(r | 0);
      break;
    case TextureFormat.R32UI:
      arr.push(r | 0);
      break;
    case TextureFormat.R32I:
      arr.push(r | 0);
      break;
    case TextureFormat.RG8UNORM:
      arr.push(normalizeColorComponent(r, 255), normalizeColorComponent(g, 255));
      break;
    case TextureFormat.RG8SNORM:
      arr.push(normalizeColorComponentSigned(r, 255), normalizeColorComponentSigned(g, 255));
      break;
    case TextureFormat.RG16F:
      arr.push(floatToHalf(r), floatToHalf(g));
      break;
    case TextureFormat.RG32F:
      arr.push(r, g);
      break;
    case TextureFormat.RG8UI:
      arr.push(r | 0, g | 0);
      break;
    case TextureFormat.RG8I:
      arr.push(r | 0, g | 0);
      break;
    case TextureFormat.RG16UI:
      arr.push(r | 0, g | 0);
      break;
    case TextureFormat.RG16I:
      arr.push(r | 0, g | 0);
      break;
    case TextureFormat.RG32UI:
      arr.push(r | 0, g | 0);
      break;
    case TextureFormat.RG32I:
      arr.push(r | 0, g | 0);
      break;
    case TextureFormat.RGBA8UNORM:
    case TextureFormat.RGBA8UNORM_SRGB:
      arr.push(
        normalizeColorComponent(r, 255),
        normalizeColorComponent(g, 255),
        normalizeColorComponent(b, 255),
        normalizeColorComponent(a, 255),
      );
      break;
    case TextureFormat.BGRA8UNORM:
    case TextureFormat.BGRA8UNORM_SRGB:
      arr.push(
        normalizeColorComponent(b, 255),
        normalizeColorComponent(g, 255),
        normalizeColorComponent(r, 255),
        normalizeColorComponent(a, 255),
      );
      break;
    case TextureFormat.RGBA8SNORM:
      arr.push(
        normalizeColorComponentSigned(r, 255),
        normalizeColorComponentSigned(g, 255),
        normalizeColorComponentSigned(b, 255),
        normalizeColorComponentSigned(a, 255),
      );
      break;
    case TextureFormat.RGBA16F:
      arr.push(floatToHalf(r), floatToHalf(g), floatToHalf(b), floatToHalf(a));
      break;
    case TextureFormat.RGBA32F:
      arr.push(r, g, b, a);
      break;
    case TextureFormat.RGBA8UI:
      arr.push(r | 0, g | 0, b | 0, a | 0);
      break;
    case TextureFormat.RGBA8I:
      arr.push(r | 0, g | 0, b | 0, a | 0);
      break;
    case TextureFormat.RGBA16UI:
      arr.push(r | 0, g | 0, b | 0, a | 0);
      break;
    case TextureFormat.RGBA16I:
      arr.push(r | 0, g | 0, b | 0, a | 0);
      break;
    case TextureFormat.RGBA32UI:
      arr.push(r | 0, g | 0, b | 0, a | 0);
      break;
    case TextureFormat.RGBA32I:
      arr.push(r | 0, g | 0, b | 0, a | 0);
      break;
  }
}

export enum PrimitiveType {
  Unknown = -1,
  TriangleList = 0,
  TriangleStrip = 1,
  TriangleFan = 2,
  LineList = 3,
  LineStrip = 4,
  PointList = 5,
}

export enum ShaderType {
  Vertex = 1 << 0,
  Fragment = 1 << 1,
  Compute = 1 << 2,
}

export class ColorRGBA extends IterableWrapper {
  constructor(r: number, g: number, b: number, a: number);
  constructor(other: ArrayLike<number>);
  constructor();
  constructor(rOrOther?: number | ArrayLike<number>, g?: number, b?: number, a?: number) {
    super(4);
    if (typeof rOrOther === 'number') {
      this._v[0] = Number(rOrOther);
      this._v[1] = Number(g);
      this._v[2] = Number(b);
      this._v[3] = Number(a);
    } else if (rOrOther) {
      this.assign(rOrOther);
    }
  }
  get r() {
    return this._v[0];
  }
  set r(value: number) {
    this._v[0] = Number(value);
  }
  get g() {
    return this._v[1];
  }
  set g(value: number) {
    this._v[1] = Number(value);
  }
  get b() {
    return this._v[2];
  }
  set b(value: number) {
    this._v[2] = Number(value);
  }
  get a() {
    return this._v[3];
  }
  set a(value: number) {
    this._v[3] = Number(value);
  }
  set(r: number, g: number, b: number, a: number);
  set(other: ArrayLike<number>);
  set(rOrOther: number | ArrayLike<number>, g?: number, b?: number, a?: number) {
    if (typeof rOrOther === 'number') {
      this._v[0] = Number(rOrOther);
      this._v[1] = Number(g);
      this._v[2] = Number(b);
      this._v[3] = Number(a);
    } else {
      this.assign(rOrOther);
    }
  }
}

export function sliceTypedArray(array: TypedArray, offset: number, length: number): TypedArray {
  const c = array.constructor as Constructor<TypedArray>;
  return new c(array.buffer, offset * c.BYTES_PER_ELEMENT, length);
}
