import { PBShaderExp, ProgramBuilder, ShaderTypeFunc, makeConstructor } from './programbuilder';
import { TextureFormat } from '../base_types';
import * as typeinfo from './types';
import * as AST from './ast';
import * as errors from './errors';

const StorageTextureFormatMap = {
  rgba8unorm: TextureFormat.RGBA8UNORM,
  rgba8snorm: TextureFormat.RGBA8SNORM,
  rgba8uint: TextureFormat.RGBA8UI,
  rgba8sint: TextureFormat.RGBA8I,
  rgba16uint: TextureFormat.RGBA16UI,
  rgba16sint: TextureFormat.RGBA16I,
  rgba16float: TextureFormat.RGBA16F,
  r32float: TextureFormat.R32F,
  r32uint: TextureFormat.R32UI,
  r32sint: TextureFormat.R32I,
  rg32float: TextureFormat.RG32F,
  rg32uint: TextureFormat.RG32UI,
  rg32sint: TextureFormat.RG32I,
  rgba32float: TextureFormat.RGBA32F,
  rgba32uint: TextureFormat.RGBA32UI,
  rgba32sint: TextureFormat.RGBA32I,
};

export type StorageTextureConstructor = { [k in keyof typeof StorageTextureFormatMap]: (s?: string) => PBShaderExp };

declare module "./programbuilder" {
  export interface ProgramBuilder {
    float: {
      (): PBShaderExp;
      (rhs: number): PBShaderExp;
      (rhs: boolean): PBShaderExp;
      (rhs: PBShaderExp): PBShaderExp;
      (name: string): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    int: {
      (): PBShaderExp;
      (rhs: number | boolean | PBShaderExp | string): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    uint: {
      (): PBShaderExp;
      (rhs: number | boolean | PBShaderExp | string): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    bool: {
      (): PBShaderExp;
      (rhs: number | boolean | PBShaderExp | string): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    vec2: {
      (): PBShaderExp;
      (rhs: number | PBShaderExp | string): PBShaderExp;
      (x: number | PBShaderExp, y: number | PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    ivec2: {
      (): PBShaderExp;
      (rhs: number | PBShaderExp | string): PBShaderExp;
      (x: number | PBShaderExp, y: number | PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    uvec2: {
      (): PBShaderExp;
      (rhs: number | PBShaderExp | string): PBShaderExp;
      (x: number | PBShaderExp, y: number | PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    bvec2: {
      (): PBShaderExp;
      (rhs: number | boolean | PBShaderExp | string): PBShaderExp;
      (x: number | boolean | PBShaderExp, y: number | boolean | PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    vec3: {
      (): PBShaderExp;
      (name: string): PBShaderExp;
      (x: number | PBShaderExp): PBShaderExp;
      (x: number | PBShaderExp, y: number | PBShaderExp, z: number | PBShaderExp): PBShaderExp;
      (x: number | PBShaderExp, yz: PBShaderExp): PBShaderExp;
      (xy: PBShaderExp, z: number | PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    ivec3: {
      (): PBShaderExp;
      (name: string): PBShaderExp;
      (x: number | PBShaderExp): PBShaderExp;
      (x: number | PBShaderExp, y: number | PBShaderExp, z: number | PBShaderExp): PBShaderExp;
      (x: number | PBShaderExp, yz: PBShaderExp): PBShaderExp;
      (xy: PBShaderExp, z: number | PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    uvec3: {
      (): PBShaderExp;
      (name: string): PBShaderExp;
      (x: number | PBShaderExp): PBShaderExp;
      (x: number | PBShaderExp, y: number | PBShaderExp, z: number | PBShaderExp): PBShaderExp;
      (x: number | PBShaderExp, yz: PBShaderExp): PBShaderExp;
      (xy: PBShaderExp, z: number | PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    bvec3: {
      (): PBShaderExp;
      (name: string): PBShaderExp;
      (x: boolean | PBShaderExp): PBShaderExp;
      (x: boolean | PBShaderExp, y: boolean | PBShaderExp, z: boolean | PBShaderExp): PBShaderExp;
      (x: boolean | PBShaderExp, yz: PBShaderExp): PBShaderExp;
      (xy: PBShaderExp, z: boolean | PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    vec4: {
      (): PBShaderExp;
      (name: string): PBShaderExp;
      (x: number | PBShaderExp): PBShaderExp;
      (x: number | PBShaderExp, y: number | PBShaderExp, z: number | PBShaderExp, w: number | PBShaderExp): PBShaderExp;
      (x: number | PBShaderExp, y: number | PBShaderExp, zw: PBShaderExp): PBShaderExp
      (x: number | PBShaderExp, yz: PBShaderExp, w: number | PBShaderExp): PBShaderExp;
      (x: number | PBShaderExp, yzw: PBShaderExp): PBShaderExp;
      (xy: PBShaderExp, z: number | PBShaderExp, w: number | PBShaderExp): PBShaderExp;
      (xy: PBShaderExp, zw: PBShaderExp): PBShaderExp;
      (xyz: PBShaderExp, w: number | PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    ivec4: {
      (): PBShaderExp;
      (name: string): PBShaderExp;
      (x: number | PBShaderExp): PBShaderExp;
      (x: number | PBShaderExp, y: number | PBShaderExp, z: number | PBShaderExp, w: number | PBShaderExp): PBShaderExp;
      (x: number | PBShaderExp, y: number | PBShaderExp, zw: PBShaderExp): PBShaderExp
      (x: number | PBShaderExp, yz: PBShaderExp, w: number | PBShaderExp): PBShaderExp;
      (x: number | PBShaderExp, yzw: PBShaderExp): PBShaderExp;
      (xy: PBShaderExp, z: number | PBShaderExp, w: number | PBShaderExp): PBShaderExp;
      (xy: PBShaderExp, zw: PBShaderExp): PBShaderExp;
      (xyz: PBShaderExp, w: number | PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    uvec4: {
      (): PBShaderExp;
      (name: string): PBShaderExp;
      (x: number | PBShaderExp): PBShaderExp;
      (x: number | PBShaderExp, y: number | PBShaderExp, z: number | PBShaderExp, w: number | PBShaderExp): PBShaderExp;
      (x: number | PBShaderExp, y: number | PBShaderExp, zw: PBShaderExp): PBShaderExp
      (x: number | PBShaderExp, yz: PBShaderExp, w: number | PBShaderExp): PBShaderExp;
      (x: number | PBShaderExp, yzw: PBShaderExp): PBShaderExp;
      (xy: PBShaderExp, z: number | PBShaderExp, w: number | PBShaderExp): PBShaderExp;
      (xy: PBShaderExp, zw: PBShaderExp): PBShaderExp;
      (xyz: PBShaderExp, w: number | PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    bvec4: {
      (): PBShaderExp;
      (name: string): PBShaderExp;
      (x: boolean | PBShaderExp): PBShaderExp;
      (x: boolean | PBShaderExp, y: boolean | PBShaderExp, z: boolean | PBShaderExp, w: boolean | PBShaderExp): PBShaderExp;
      (x: boolean | PBShaderExp, y: boolean | PBShaderExp, zw: PBShaderExp): PBShaderExp
      (x: boolean | PBShaderExp, yz: PBShaderExp, w: boolean | PBShaderExp): PBShaderExp;
      (x: boolean | PBShaderExp, yzw: PBShaderExp): PBShaderExp;
      (xy: PBShaderExp, z: boolean | PBShaderExp, w: boolean | PBShaderExp): PBShaderExp;
      (xy: PBShaderExp, zw: PBShaderExp): PBShaderExp;
      (xyz: PBShaderExp, w: boolean | PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    mat2: {
      (): PBShaderExp;
      (name: string): PBShaderExp;
      (m00: number | PBShaderExp, m01: number | PBShaderExp,
        m10: number | PBShaderExp, m11: number | PBShaderExp): PBShaderExp;
      (m0: PBShaderExp, m1: PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    mat2x3: {
      (): PBShaderExp;
      (name: string): PBShaderExp;
      (m00: number | PBShaderExp, m01: number | PBShaderExp, m02: number | PBShaderExp,
        m10: number | PBShaderExp, m11: number | PBShaderExp, m12: number | PBShaderExp): PBShaderExp;
      (m0: PBShaderExp, m1: PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    mat2x4: {
      (): PBShaderExp;
      (name: string): PBShaderExp;
      (m00: number | PBShaderExp, m01: number | PBShaderExp, m02: number | PBShaderExp, m03: number | PBShaderExp,
        m10: number | PBShaderExp, m11: number | PBShaderExp, m12: number | PBShaderExp, m13: number | PBShaderExp): PBShaderExp;
      (m0: PBShaderExp, m1: PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    mat3: {
      (): PBShaderExp;
      (name: string): PBShaderExp;
      (m00: number | PBShaderExp, m01: number | PBShaderExp, m02: number | PBShaderExp,
        m10: number | PBShaderExp, m11: number | PBShaderExp, m12: number | PBShaderExp,
        m20: number | PBShaderExp, m21: number | PBShaderExp, m22: number | PBShaderExp): PBShaderExp;
      (m0: PBShaderExp, m1: PBShaderExp, m2: PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    mat3x2: {
      (): PBShaderExp;
      (name: string): PBShaderExp;
      (m00: number | PBShaderExp, m01: number | PBShaderExp,
        m10: number | PBShaderExp, m11: number | PBShaderExp,
        m20: number | PBShaderExp, m21: number | PBShaderExp): PBShaderExp;
      (m0: PBShaderExp, m1: PBShaderExp, m2: PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    mat3x4: {
      (): PBShaderExp;
      (name: string): PBShaderExp;
      (m00: number | PBShaderExp, m01: number | PBShaderExp, m02: number | PBShaderExp, m03: number | PBShaderExp,
        m10: number | PBShaderExp, m11: number | PBShaderExp, m12: number | PBShaderExp, m13: number | PBShaderExp,
        m20: number | PBShaderExp, m21: number | PBShaderExp, m22: number | PBShaderExp, m23: number | PBShaderExp): PBShaderExp;
      (m0: PBShaderExp, m1: PBShaderExp, m2: PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    mat4: {
      (): PBShaderExp;
      (name: string): PBShaderExp;
      (m00: number | PBShaderExp, m01: number | PBShaderExp, m02: number | PBShaderExp, m03: number | PBShaderExp,
        m10: number | PBShaderExp, m11: number | PBShaderExp, m12: number | PBShaderExp, m13: number | PBShaderExp,
        m20: number | PBShaderExp, m21: number | PBShaderExp, m22: number | PBShaderExp, m23: number | PBShaderExp,
        m30: number | PBShaderExp, m31: number | PBShaderExp, m32: number | PBShaderExp, m33: number | PBShaderExp): PBShaderExp;
      (m0: PBShaderExp, m1: PBShaderExp, m2: PBShaderExp, m3: PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    mat4x2: {
      (): PBShaderExp;
      (name: string): PBShaderExp;
      (m00: number | PBShaderExp, m01: number | PBShaderExp,
        m10: number | PBShaderExp, m11: number | PBShaderExp,
        m20: number | PBShaderExp, m21: number | PBShaderExp,
        m30: number | PBShaderExp, m31: number | PBShaderExp): PBShaderExp;
      (m0: PBShaderExp, m1: PBShaderExp, m2: PBShaderExp, m3: PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    mat4x3: {
      (): PBShaderExp;
      (name: string): PBShaderExp;
      (m00: number | PBShaderExp, m01: number | PBShaderExp, m02: number | PBShaderExp,
        m10: number | PBShaderExp, m11: number | PBShaderExp, m12: number | PBShaderExp,
        m20: number | PBShaderExp, m21: number | PBShaderExp, m22: number | PBShaderExp,
        m30: number | PBShaderExp, m31: number | PBShaderExp, m32: number | PBShaderExp): PBShaderExp;
      (m0: PBShaderExp, m1: PBShaderExp, m2: PBShaderExp, m3: PBShaderExp): PBShaderExp;
      ptr: ShaderTypeFunc;
      [dim: number]: ShaderTypeFunc;
    },
    tex1D(rhs?: string): PBShaderExp;
    tex2D(rhs?: string): PBShaderExp;
    tex3D(rhs?: string): PBShaderExp;
    texCube(rhs?: string): PBShaderExp;
    texExternal(rhs?: string): PBShaderExp;
    tex2DShadow(rhs?: string): PBShaderExp;
    texCubeShadow(rhs?: string): PBShaderExp;
    tex2DArray(rhs?: string): PBShaderExp;
    tex2DArrayShadow(rhs?: string): PBShaderExp;
    itex1D(rhs?: string): PBShaderExp;
    itex2D(rhs?: string): PBShaderExp;
    itex3D(rhs?: string): PBShaderExp;
    itexCube(rhs?: string): PBShaderExp;
    itex2DArray(rhs?: string): PBShaderExp;
    utex1D(rhs?: string): PBShaderExp;
    utex2D(rhs?: string): PBShaderExp;
    utex3D(rhs?: string): PBShaderExp;
    utexCube(rhs?: string): PBShaderExp;
    utex2DArray(rhs?: string): PBShaderExp;
    texStorage1D: StorageTextureConstructor;
    texStorage2D: StorageTextureConstructor;
    texStorage2DArray: StorageTextureConstructor;
    texStorage3D: StorageTextureConstructor;
    sampler(rhs?: string): PBShaderExp;
    samplerComparison(rhs?: string): PBShaderExp;
  }
}

function vec_n(this: ProgramBuilder, vecType: typeinfo.PBPrimitiveTypeInfo, ...args: (number | boolean | string | PBShaderExp)[]): PBShaderExp {
  if (this.getDeviceType() === 'webgl') {
    if (vecType.scalarType === typeinfo.PBPrimitiveType.U32) {
      throw new errors.PBDeviceNotSupport('unsigned integer type');
    }
    if (vecType.isMatrixType() && vecType.cols !== vecType.rows) {
      throw new errors.PBDeviceNotSupport('non-square matrix type');
    }
  }

  if (args.length === 1 && typeof args[0] === 'string') {
    return new PBShaderExp(args[0], vecType);
  } else {
    const exp = new PBShaderExp('', vecType);
    exp.$ast = new AST.ASTShaderExpConstructor(exp.$typeinfo, args.map(arg => {
      if (typeof arg === 'string') {
        throw new errors.PBParamTypeError('vec_n');
      }
      return arg instanceof PBShaderExp ? arg.$ast : arg;
    }));
    return exp;
  }
}
/*
ProgramBuilder.prototype.float = makeConstructor(function(this: ProgramBuilder, rhs: number|boolean|PBShaderExp|string): PBShaderExp {
  if (typeof rhs === 'string' || typeof rhs === 'undefined') {
    return new PBShaderExp(rhs, typeinfo.typeF32);
  } else if (rhs instanceof PBShaderExp || typeof rhs === 'number' || typeof rhs === 'boolean' ) {
    const exp = new PBShaderExp('', typeinfo.typeF32);
    if (typeof rhs === 'number') {
      exp.$ast = new AST.ASTScalar(rhs, typeinfo.typeF32);
    } else {
      exp.$ast = new AST.ASTShaderExpConstructor(exp.$typeinfo, [(rhs instanceof PBShaderExp) ? rhs.$ast : rhs]);
    }
    return exp;
  } else {
    throw new errors.PBTypeCastError(rhs, typeof rhs, typeinfo.typeF32);
  }
} as ShaderTypeFunc, typeinfo.typeF32);

ProgramBuilder.prototype.int = makeConstructor(function(this: ProgramBuilder, rhs: number|boolean|PBShaderExp|string): PBShaderExp {
  if (typeof rhs === 'string') {
    return new PBShaderExp(rhs, typeinfo.typeI32);
  } else if (rhs instanceof PBShaderExp || typeof rhs === 'number' || typeof rhs === 'boolean' ) {
    const exp = new PBShaderExp('', typeinfo.typeI32);
    if (typeof rhs === 'number' && rhs === (rhs | 0)) {
      exp.$ast = new AST.ASTScalar(rhs, typeinfo.typeI32);
    } else {
      exp.$ast = new AST.ASTShaderExpConstructor(exp.$typeinfo, [(rhs instanceof PBShaderExp) ? rhs.$ast : rhs]);
    }
    return exp;
  } else {
    throw new errors.PBTypeCastError(rhs, typeof rhs, typeinfo.typeI32);
  }
} as ShaderTypeFunc, typeinfo.typeI32);

ProgramBuilder.prototype.uint = makeConstructor(function(this: ProgramBuilder, rhs: number|boolean|PBShaderExp|string): PBShaderExp {
  if (typeof rhs === 'string') {
    return new PBShaderExp(rhs, typeinfo.typeU32);
  } else if (rhs instanceof PBShaderExp || typeof rhs === 'number' || typeof rhs === 'boolean' ) {
    const exp = new PBShaderExp('', typeinfo.typeU32);
    if (typeof rhs === 'number' && rhs === (rhs | 0) && rhs >= 0) {
      exp.$ast = new AST.ASTScalar(rhs, typeinfo.typeU32);
    } else {
      exp.$ast = new AST.ASTShaderExpConstructor(exp.$typeinfo, [(rhs instanceof PBShaderExp) ? rhs.$ast : rhs]);
    }
    return exp;
  } else {
    throw new errors.PBTypeCastError(rhs, typeof rhs, typeinfo.typeU32);
  }
} as ShaderTypeFunc, typeinfo.typeU32);

ProgramBuilder.prototype.bool = makeConstructor(function(this: ProgramBuilder, rhs: number|boolean|PBShaderExp|string): PBShaderExp {
  if (typeof rhs === 'string') {
    return new PBShaderExp(rhs, typeinfo.typeBool);
  } else if (rhs instanceof PBShaderExp || typeof rhs === 'number' || typeof rhs === 'boolean' ) {
    const exp = new PBShaderExp('', typeinfo.typeBool);
    if (typeof rhs === 'boolean') {
      exp.$ast = new AST.ASTScalar(rhs, typeinfo.typeBool);
    } else {
      exp.$ast = new AST.ASTShaderExpConstructor(exp.$typeinfo, [(rhs instanceof PBShaderExp) ? rhs.$ast : rhs]);
    }
    return exp;
  } else {
    throw new errors.PBTypeCastError(rhs, typeof rhs, typeinfo.typeBool);
  }
} as ShaderTypeFunc, typeinfo.typeBool);
*/
const primitiveCtors = {
  float: typeinfo.typeF32,
  int: typeinfo.typeI32,
  uint: typeinfo.typeU32,
  bool: typeinfo.typeBool,
  vec2: typeinfo.typeF32Vec2,
  ivec2: typeinfo.typeI32Vec2,
  uvec2: typeinfo.typeU32Vec2,
  bvec2: typeinfo.typeBVec2,
  vec3: typeinfo.typeF32Vec3,
  ivec3: typeinfo.typeI32Vec3,
  uvec3: typeinfo.typeU32Vec3,
  bvec3: typeinfo.typeBVec3,
  vec4: typeinfo.typeF32Vec4,
  ivec4: typeinfo.typeI32Vec4,
  uvec4: typeinfo.typeU32Vec4,
  bvec4: typeinfo.typeBVec4,
  mat2: typeinfo.typeMat2,
  mat2x3: typeinfo.typeMat2x3,
  mat2x4: typeinfo.typeMat2x4,
  mat3x2: typeinfo.typeMat3x2,
  mat3: typeinfo.typeMat3,
  mat3x4: typeinfo.typeMat3x4,
  mat4x2: typeinfo.typeMat4x2,
  mat4x3: typeinfo.typeMat4x3,
  mat4: typeinfo.typeMat4
};

Object.keys(primitiveCtors).forEach(k => {
  ProgramBuilder.prototype[k] = makeConstructor(function (this: ProgramBuilder, ...args: any[]): PBShaderExp {
    return vec_n.call(this, primitiveCtors[k], ...args);
  } as ShaderTypeFunc, primitiveCtors[k]);
});

const simpleCtors = {
  tex1D: typeinfo.typeTex1D,
  tex2D: typeinfo.typeTex2D,
  tex3D: typeinfo.typeTex3D,
  texCube: typeinfo.typeTexCube,
  tex2DShadow: typeinfo.typeTexDepth2D,
  texCubeShadow: typeinfo.typeTexDepthCube,
  tex2DArray: typeinfo.typeTex2DArray,
  tex2DArrayShadow: typeinfo.typeTexDepth2DArray,
  texExternal: typeinfo.typeTexExternal,
  itex1D: typeinfo.typeITex1D,
  itex2D: typeinfo.typeITex2D,
  itex3D: typeinfo.typeITex3D,
  itexCube: typeinfo.typeITexCube,
  itex2DArray: typeinfo.typeITex2DArray,
  utex1D: typeinfo.typeUTex1D,
  utex2D: typeinfo.typeUTex2D,
  utex3D: typeinfo.typeUTex3D,
  utexCube: typeinfo.typeUTexCube,
  utex2DArray: typeinfo.typeUTex2DArray,
  sampler: typeinfo.typeSampler,
  samplerComparison: typeinfo.typeSamplerComparison,
};

Object.keys(simpleCtors).forEach(k => {
  ProgramBuilder.prototype[k] = function (this: ProgramBuilder, rhs: string): PBShaderExp {
    return new PBShaderExp(rhs, simpleCtors[k]);
  };
});

function makeStorageTextureCtor(type: typeinfo.PBTextureType): StorageTextureConstructor {
  const ctor = {} as StorageTextureConstructor;
  for (const k of Object.keys(StorageTextureFormatMap)) {
    ctor[k] = function (rhs: string): PBShaderExp {
      return new PBShaderExp(rhs, new typeinfo.PBTextureTypeInfo(type, StorageTextureFormatMap[k]));
    };
  }
  return ctor;
}

ProgramBuilder.prototype.texStorage1D = makeStorageTextureCtor(typeinfo.PBTextureType.TEX_STORAGE_1D);
ProgramBuilder.prototype.texStorage2D = makeStorageTextureCtor(typeinfo.PBTextureType.TEX_STORAGE_2D);
ProgramBuilder.prototype.texStorage2DArray = makeStorageTextureCtor(typeinfo.PBTextureType.TEX_STORAGE_2D_ARRAY);
ProgramBuilder.prototype.texStorage3D = makeStorageTextureCtor(typeinfo.PBTextureType.TEX_STORAGE_3D);
