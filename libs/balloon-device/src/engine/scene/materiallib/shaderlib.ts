import { VERTEX_ATTRIB_POSITION, VERTEX_ATTRIB_BLEND_INDICES, VERTEX_ATTRIB_BLEND_WEIGHT, VERTEX_ATTRIB_TANGENT, VERTEX_ATTRIB_NORMAL } from '../../device';
import { ProgramBuilder, PBShaderExp, PBInsideFunctionScope, PBPrimitiveType } from '../../device/builder';

export const MAX_BONE_MATRIX_UNIFORM = 36;

export class ShaderLib {
  static readonly USAGE_VIEW_PROJ_MATRIX = 'ch_usage_viewProjMatrix';
  static readonly USAGE_VIEW_MATRIX = 'ch_usage_viewMatrix';
  static readonly USAGE_PROJECTION_MATRIX = 'ch_usage_projMatrix';
  static readonly USAGE_WORLD_MATRIX = 'ch_usage_worldMatrix';
  static readonly USAGE_BONE_MATRICIES = 'ch_usage_boneMatrices';
  static readonly USAGE_BONE_TEXTURE_SIZE = 'ch_usage_boneTextureSize';
  static readonly USAGE_INV_BIND_MATRIX = 'ch_usage_invBindMatrix';
  static readonly USAGE_WORLD_VIEW_PROJ_MATRIX = 'ch_usage_worldViewProjMatrix';
  static readonly USAGE_NORMAL_MAP = 'ch_usage_normalMap';
  static readonly USAGE_NORMAL_SCALE = 'ch_usage_normalScale';
  static readonly USAGE_VERTEX_COLOR = 'ch_usage_vertexColor';
  static readonly USAGE_WORLD_POSITION = 'ch_usage_worldPosition';
  static readonly USAGE_WORLD_NORMAL = 'ch_usage_worldNormal';
  static readonly USAGE_WORLD_TANGENT = 'ch_usage_worldTangent';
  static readonly USAGE_WORLD_BINORMAL = 'ch_usage_worldBinormal';
  static readonly USAGE_ENV_LIGHT_STRENGTH = 'ch_usage_envLightStrength';
  static readonly USAGE_CAMERA_POSITION = 'ch_usage_cameraPosition';
  static readonly USAGE_CAMERA_PARAMS = 'ch_usage_cameraParams';
  /** @internal */
  private static readonly funcNameFTransform = 'lib_ftransform';
  /** @internal */
  private static readonly funcNameFTransformWorld = 'lib_ftransformWorld';
  /** @internal */
  private static readonly funcNameGetSkinningMatrix = 'lib_getSkinningMatrix';
  /** @internal */
  private static readonly funcNameTransformSkinnedVertex = 'lib_transformSkinnedVertex';
  /** @internal */
  private static readonly funcNameTransformSkinnedNormal = 'lib_transformSkinnedNormal';
  /** @internal */
  private static readonly funcNameTransformSkinnedTangent = 'lib_transformSkinnedlTangent';
  /** @internal */
  private static readonly funcNameObjectSpacePositionToWorld = 'lib_objPosToWorld';
  /** @internal */
  private static readonly funcNameWorldSpacePositionToClip = 'lib_worldPosToClip';
  /** @internal */
  private static readonly funcNameObjectSpaceVectorToWorld = 'lib_objVecToWorld';
  /** @internal */
  private static readonly funcNameCotangentFrame = 'lib_cotangentFrame';
  /** @internal */
  private static readonly funcNamePerturbNormal = 'lib_perturbNormal';
  /** @internal */
  private static readonly funcNameEvalPixelNormal = 'lib_evalPixelNormal';
  /** @internal */
  private static readonly funcNameEncodeNormalizedFloatToRGBA = 'lib_encodeNormalizedFloatToRGBA';
  /** @internal */
  private static readonly funcNameDecodeNormalizedFloatFromRGBA = 'lib_decodeNormalizedFloatFromRGBA';
  /** @internal */
  private static readonly funcNameEncode2HalfToRGBA = 'lib_encode2HalfToRGBA';
  /** @internal */
  private static readonly funcNameDecode2HalfFromRGBA = 'lib_decode2HalfFromRGBA';
  /** @internal */
  private static readonly funcNameEncodeColorOutput = 'lib_encodeColorOutput';
  /** @internal */
  private static readonly funcNameEncodeNormalSP = 'lib_encodeNormalSP';
  /** @internal */
  private static readonly funcNameDecodeNormalSP = 'lib_decodeNormalSP';
  /** @internal */
  private builder: ProgramBuilder;
  constructor(builder: ProgramBuilder) {
    this.builder = builder;
  }
  ftransform(inputPos?: PBShaderExp): PBShaderExp {
    const pb = this.builder;
    const that = this;
    if (!pb.getFunction(ShaderLib.funcNameFTransform)) {
      pb.globalScope.$function(ShaderLib.funcNameFTransform, [pb.vec3('inputPos')], function () {
        const viewProjMatrix = pb.queryGlobal(ShaderLib.USAGE_VIEW_PROJ_MATRIX);
        const wvpMatrix = pb.queryGlobal(ShaderLib.USAGE_WORLD_VIEW_PROJ_MATRIX);
        if (wvpMatrix) {
          this.$l.pos = pb.mul(wvpMatrix, pb.vec4(this.inputPos, 1));
        } else {
          const worldMatrix = pb.queryGlobal(ShaderLib.USAGE_WORLD_MATRIX);
          if (worldMatrix && viewProjMatrix) {
            this.$l.pos = pb.mul(viewProjMatrix, that.objectSpacePositionToWorld(this.inputPos));
          } else if (viewProjMatrix) {
            this.$l.pos = pb.mul(viewProjMatrix, pb.vec4(this.inputPos, 1));
          } else {
            this.$l.pos = pb.vec4(this.inputPos, 1);
          }
        }
        const cameraParams = pb.queryGlobal(ShaderLib.USAGE_CAMERA_PARAMS);
        if (cameraParams) {
          this.$if(pb.notEqual(cameraParams.z, 0), function () {
            this.pos.y = pb.neg(this.pos.y);
          });
        }
        this.$return(this.$l.pos);
      });
    }
    const pos = inputPos || pb.globalScope.$getVertexAttrib(VERTEX_ATTRIB_POSITION);
    if (!pos) {
      throw new Error('ftransform() failed: no vertex position attribute');
    }
    return pb.globalScope[ShaderLib.funcNameFTransform](pos.xyz);
  }
  ftransformWorld(worldPos?: PBShaderExp): PBShaderExp {
    const pb = this.builder;
    if (!pb.getFunction(ShaderLib.funcNameFTransformWorld)) {
      pb.globalScope.$function(ShaderLib.funcNameFTransformWorld, [pb.vec3('inputPos')], function () {
        const viewProjMatrix = pb.queryGlobal(ShaderLib.USAGE_VIEW_PROJ_MATRIX);
        this.$l.pos = pb.mul(viewProjMatrix, pb.vec4(this.inputPos, 1));
        const cameraParams = pb.queryGlobal(ShaderLib.USAGE_CAMERA_PARAMS);
        if (cameraParams) {
          this.$if(pb.notEqual(cameraParams.z, 0), function () {
            this.pos.y = pb.neg(this.pos.y);
          });
        }
        this.$return(this.$l.pos);
      });
    }
    return pb.globalScope[ShaderLib.funcNameFTransformWorld](worldPos.xyz);
  }
  getSkinMatrix(): PBShaderExp {
    const pb = this.builder;
    const funcNameGetBoneMatrixFromTexture = 'lib_getBoneMatrixFromTexture';
    if (!pb.getFunction(funcNameGetBoneMatrixFromTexture)) {
      pb.globalScope.$function(funcNameGetBoneMatrixFromTexture, [pb.int('boneIndex')], function () {
        const boneTexture = pb.queryGlobal(ShaderLib.USAGE_BONE_MATRICIES);
        this.$l.w = pb.float(pb.queryGlobal(ShaderLib.USAGE_BONE_TEXTURE_SIZE));
        this.$l.pixelIndex = pb.float(pb.mul(this.boneIndex, 4));
        this.$l.xIndex = pb.mod(this.pixelIndex, this.w);
        this.$l.yIndex = pb.floor(pb.div(this.pixelIndex, this.w));
        this.$l.u1 = pb.div(pb.add(this.xIndex, 0.5), this.w);
        this.$l.u2 = pb.div(pb.add(this.xIndex, 1.5), this.w);
        this.$l.u3 = pb.div(pb.add(this.xIndex, 2.5), this.w);
        this.$l.u4 = pb.div(pb.add(this.xIndex, 3.5), this.w);
        this.$l.v = pb.div(pb.add(this.yIndex, 0.5), this.w);
        if (pb.getDeviceType() !== 'webgl') {
          this.$l.row1 = pb.textureSampleLevel(boneTexture, pb.vec2(this.u1, this.v), 0);
          this.$l.row2 = pb.textureSampleLevel(boneTexture, pb.vec2(this.u2, this.v), 0);
          this.$l.row3 = pb.textureSampleLevel(boneTexture, pb.vec2(this.u3, this.v), 0);
          this.$l.row4 = pb.textureSampleLevel(boneTexture, pb.vec2(this.u4, this.v), 0);
        } else {
          this.$l.row1 = pb.textureSample(boneTexture, pb.vec2(this.u1, this.v));
          this.$l.row2 = pb.textureSample(boneTexture, pb.vec2(this.u2, this.v));
          this.$l.row3 = pb.textureSample(boneTexture, pb.vec2(this.u3, this.v));
          this.$l.row4 = pb.textureSample(boneTexture, pb.vec2(this.u4, this.v));
        }
        this.$return(pb.mat4(this.row1, this.row2, this.row3, this.row4));
      });
    }
    if (!pb.getFunction(ShaderLib.funcNameGetSkinningMatrix)) {
      pb.globalScope.$function(ShaderLib.funcNameGetSkinningMatrix, [], function () {
        const invBindMatrix = pb.queryGlobal(ShaderLib.USAGE_INV_BIND_MATRIX);
        const blendIndices = pb.globalScope.$getVertexAttrib(VERTEX_ATTRIB_BLEND_INDICES);
        const blendWeights = pb.globalScope.$getVertexAttrib(VERTEX_ATTRIB_BLEND_WEIGHT);
        this.$l.m0 = pb.globalScope[funcNameGetBoneMatrixFromTexture](pb.int(blendIndices[0]));
        this.$l.m1 = pb.globalScope[funcNameGetBoneMatrixFromTexture](pb.int(blendIndices[1]));
        this.$l.m2 = pb.globalScope[funcNameGetBoneMatrixFromTexture](pb.int(blendIndices[2]));
        this.$l.m3 = pb.globalScope[funcNameGetBoneMatrixFromTexture](pb.int(blendIndices[3]));
        this.$l.m = pb.add(pb.mul(this.m0, blendWeights.x), pb.mul(this.m1, blendWeights.y), pb.mul(this.m2, blendWeights.z), pb.mul(this.m3, blendWeights.w));
        this.$return(pb.mul(invBindMatrix, this.m));
        /*
        if (pb.getDeviceType() === 'webgl') {
          this.$l.m0 = pb.mat4();
          this.$l.m1 = pb.mat4();
          this.$l.m2 = pb.mat4();
          this.$l.m3 = pb.mat4();
          this.$l.i0 = blendIndices.x;
          this.$l.i1 = blendIndices.y;
          this.$l.i2 = blendIndices.z;
          this.$l.i3 = blendIndices.w;
          this.$for(pb.int('i'), 0, MAX_BONE_MATRIX_UNIFORM, function () {
            this.$if(pb.equal(this.i, pb.int(this.i0)), function () {
              this.m0 = boneMatrices.at(this.i);
            });
            this.$if(pb.equal(this.i, pb.int(this.i1)), function () {
              this.m1 = boneMatrices.at(this.i);
            });
            this.$if(pb.equal(this.i, pb.int(this.i2)), function () {
              this.m2 = boneMatrices.at(this.i);
            });
            this.$if(pb.equal(this.i, pb.int(this.i3)), function () {
              this.m3 = boneMatrices.at(this.i);
            });
          });
          this.$return(pb.add(pb.mul(this.m0, blendWeights.x), pb.mul(this.m1, blendWeights.y), pb.mul(this.m2, blendWeights.z), pb.mul(this.m3, blendWeights.w)));
        } else {
          const m0 = boneMatrices.at(pb.int(blendIndices[0]));
          const m1 = boneMatrices.at(pb.int(blendIndices[1]));
          const m2 = boneMatrices.at(pb.int(blendIndices[2]));
          const m3 = boneMatrices.at(pb.int(blendIndices[3]));
          this.$return(pb.add(pb.mul(m0, blendWeights.x), pb.mul(m1, blendWeights.y), pb.mul(m2, blendWeights.z), pb.mul(m3, blendWeights.w)));
        }
        */
      });
    }
    return pb.globalScope[ShaderLib.funcNameGetSkinningMatrix]();
  }
  transformSkinnedVertex(skinningMatrix: PBShaderExp, pos?: PBShaderExp): PBShaderExp {
    const pb = this.builder;
    const boneMatrices = pb.queryGlobal(ShaderLib.USAGE_BONE_MATRICIES);
    const blendIndices = pb.globalScope.$getVertexAttrib(VERTEX_ATTRIB_BLEND_INDICES);
    const blendWeights = pb.globalScope.$getVertexAttrib(VERTEX_ATTRIB_BLEND_WEIGHT);
    if (boneMatrices && blendIndices && blendWeights) {
      if (!pb.getFunction(ShaderLib.funcNameTransformSkinnedVertex)) {
        pb.globalScope.$function(ShaderLib.funcNameTransformSkinnedVertex, [pb.vec3('pos'), pb.mat4('skinningMatrix')], function () {
          this.$l.skinnedVertex = pb.mul(this.skinningMatrix, pb.vec4(this.pos, 1));
          this.$return(pb.div(this.$l.skinnedVertex.xyz, this.$l.skinnedVertex.w));
        });
      }
      return pb.globalScope[ShaderLib.funcNameTransformSkinnedVertex](pos || pb.globalScope.$getVertexAttrib(VERTEX_ATTRIB_POSITION), skinningMatrix);
    } else {
      return pos;
    }
  }
  transformSkinnedNormal(skinningMatrix: PBShaderExp, normal?: PBShaderExp): PBShaderExp {
    const pb = this.builder;
    const boneMatrices = pb.queryGlobal(ShaderLib.USAGE_BONE_MATRICIES);
    const blendIndices = pb.globalScope.$getVertexAttrib(VERTEX_ATTRIB_BLEND_INDICES);
    const blendWeights = pb.globalScope.$getVertexAttrib(VERTEX_ATTRIB_BLEND_WEIGHT);
    if (boneMatrices && blendIndices && blendWeights) {
      if (!pb.getFunction(ShaderLib.funcNameTransformSkinnedNormal)) {
        pb.globalScope.$function(ShaderLib.funcNameTransformSkinnedNormal, [pb.vec3('normal'), pb.mat4('skinningMatrix')], function () {
          this.$return(pb.mul(this.skinningMatrix, pb.vec4(this.normal, 0)).xyz);
        });
      }
      return pb.globalScope[ShaderLib.funcNameTransformSkinnedNormal](normal || pb.globalScope.$getVertexAttrib(VERTEX_ATTRIB_NORMAL), skinningMatrix);
    } else {
      return normal;
    }
  }
  transformSkinnedTangent(skinningMatrix: PBShaderExp, tangent?: PBShaderExp): PBShaderExp {
    const pb = this.builder;
    const boneMatrices = pb.queryGlobal(ShaderLib.USAGE_BONE_MATRICIES);
    const blendIndices = pb.globalScope.$getVertexAttrib(VERTEX_ATTRIB_BLEND_INDICES);
    const blendWeights = pb.globalScope.$getVertexAttrib(VERTEX_ATTRIB_BLEND_WEIGHT);
    if (boneMatrices && blendIndices && blendWeights) {
      if (!pb.getFunction(ShaderLib.funcNameTransformSkinnedTangent)) {
        pb.globalScope.$function(ShaderLib.funcNameTransformSkinnedTangent, [pb.vec4('tangent'), pb.mat4('skinningMatrix')], function () {
          this.$l.skinnedTangent = pb.mul(this.skinningMatrix, pb.vec4(this.tangent.xyz, 0)).xyz;
          this.$return(pb.vec4(this.$l.skinnedTangent, this.tangent.w));
        });
      }
      return pb.globalScope[ShaderLib.funcNameTransformSkinnedTangent](tangent || pb.globalScope.$getVertexAttrib(VERTEX_ATTRIB_TANGENT), skinningMatrix);
    } else {
      return tangent;
    }
  }
  worldSpacePositionToClip(pos: PBShaderExp): PBShaderExp {
    if (!pos || !pos.isVector() || (pos.numComponents() !== 3)) {
      throw new Error('worldSpacePositionToClip() failed: pos parameter type must be vec3');
    }
    const pb = this.builder;
    if (!pb.getFunction(ShaderLib.funcNameWorldSpacePositionToClip)) {
      pb.globalScope.$function(ShaderLib.funcNameWorldSpacePositionToClip, [pb.vec3('pos')], function () {
        const viewProjMatrix = pb.queryGlobal(ShaderLib.USAGE_VIEW_PROJ_MATRIX);
        if (!viewProjMatrix) {
          throw new Error('ftransform() failed: no viewprojection matrix uniform');
        }
        this.$l.p = pb.mul(viewProjMatrix, pb.vec4(this.pos, 1));
        const cameraParams = pb.queryGlobal(ShaderLib.USAGE_CAMERA_PARAMS);
        if (cameraParams) {
          this.$if(pb.notEqual(cameraParams.z, 0), function () {
            this.p.y = pb.neg(this.p.y);
          });
        }
        this.$return(this.$l.p);
      });
    }
    return pb.globalScope[ShaderLib.funcNameWorldSpacePositionToClip](pos);
  }
  objectSpacePositionToWorld(pos: PBShaderExp): PBShaderExp {
    if (!pos || !pos.isVector() || (pos.numComponents() !== 3)) {
      throw new Error('objectSpacePositionToWorld() failed: position parameter type must be vec3');
    }
    const pb = this.builder;
    const scope = pb.currentScope();
    if (!scope || !(scope instanceof PBInsideFunctionScope)) {
      throw new Error('objectSpacePositionToWorld() failed: objectSpacePositionToWorld() must be called inside a function');
    }
    if (!pb.getFunction(ShaderLib.funcNameObjectSpacePositionToWorld)) {
      pb.globalScope.$function(ShaderLib.funcNameObjectSpacePositionToWorld, [pb.vec3('pos')], function () {
        const worldMatrix = pb.queryGlobal(ShaderLib.USAGE_WORLD_MATRIX);
        this.$return(worldMatrix ? pb.mul(worldMatrix, pb.vec4(this.pos, 1)) : pb.vec4(this.pos, 1));
      });
    }
    return scope[ShaderLib.funcNameObjectSpacePositionToWorld](pos);
  }
  objectSpaceVectorToWorld(vec: PBShaderExp): PBShaderExp {
    if (!vec || !vec.isVector() || vec.numComponents() !== 3) {
      throw new Error('objectSpaceVectorToWorld() failed: vector parameter type must be vec3');
    }
    const pb = this.builder;
    const scope = pb.currentScope();
    if (!scope || !(scope instanceof PBInsideFunctionScope)) {
      throw new Error('objectSpaceVectorToWorld() failed: objectSpaceVectorToWorld() must be called inside a function');
    }
    if (!pb.getFunction(ShaderLib.funcNameObjectSpaceVectorToWorld)) {
      pb.globalScope.$function(ShaderLib.funcNameObjectSpaceVectorToWorld, [pb.vec3('v')], function () {
        const worldMatrix = pb.queryGlobal(ShaderLib.USAGE_WORLD_MATRIX);
        this.$return(worldMatrix ? pb.mul(worldMatrix, pb.vec4(this.v, 0)).xyz : this.v);
      });
    }
    return scope[ShaderLib.funcNameObjectSpaceVectorToWorld](vec);
  }
  nonLinearDepthToLinear(depth: PBShaderExp, nearFar?: PBShaderExp): PBShaderExp {
    const pb = this.builder;
    nearFar = nearFar || pb.currentScope().$query(ShaderLib.USAGE_CAMERA_PARAMS);
    return pb.div(pb.mul(nearFar.x, nearFar.y), pb.mix(nearFar.y, nearFar.x, depth));
  }
  nonLinearDepthToLinearNormalized(depth: PBShaderExp, nearFar?: PBShaderExp): PBShaderExp {
    const pb = this.builder;
    nearFar = nearFar || pb.currentScope().$query(ShaderLib.USAGE_CAMERA_PARAMS);
    return pb.div(nearFar.x, pb.mix(nearFar.y, nearFar.x, depth));
  }
  linearToNonLinear(depth: PBShaderExp, nearFar?: PBShaderExp): PBShaderExp {
    const pb = this.builder;
    nearFar = nearFar || pb.currentScope().$query(ShaderLib.USAGE_CAMERA_PARAMS);
    return pb.div(pb.sub(nearFar.y, pb.div(pb.mul(nearFar.x, nearFar.y), depth)), pb.sub(nearFar.y, nearFar.x));
  }
  encode2HalfToRGBA(a: PBShaderExp | number, b: PBShaderExp | number): PBShaderExp {
    const pb = this.builder;
    if (!pb.getFunction(ShaderLib.funcNameEncode2HalfToRGBA)) {
      pb.globalScope.$function(ShaderLib.funcNameEncode2HalfToRGBA, [pb.float('a'), pb.float('b')], function () {
        this.$l.t = pb.vec4(this.a, pb.fract(pb.mul(this.a, 255)), this.b, pb.fract(pb.mul(this.b, 255)));
        this.$return(pb.vec4(pb.sub(this.t.x, pb.div(this.t.y, 255)), this.t.y, pb.sub(this.t.z, pb.div(this.t.w, 255)), this.t.w));
      });
    }
    return pb.globalScope[ShaderLib.funcNameEncode2HalfToRGBA](a, b);
  }
  decode2HalfFromRGBA(value: PBShaderExp): PBShaderExp {
    const pb = this.builder;
    if (!pb.getFunction(ShaderLib.funcNameDecode2HalfFromRGBA)) {
      pb.globalScope.$function(ShaderLib.funcNameDecode2HalfFromRGBA, [pb.vec4('value')], function () {
        this.$return(pb.vec2(pb.add(this.value.x, pb.div(this.value.y, 255)), pb.add(this.value.z, pb.div(this.value.w, 255))));
      });
    }
    return pb.globalScope[ShaderLib.funcNameDecode2HalfFromRGBA](value);
  }
  encodeNormalizedFloatToRGBA(value: PBShaderExp | number): PBShaderExp {
    const pb = this.builder;
    if (!pb.getFunction(ShaderLib.funcNameEncodeNormalizedFloatToRGBA)) {
      pb.globalScope.$function(ShaderLib.funcNameEncodeNormalizedFloatToRGBA, [pb.float('value')], function () {
        this.$l.bitShift = pb.vec4(256 * 256 * 256, 256 * 256, 256, 1);
        this.$l.bitMask = pb.vec4(0, 1 / 256, 1 / 256, 1 / 256);
        this.$l.t = pb.fract(pb.mul(this.value, this.bitShift));
        this.$return(pb.sub(this.t, pb.mul(this.t.xxyz, this.bitMask)));
      });
    }
    return pb.globalScope[ShaderLib.funcNameEncodeNormalizedFloatToRGBA](value);
  }
  decodeNormalizedFloatFromRGBA(value: PBShaderExp): PBShaderExp {
    const sb = this.builder;
    if (!value || !value.$typeinfo.isPrimitiveType() || value.$typeinfo.primitiveType !== PBPrimitiveType.F32VEC4) {
      throw new Error('decodeNormalizedFloatFromRGBA() failed: parameter type must be vec4');
    }
    const scope = sb.currentScope();
    if (!scope || !(scope instanceof PBInsideFunctionScope)) {
      throw new Error('decodeNormalizedFloatFromRGBA() failed: decodeNormalizedFloatFromRGBA() must be called inside a function');
    }
    if (!sb.getFunction(ShaderLib.funcNameDecodeNormalizedFloatFromRGBA)) {
      sb.globalScope.$function(ShaderLib.funcNameDecodeNormalizedFloatFromRGBA, [sb.vec4('value')], function () {
        this.$l.bitShift = sb.vec4(1 / (256 * 256 * 256), 1 / (256 * 256), 1 / 256, 1);
        this.$return(sb.dot(this.value, this.bitShift));
      });
    }
    return scope[ShaderLib.funcNameDecodeNormalizedFloatFromRGBA](value);
  }
  calcFaceNormal(pos: PBShaderExp) {
    const funcNameCalcFaceNormal = 'lib_calcFaceNormal';
    const pb = this.builder;
    if (!pb.getFunction(funcNameCalcFaceNormal)) {
      pb.globalScope.$function(funcNameCalcFaceNormal, [pb.vec3('pos')], function () {
        this.$l.posDX = pb.dpdx(this.pos);
        this.$l.posDY = pb.dpdy(this.pos);
        this.$l.n = pb.normalize(pb.cross(this.posDX, this.posDY));
        this.$if(pb.not(this.$builtins.frontFacing), function () {
          this.n = pb.neg(this.n);
        });
        this.$return(this.n);
      });
    }
    return pb.globalScope[funcNameCalcFaceNormal](pos);
  }
  evalNormal(worldNormal: PBShaderExp, normalMapTexCoord?: PBShaderExp, worldTangent?: PBShaderExp, worldBinormal?: PBShaderExp, worldPosition?: PBShaderExp): PBShaderExp {
    const pb = this.builder;
    if (!worldNormal || !worldNormal.$typeinfo.isPrimitiveType() || worldNormal.$typeinfo.primitiveType !== PBPrimitiveType.F32VEC3) {
      throw new Error('evalNormal() failed: worldNormal parameter must be vec3');
    }
    const scope = pb.currentScope();
    if (!scope || !(scope instanceof PBInsideFunctionScope)) {
      throw new Error('evalNormal() failed: evalNormal() must be called inside a function');
    }
    if (!pb.queryGlobal(ShaderLib.USAGE_NORMAL_MAP)) {
      if (!pb.getFunction(ShaderLib.funcNameEvalPixelNormal)) {
        pb.globalScope.$function(ShaderLib.funcNameEvalPixelNormal, [pb.vec3('worldNormal')], function () {
          this.$l.n = pb.normalize(this.worldNormal);
          this.$if(pb.not(this.$builtins.frontFacing), function () {
            this.n = pb.neg(this.n);
          });
          this.$return(this.n);
        });
      }
      return scope[ShaderLib.funcNameEvalPixelNormal](worldNormal);
    }
    if (!normalMapTexCoord || !normalMapTexCoord.isVector() || normalMapTexCoord.numComponents() !== 2) {
      throw new Error('evalNormal() failed: normalMapTexCoord parameter must be type vec2');
    }
    if (!pb.getFunction(ShaderLib.funcNameCotangentFrame)) {
      if (worldTangent) {
        pb.globalScope.$function(ShaderLib.funcNameCotangentFrame, [pb.vec3('normal'), pb.vec3('tangent'), pb.vec3('binormal')], function () {
          this.$return(pb.mat3(pb.normalize(this.tangent), pb.normalize(this.binormal), pb.normalize(this.normal)));
        });
      } else {
        if (!worldPosition || !worldPosition.$typeinfo.isPrimitiveType() || worldPosition.$typeinfo.primitiveType !== PBPrimitiveType.F32VEC3) {
          throw new Error('evalNormal() failed: worldPosition parameter type must be vec3');
        }
        pb.globalScope.$function(ShaderLib.funcNameCotangentFrame, [pb.vec3('normal'), pb.vec3('p'), pb.vec2('uv')], function () {
          this.$l.n = pb.normalize(this.normal);
          this.$l.dp1 = pb.dpdx(this.p);
          this.$l.dp2 = pb.dpdy(this.p);
          this.$l.duv1 = pb.dpdx(this.uv);
          this.$l.duv2 = pb.dpdy(this.uv);
          this.$l.dp2perp = pb.cross(this.dp2, this.n);
          this.$l.dp1perp = pb.cross(this.n, this.dp1);
          this.$l.tangent = pb.add(pb.mul(this.dp2perp, this.duv1.x), pb.mul(this.dp1perp, this.duv2.x));
          this.$l.bitangent = pb.add(pb.mul(this.dp2perp, this.duv1.y), pb.mul(this.dp1perp, this.duv2.y));
          this.$l.invmax = pb.inverseSqrt(pb.max(pb.dot(this.tangent, this.tangent), pb.dot(this.bitangent, this.bitangent)));
          this.$return(
            pb.mat3(pb.mul(this.tangent, this.invmax), pb.mul(this.bitangent, this.invmax), this.n),
          );
        });
      }
      pb.globalScope.$function(
        ShaderLib.funcNamePerturbNormal,
        [pb.mat3('cotangentFrame'), pb.vec2('uv'), pb.float('scale')],
        function () {
          this.$l.color = pb.sub(pb.mul(pb.textureSample(pb.queryGlobal(ShaderLib.USAGE_NORMAL_MAP), this.uv).xyz, 2), pb.vec3(1, 1, 1));
          this.color = pb.mul(this.color, pb.vec3(this.scale, this.scale, 1));
          this.$return(pb.normalize(pb.mul(this.cotangentFrame, this.color)));
        },
      );
    }
    if (!pb.getFunction(ShaderLib.funcNameEvalPixelNormal)) {
      if (worldTangent) {
        pb.globalScope.$function(ShaderLib.funcNameEvalPixelNormal, [pb.vec3('normal'), pb.vec3('tangent'), pb.vec3('binormal'), pb.vec2('uv')], function () {
          this.$l.TBN = pb.globalScope[ShaderLib.funcNameCotangentFrame](this.normal, this.tangent, this.binormal);
          this.$l.n = pb.globalScope[ShaderLib.funcNamePerturbNormal](this.TBN, this.uv, pb.queryGlobal(ShaderLib.USAGE_NORMAL_SCALE) || 1);
          this.$if(pb.not(this.$builtins.frontFacing), function () {
            this.n = pb.neg(this.n);
          });
          this.$return(this.n);
        });
      } else {
        pb.globalScope.$function(ShaderLib.funcNameEvalPixelNormal, [pb.vec3('normal'), pb.vec3('pos'), pb.vec2('uv')], function () {
          this.$l.TBN = pb.globalScope[ShaderLib.funcNameCotangentFrame](this.normal, this.pos, this.uv);
          this.$l.n = pb.globalScope[ShaderLib.funcNamePerturbNormal](this.TBN, this.uv, pb.queryGlobal(ShaderLib.USAGE_NORMAL_SCALE) || 1);
          this.$if(pb.not(this.$builtins.frontFacing), function () {
            this.n = pb.neg(this.n);
          });
          this.$return(this.n);
        });
      }
    }
    return worldTangent
      ? pb.globalScope[ShaderLib.funcNameEvalPixelNormal](worldNormal, worldTangent, worldBinormal, normalMapTexCoord)
      : pb.globalScope[ShaderLib.funcNameEvalPixelNormal](worldNormal, worldPosition, normalMapTexCoord);
  }
  encodeColorOutput(outputColor: PBShaderExp): PBShaderExp {
    const pb = this.builder;
    if (!pb.getFunction(ShaderLib.funcNameEncodeColorOutput)) {
      pb.globalScope.$function(ShaderLib.funcNameEncodeColorOutput, [pb.vec4('outputColor')], function () {
        const params = pb.queryGlobal(ShaderLib.USAGE_CAMERA_PARAMS);
        this.$if(pb.notEqual(params.w, 0), function () {
          this.$return(pb.vec4(pb.pow(this.outputColor.xyz, pb.vec3(1 / 2.2)), this.outputColor.w));
        }).$else(function () {
          this.$return(this.outputColor);
        });
      });
    }
    return pb.globalScope[ShaderLib.funcNameEncodeColorOutput](outputColor);
  }
  //  encode normal with Stereographic Projection
  //  half4 encode(half3 n, float3 view)
  //  {
  //    half scale = 1.7777;
  //    half2 enc = n.xy / (n.z + 1);
  //    enc /= scale;
  //    enc = enc * 0.5 + 0.5;
  //    return half4(enc, 0, 0);
  // }
  encodeNormal_SP(normal: PBShaderExp): PBShaderExp {
    const scale = 1.7777;
    const pb = this.builder;
    if (!pb.getFunction(ShaderLib.funcNameEncodeNormalSP)) {
      pb.globalScope.$function(ShaderLib.funcNameEncodeNormalSP, [pb.vec3('normal')], function () {
        this.$l.enc = pb.div(this.normal.xy, pb.add(this.normal.z, 1));
        this.$l.enc = pb.div(this.$l.enc, scale);
        this.$l.enc = pb.add(pb.mul(this.$l.enc, 0.5), pb.vec2(0.5));
        this.$return(this.$l.enc);
      });
    }
    return pb.globalScope[ShaderLib.funcNameEncodeNormalSP](normal);
  }
  //  decode normal which was encoded with Stereographic Projection
  //  half3 decode (half4 enc, float3 view)
  //  {
  //    half scale = 1.7777;
  //    half3 nn =
  //      enc.xyz*half3(2*scale,2*scale,0) +
  //      half3(-scale,-scale,1);
  //    half g = 2.0 / dot(nn.xyz,nn.xyz);
  //    half3 n;
  //    n.xy = g*nn.xy;
  //    n.z = g-1;
  //    return n;
  //  }
  decodeNormal_SP(enc: PBShaderExp): PBShaderExp {
    const scale = 1.7777;
    const pb = this.builder;
    if (!pb.getFunction(ShaderLib.funcNameDecodeNormalSP)) {
      pb.globalScope.$function(ShaderLib.funcNameDecodeNormalSP, [pb.vec2('enc')], function () {
        this.$l.nn = pb.add(pb.mul(pb.vec3(this.enc.xy, 0), pb.vec3(2 * scale, 2 * scale, 0)), pb.vec3(-scale, -scale, 1));
        this.$l.g = pb.div(2, pb.dot(this.$l.nn, this.$l.nn));
        this.$return(pb.vec3(pb.mul(this.$l.nn.xy, this.$l.g), pb.sub(this.$l.g, 1)));
      });
    }
    return pb.globalScope[ShaderLib.funcNameDecodeNormalSP](enc);
  }
  // get pseudo random value in range [0, 1)
  pseudoRandom(fragCoord: PBShaderExp): PBShaderExp {
    const funcNamePseudoRandom = 'lib_pseudoRandom';
    const pb = this.builder;
    if (!pb.getFunction(funcNamePseudoRandom)) {
      pb.globalScope.$function(funcNamePseudoRandom, [pb.vec2('c')], function () {
        this.$l.p3 = pb.fract(pb.mul(this.c.xyx, 0.1031));
        this.$l.p3 = pb.add(this.$l.p3, pb.dot(this.p3, pb.add(this.p3.yzx, pb.vec3(19.19))));
        this.$return(pb.fract(pb.mul(pb.add(this.$l.p3.x, this.$l.p3.y), this.$l.p3.z)));
      });
    }
    return pb.globalScope[funcNamePseudoRandom](fragCoord);
  }
}

