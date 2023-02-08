import { PBInsideFunctionScope, PBShaderExp, ProgramBuilder, TextureFormat, typeTexCube } from "../../device";
import { LightType } from "../light";
import { ShaderLib } from "../materiallib";
import { DEBUG_CASCADED_SHADOW_MAPS, RENDER_PASS_TYPE_FORWARD, RENDER_PASS_TYPE_MULTI_FORWARD } from "../values";
import { DrawContext } from "../drawable";
import { ForwardMultiRenderPass } from "./forward_multi_pass";
import type { LightModel } from "../materiallib";

export function forwardComputeLighting(scope: PBInsideFunctionScope, lm: LightModel, ctx: DrawContext): PBShaderExp {
  const env = ctx.environment;
  const funcNameIllumPointLight = 'stdmat_illumPointLight';
  const funcNameIllumDirectionalLight = 'stdmat_illumDirectionalLight';
  const funcNameIllumSpotLight = 'stdmat_illumSpotLight';
  const funcNameIllumDirectionalShadowLight = 'stdmat_illumDirectionalShadowLight';
  const funcNameIllumPointShadowLight = 'stdmat_illumPointShadowLight';
  const funcNameIllumCascadedShadowLight = 'stdmat_illumCascadedShadowLight';
  const funcNameIllumUnshadowedLights = 'stdmat_illumUnshadowedLights';
  const funcNameComputeLighting = 'stdmat_computeLighting';
  const pb = scope.$builder;
  if (!scope || !(scope instanceof PBInsideFunctionScope)) {
    throw new Error('forwardComputeLighting() failed: forwardComputeLighting() must be called inside a function');
  }
  if (!lm.supportLighting()) {
    return lm.calculateAlbedo(scope);
  }
  if (ctx.renderPass.getRenderPassType() === RENDER_PASS_TYPE_MULTI_FORWARD) {
    return forwardComputeLightingMultiPass(scope, lm, ctx);
  }
  if (ctx.renderPass.getRenderPassType() !== RENDER_PASS_TYPE_FORWARD) {
    throw new Error(`forwardComputeLighting() failed: invalid render pass type: ${ctx.renderPass.getRenderPassType()}`);
  }
  const lib = new ShaderLib(pb);
  function illumPointLight(lm: LightModel, surfaceData: PBShaderExp, ...args: PBShaderExp[]) {
    if (!pb.getFunction(funcNameIllumPointLight)) {
      pb.globalScope.$function(funcNameIllumPointLight, [
        pb.struct(surfaceData.getTypeName(), 'surfaceData'),
        pb.vec4('lightPositionRange'),
        pb.vec4('lightDirectionCutoff'),
        pb.vec3('lightDir'),
        pb.vec3('attenuation')
      ], function () {
        this.$l.dist = pb.distance(this.lightPositionRange.xyz, pb.queryGlobal(ShaderLib.USAGE_WORLD_POSITION).xyz);
        this.$l.falloff = pb.max(0, pb.sub(1, pb.div(this.dist, this.lightPositionRange.w)));
        this.$l.falloff2 = pb.mul(this.falloff, this.falloff);
        this.$if(pb.greaterThan(this.falloff2, 0), function () {
          lm.directBRDF(this, this.surfaceData, this.lightDir, pb.mul(this.attenuation, this.falloff2));
        });
      });
    }
    pb.globalScope[funcNameIllumPointLight](surfaceData, ...args);
  }
  function illumDirectionalLight(lm: LightModel, surfaceData: PBShaderExp, ...args: PBShaderExp[]) {
    if (!pb.getFunction(funcNameIllumDirectionalLight)) {
      pb.globalScope.$function(funcNameIllumDirectionalLight, [
        pb.struct(surfaceData.getTypeName(), 'surfaceData'),
        pb.vec4('lightPositionRange'),
        pb.vec4('lightDirectionCutoff'),
        pb.vec3('lightDir'),
        pb.vec3('attenuation')
      ], function () {
        lm.directBRDF(this, this.surfaceData, this.lightDir, this.attenuation);
      });
    }
    pb.globalScope[funcNameIllumDirectionalLight](surfaceData, ...args);
  }
  function illumSpotLight(lm: LightModel, surfaceData: PBShaderExp, ...args: PBShaderExp[]) {
    if (!pb.getFunction(funcNameIllumSpotLight)) {
      pb.globalScope.$function(funcNameIllumSpotLight, [
        pb.struct(surfaceData.getTypeName(), 'surfaceData'),
        pb.vec4('lightPositionRange'),
        pb.vec4('lightDirectionCutoff'),
        pb.vec3('lightDir'),
        pb.vec3('attenuation')
      ], function () {
        this.$l.spotFactor = pb.dot(this.lightDir, this.lightDirectionCutoff.xyz);
        this.spotFactor = pb.smoothStep(this.lightDirectionCutoff.w, pb.mix(this.lightDirectionCutoff.w, 1, 0.5), this.spotFactor);
        this.$if(pb.greaterThan(this.spotFactor, 0), function () {
          illumPointLight(lm, this.surfaceData, this.lightPositionRange, this.lightDirectionCutoff, this.lightDir, pb.mul(this.attenuation, this.spotFactor));
        });
      });
    }
    pb.globalScope[funcNameIllumSpotLight](surfaceData, ...args);
  }
  function illumLight(scope: PBInsideFunctionScope, lightType: number | PBShaderExp, lm: LightModel, surfaceData: PBShaderExp, ...args: PBShaderExp[]) {
    if (typeof lightType === 'number') {
      if (lightType === LightType.DIRECTIONAL) {
        illumDirectionalLight(lm, surfaceData, ...args);
      } else if (lightType === LightType.POINT) {
        illumPointLight(lm, surfaceData, ...args);
      } else if (lightType === LightType.SPOT) {
        illumSpotLight(lm, surfaceData, ...args);
      }
    } else {
      scope.$if(pb.equal(lightType, LightType.DIRECTIONAL), function () {
        illumDirectionalLight(lm, surfaceData, ...args);
      }).$elseif(pb.equal(lightType, LightType.POINT), function () {
        illumPointLight(lm, surfaceData, ...args);
      }).$elseif(pb.equal(lightType, LightType.SPOT), function () {
        illumSpotLight(lm, surfaceData, ...args);
      });
    }
  }
  function illumDirectionalShadowLight(lightType: LightType, lm: LightModel, surfaceData: PBShaderExp) {
    if (!pb.getFunction(funcNameIllumDirectionalShadowLight)) {
      pb.globalScope.$function(funcNameIllumDirectionalShadowLight, [pb.struct(surfaceData.getTypeName(), 'surfaceData')], function () {
        this.$l.positionRange = this.global.light.lightParams[0];
        this.$l.directionCutoff = this.global.light.lightParams[1];
        this.$l.diffuseIntensity = this.global.light.lightParams[2];
        this.$l.lightcolor = pb.mul(this.diffuseIntensity.xyz, this.diffuseIntensity.w);
        this.$l.lightDir = pb.vec3();
        this.$l.nl = pb.float();
        this.$l.NdotL = pb.float();
        if (lightType === LightType.DIRECTIONAL) {
          this.lightDir = this.directionCutoff.xyz;
          this.nl = pb.dot(this.surfaceData.normal, this.lightDir);
          this.NdotL = pb.clamp(pb.neg(this.nl), 0, 1);
        } else {
          this.lightDir = pb.sub(pb.queryGlobal(ShaderLib.USAGE_WORLD_POSITION).xyz, this.positionRange.xyz);
          this.$if(pb.greaterThan(pb.length(this.lightDir), this.positionRange.w), function () {
            this.$return();
          });
          this.lightDir = pb.normalize(this.lightDir);
          this.nl = pb.dot(this.surfaceData.normal, this.lightDir);
          this.NdotL = pb.clamp(pb.neg(this.nl), 0, 1);
        }
        this.shadowVertex = pb.vec4(
          pb.dot(this.global.light.lightParams[7], this.$query(ShaderLib.USAGE_WORLD_POSITION)),
          pb.dot(this.global.light.lightParams[8], this.$query(ShaderLib.USAGE_WORLD_POSITION)),
          pb.dot(this.global.light.lightParams[9], this.$query(ShaderLib.USAGE_WORLD_POSITION)),
          pb.dot(this.global.light.lightParams[10], this.$query(ShaderLib.USAGE_WORLD_POSITION)),
        );
        this.$l.shadow = ctx.shadowMapper.computeShadow(this, this.shadowVertex, this.NdotL);
        this.$if(pb.greaterThan(this.NdotL, 0), function(){
          this.$l.attenuation = pb.min(pb.mul(this.lightcolor, this.NdotL), pb.vec3(this.shadow));
          illumLight(this, lightType, lm, this.surfaceData, this.positionRange, this.directionCutoff, this.lightDir, this.attenuation);
        });
      });
    }
    pb.globalScope[funcNameIllumDirectionalShadowLight](surfaceData);
  }
  function illumPointShadowLight(lm: LightModel, surfaceData: PBShaderExp) {
    if (!pb.getFunction(funcNameIllumPointShadowLight)) {
      pb.globalScope.$function(funcNameIllumPointShadowLight, [
        pb.struct(surfaceData.getTypeName(), 'surfaceData')], function () {
        this.$l.positionRange = this.global.light.lightParams[0];
        this.$l.directionCutoff = this.global.light.lightParams[1];
        this.$l.diffuseIntensity = this.global.light.lightParams[2];
        this.$l.lightcolor = pb.mul(this.diffuseIntensity.xyz, this.diffuseIntensity.w);
        this.$l.lightDir = pb.vec3();
        this.lightDir = pb.sub(pb.queryGlobal(ShaderLib.USAGE_WORLD_POSITION).xyz, this.positionRange.xyz);
        this.$if(pb.greaterThan(pb.length(this.lightDir), this.positionRange.w), function () {
          this.$return();
        });
        this.lightDir = pb.normalize(this.lightDir);
        this.$l.nl = pb.dot(this.surfaceData.normal, this.lightDir);
        this.$l.NdotL = pb.clamp(pb.neg(this.nl), 0, 1);
        this.shadowBound = pb.vec4(0, 0, 1, 1);
        this.shadowVertex = pb.vec4(
          pb.dot(this.global.light.lightParams[7], this.$query(ShaderLib.USAGE_WORLD_POSITION)),
          pb.dot(this.global.light.lightParams[8], this.$query(ShaderLib.USAGE_WORLD_POSITION)),
          pb.dot(this.global.light.lightParams[9], this.$query(ShaderLib.USAGE_WORLD_POSITION)),
          pb.dot(this.global.light.lightParams[10], this.$query(ShaderLib.USAGE_WORLD_POSITION)),
        );
        this.$l.shadow = ctx.shadowMapper.computeShadow(this, this.shadowVertex, this.NdotL);
        this.$if(pb.greaterThan(this.NdotL, 0), function(){
          this.$l.attenuation = pb.min(pb.mul(this.lightcolor, this.NdotL), pb.vec3(this.shadow));
          illumLight(this, LightType.POINT, lm, this.surfaceData, this.positionRange, this.directionCutoff, this.lightDir, this.attenuation);
        });
      });
    }
    pb.globalScope[funcNameIllumPointShadowLight](surfaceData);
  }
  function illumCascadedShadowLight(lm: LightModel, surfaceData: PBShaderExp) {
    if (!pb.getFunction(funcNameIllumCascadedShadowLight)) {
      pb.globalScope.$function(funcNameIllumCascadedShadowLight, [pb.struct(surfaceData.getTypeName(), 'surfaceData')], function () {
        this.$l.shadowCascades = this.global.light.lightIndices[0].y;
        this.$l.positionRange = this.global.light.lightParams[0];
        this.$l.directionCutoff = this.global.light.lightParams[1];
        this.$l.diffuseIntensity = this.global.light.lightParams[2];
        this.$l.lightcolor = pb.mul(this.diffuseIntensity.xyz, this.diffuseIntensity.w);
        if (DEBUG_CASCADED_SHADOW_MAPS) {
          this.$l.shadowDebugColor = pb.vec3(1, 0, 1);
          this.$l.shadowDebugColors = pb.vec3[4]();
          this.$l.shadowDebugColors[0] = pb.vec3(1, 0, 0);
          this.$l.shadowDebugColors[1] = pb.vec3(0, 1, 0);
          this.$l.shadowDebugColors[2] = pb.vec3(0, 0, 1);
          this.$l.shadowDebugColors[3] = pb.vec3(1, 1, 0);
        }
        this.$l.lightDir = pb.vec3();
        this.lightDir = this.directionCutoff.xyz;
        this.$l.nl = pb.dot(this.surfaceData.normal, this.lightDir);
        this.$l.NdotL = pb.clamp(pb.neg(this.nl), 0, 1);
        this.shadowBound = pb.vec4(0, 0, 1, 1);
        this.linearDepth = lib.nonLinearDepthToLinear(this.$builtins.fragCoord.z);
        this.splitDistances = this.global.light.lightParams[3];
        this.comparison = pb.vec4(pb.greaterThan(pb.vec4(this.linearDepth), this.splitDistances));
        this.cascadeFlags = pb.vec4(
          pb.float(pb.greaterThan(this.shadowCascades, 0)),
          pb.float(pb.greaterThan(this.shadowCascades, 1)),
          pb.float(pb.greaterThan(this.shadowCascades, 2)),
          pb.float(pb.greaterThan(this.shadowCascades, 3)));
        this.split = pb.int(pb.dot(this.comparison, this.cascadeFlags));
        if (DEBUG_CASCADED_SHADOW_MAPS) {
          this.shadowDebugColor = this.shadowDebugColors.at(this.split);
        }
        this.shadowVertex = pb.vec4(
          pb.dot(this.global.light.lightParams.at(pb.add(pb.mul(this.split, 4), 7)), this.$query(ShaderLib.USAGE_WORLD_POSITION)),
          pb.dot(this.global.light.lightParams.at(pb.add(pb.mul(this.split, 4), 8)), this.$query(ShaderLib.USAGE_WORLD_POSITION)),
          pb.dot(this.global.light.lightParams.at(pb.add(pb.mul(this.split, 4), 9)), this.$query(ShaderLib.USAGE_WORLD_POSITION)),
          pb.dot(this.global.light.lightParams.at(pb.add(pb.mul(this.split, 4), 10)), this.$query(ShaderLib.USAGE_WORLD_POSITION)),
        );
        this.$l.shadow = ctx.shadowMapper.computeShadowCSM(this, this.shadowVertex, this.NdotL, this.split);
        this.$if(pb.greaterThan(this.NdotL, 0), function(){
          this.$l.attenuation = pb.min(pb.mul(this.lightcolor, this.NdotL), pb.vec3(this.shadow));
          if (DEBUG_CASCADED_SHADOW_MAPS) {
            this.attenuation = pb.mul(this.attenuation, this.shadowDebugColor);
          }
          illumLight(this, LightType.DIRECTIONAL, lm, this.surfaceData, this.positionRange, this.directionCutoff, this.lightDir, this.attenuation);
        });
      });
    }
    pb.globalScope[funcNameIllumCascadedShadowLight](surfaceData);
  }
  function illumUnshadowedLights(lm: LightModel, surfaceData: PBShaderExp) {
    if (!pb.getFunction(funcNameIllumUnshadowedLights)) {
      pb.globalScope.$function(funcNameIllumUnshadowedLights, [pb.struct(surfaceData.getTypeName(), 'surfaceData')], function () {
        this.$for(pb.int('l'), 0, this.global.light.numLights, function () {
          this.$l.lightIndex = this.global.light.lightIndices.at(this.l);
          this.$l.lightType = this.$l.lightIndex.x;
          this.$l.shadowCascades = this.$l.lightIndex.y;
          this.$l.positionRange = this.global.light.lightParams.at(pb.mul(this.l, 23));
          this.$l.directionCutoff = this.global.light.lightParams.at(pb.add(pb.mul(this.l, 23), 1));
          this.$l.diffuseIntensity = this.global.light.lightParams.at(pb.add(pb.mul(this.l, 23), 2));
          this.$l.lightcolor = pb.mul(this.diffuseIntensity.xyz, this.diffuseIntensity.w);
          this.$l.lightDir = pb.vec3();
          this.$l.nl = pb.float();
          this.$l.NdotL = pb.float();
          this.$if(pb.equal(this.lightType, LightType.DIRECTIONAL), function () {
            this.lightDir = this.directionCutoff.xyz;
            this.nl = pb.dot(this.surfaceData.normal, this.lightDir);
            this.NdotL = pb.clamp(pb.neg(this.nl), 0, 1);
          }).$else(function () {
            this.lightDir = pb.sub(pb.queryGlobal(ShaderLib.USAGE_WORLD_POSITION).xyz, this.positionRange.xyz);
            this.$if(pb.greaterThan(pb.length(this.lightDir), this.positionRange.w), function () {
              this.$continue();
            });
            this.lightDir = pb.normalize(this.lightDir);
            this.nl = pb.dot(this.surfaceData.normal, this.lightDir);
            this.NdotL = pb.clamp(pb.neg(this.nl), 0, 1);
          });
          this.$if(pb.greaterThan(this.NdotL, 0), function(){
            illumLight(this, this.lightType, lm, this.surfaceData, this.positionRange, this.directionCutoff, this.lightDir, pb.mul(this.lightcolor, this.NdotL));
          });
        });
      });
    }
    pb.globalScope[funcNameIllumUnshadowedLights](surfaceData);
  }
  if (!pb.getFunction(funcNameComputeLighting)) {
    pb.globalScope.$function(funcNameComputeLighting, [], function () {
      const worldPosition = pb.queryGlobal(ShaderLib.USAGE_WORLD_POSITION);
      if (!worldPosition) {
        throw new Error('ShaderLib.computeLightingWithBRDF(): query world position failed');
      }
      const worldNormal = pb.queryGlobal(ShaderLib.USAGE_WORLD_NORMAL);
      const worldTangent = pb.queryGlobal(ShaderLib.USAGE_WORLD_TANGENT);
      const worldBinormal = pb.queryGlobal(ShaderLib.USAGE_WORLD_BINORMAL);
      this.$l.surfaceData = lm.getSurfaceData(this, env, worldPosition, worldNormal, worldTangent, worldBinormal);
      if (env) {
        lm.envBRDF(env, this, this.surfaceData);
      }
      if (ctx.shadowMapper) {
        if (ctx.shadowMapper.numShadowCascades > 1) {
          illumCascadedShadowLight(lm, this.surfaceData);
        } else if (ctx.shadowMapper.shadowMap.isTextureCube()) {
          illumPointShadowLight(lm, this.surfaceData);
        } else {
          illumDirectionalShadowLight(ctx.shadowMapper.light.lightType, lm, this.surfaceData);
        }
      } else {
        illumUnshadowedLights(lm, this.surfaceData);
      }
      this.$l.result = lm.finalComposite(this, this.surfaceData);
      // this.$l.result = pb.add(this.lightDiffuse, this.lightSpecular);
      this.$return(pb.vec4(this.result, this.surfaceData.diffuse.a));
    });
  }
  return pb.globalScope[funcNameComputeLighting]();
}

export function forwardComputeLightingMultiPass(scope: PBInsideFunctionScope, lm: LightModel, ctx: DrawContext): PBShaderExp {
  const env = ctx.environment;
  const funcNameIllumPointLight = 'stdmat_illumPointLight';
  const funcNameIllumDirectionalLight = 'stdmat_illumDirectionalLight';
  const funcNameIllumSpotLight = 'stdmat_illumSpotLight';
  const funcNameIllumAllights = 'stdmat_illumAllLights';
  const funcNameComputeLighting = 'stdmat_computeLighting';
  const pb = scope.$builder;
  if (!scope || !(scope instanceof PBInsideFunctionScope)) {
    throw new Error('forwardComputeLighting() failed: forwardComputeLighting() must be called inside a function');
  }
  if (!lm.supportLighting()) {
    return lm.calculateAlbedo(scope);
  }
  const lib = new ShaderLib(pb);
  function illumPointLight(lm: LightModel, surfaceData: PBShaderExp, ...args: PBShaderExp[]) {
    if (!pb.getFunction(funcNameIllumPointLight)) {
      pb.globalScope.$function(funcNameIllumPointLight, [
        pb.struct(surfaceData.getTypeName(), 'surfaceData'),
        pb.vec4('lightPositionRange'),
        pb.vec4('lightDirectionCutoff'),
        pb.vec3('lightDir'),
        pb.vec3('attenuation')
      ], function () {
        this.$l.dist = pb.distance(this.lightPositionRange.xyz, pb.queryGlobal(ShaderLib.USAGE_WORLD_POSITION).xyz);
        this.$l.falloff = pb.max(0, pb.sub(1, pb.div(this.dist, this.lightPositionRange.w)));
        this.$l.falloff2 = pb.mul(this.falloff, this.falloff);
        this.$if(pb.greaterThan(this.falloff2, 0), function () {
          lm.directBRDF(this, this.surfaceData, this.lightDir, pb.mul(this.attenuation, this.falloff2));
        });
      });
    }
    pb.globalScope[funcNameIllumPointLight](surfaceData, ...args);
  }
  function illumDirectionalLight(lm: LightModel, surfaceData: PBShaderExp, ...args: PBShaderExp[]) {
    if (!pb.getFunction(funcNameIllumDirectionalLight)) {
      pb.globalScope.$function(funcNameIllumDirectionalLight, [
        pb.struct(surfaceData.getTypeName(), 'surfaceData'),
        pb.vec4('lightPositionRange'),
        pb.vec4('lightDirectionCutoff'),
        pb.vec3('lightDir'),
        pb.vec3('attenuation')
      ], function () {
        lm.directBRDF(this, this.surfaceData, this.lightDir, this.attenuation);
      });
    }
    pb.globalScope[funcNameIllumDirectionalLight](surfaceData, ...args);
  }
  function illumSpotLight(lm: LightModel, surfaceData: PBShaderExp, ...args: PBShaderExp[]) {
    if (!pb.getFunction(funcNameIllumSpotLight)) {
      pb.globalScope.$function(funcNameIllumSpotLight, [
        pb.struct(surfaceData.getTypeName(), 'surfaceData'),
        pb.vec4('lightPositionRange'),
        pb.vec4('lightDirectionCutoff'),
        pb.vec3('lightDir'),
        pb.vec3('attenuation')
      ], function () {
        this.$l.spotFactor = pb.dot(this.lightDir, this.lightDirectionCutoff.xyz);
        this.spotFactor = pb.smoothStep(this.lightDirectionCutoff.w, pb.mix(this.lightDirectionCutoff.w, 1, 0.5), this.spotFactor);
        illumPointLight(lm, this.surfaceData, this.lightPositionRange, this.lightDirectionCutoff, this.lightDir, pb.mul(this.attenuation, this.spotFactor));
      });
    }
    pb.globalScope[funcNameIllumSpotLight](surfaceData, ...args);
  }
  function illumLight(scope: PBInsideFunctionScope, lightType: LightType, lm: LightModel, surfaceData: PBShaderExp, ...args: PBShaderExp[]) {
    if (lightType === LightType.DIRECTIONAL) {
      illumDirectionalLight(lm, surfaceData, ...args);
    } else if (lightType === LightType.POINT) {
      illumPointLight(lm, surfaceData, ...args);
    } else {
      illumSpotLight(lm, surfaceData, ...args);
    }
  }
  function illumAllLights(lm: LightModel, surfaceData: PBShaderExp) {
    if (!pb.getFunction(funcNameIllumAllights)) {
      pb.globalScope.$function(funcNameIllumAllights, [pb.struct(surfaceData.getTypeName(), 'surfaceData')], function () {
        const lightType = (ctx.renderPass as ForwardMultiRenderPass).light.lightType;
        this.$l.positionRange = this.global.light.positionAndRange;
        this.$l.directionCutoff = this.global.light.directionAndCutoff;
        this.$l.diffuseIntensity = this.global.light.diffuseAndIntensity;
        this.$l.lightcolor = pb.mul(this.diffuseIntensity.xyz, this.diffuseIntensity.w);
        this.$l.lightDir = pb.vec3();
        this.$l.nl = pb.float();
        this.$l.NdotL = pb.float();
        if (lightType === LightType.DIRECTIONAL) {
          this.lightDir = this.directionCutoff.xyz;
          this.nl = pb.dot(this.surfaceData.normal, this.lightDir);
          this.NdotL = pb.clamp(pb.neg(this.nl), 0, 1);
        } else {
          this.lightDir = pb.sub(pb.queryGlobal(ShaderLib.USAGE_WORLD_POSITION).xyz, this.positionRange.xyz);
          this.lightDir = pb.normalize(this.lightDir);
          this.nl = pb.dot(this.surfaceData.normal, this.lightDir);
          this.NdotL = pb.clamp(pb.neg(this.nl), 0, 1);
        }
        this.$l.attenuation = pb.mul(this.lightcolor, this.NdotL);
        if (ctx.shadowMapper) {
          this.shadowBound = pb.vec4(0, 0, 1, 1);
          this.shadowVertex = pb.vec4();
          if (ctx.shadowMapper.numShadowCascades > 1) {
            this.linearDepth = lib.nonLinearDepthToLinear(this.$builtins.fragCoord.z);
            this.splitDistances = this.global.light.splitDistances;
            this.comparison = pb.vec4(pb.greaterThan(pb.vec4(this.linearDepth), this.splitDistances));
            this.cascadeFlags = pb.vec4(
              pb.float(pb.greaterThan(ctx.shadowMapper.numShadowCascades, 0)),
              pb.float(pb.greaterThan(ctx.shadowMapper.numShadowCascades, 1)),
              pb.float(pb.greaterThan(ctx.shadowMapper.numShadowCascades, 2)),
              pb.float(pb.greaterThan(ctx.shadowMapper.numShadowCascades, 3)));
            this.split = pb.int(pb.dot(this.comparison, this.cascadeFlags));
            this.$for(pb.int('cascade'), 0, 4, function () {
              this.$if(pb.equal(this.cascade, this.split), function () {
                this.shadowVertex = pb.vec4(
                  pb.dot(this.global.light.shadowMatrix.at(pb.mul(this.cascade, 4)), this.$query(ShaderLib.USAGE_WORLD_POSITION)),
                  pb.dot(this.global.light.shadowMatrix.at(pb.add(pb.mul(this.cascade, 4), 1)), this.$query(ShaderLib.USAGE_WORLD_POSITION)),
                  pb.dot(this.global.light.shadowMatrix.at(pb.add(pb.mul(this.cascade, 4), 2)), this.$query(ShaderLib.USAGE_WORLD_POSITION)),
                  pb.dot(this.global.light.shadowMatrix.at(pb.add(pb.mul(this.cascade, 4), 3)), this.$query(ShaderLib.USAGE_WORLD_POSITION)),
                );
                this.$break();
              });
            });
            this.$l.shadow = ctx.shadowMapper.computeShadowCSM(this, this.shadowVertex, this.NdotL, this.split);
          } else {
            this.shadowVertex = pb.vec4(
              pb.dot(this.global.light.shadowMatrix[0], this.$query(ShaderLib.USAGE_WORLD_POSITION)),
              pb.dot(this.global.light.shadowMatrix[1], this.$query(ShaderLib.USAGE_WORLD_POSITION)),
              pb.dot(this.global.light.shadowMatrix[2], this.$query(ShaderLib.USAGE_WORLD_POSITION)),
              pb.dot(this.global.light.shadowMatrix[3], this.$query(ShaderLib.USAGE_WORLD_POSITION)),
            );
            this.$l.shadow = ctx.shadowMapper.computeShadow(this, this.shadowVertex, this.NdotL);
          }
          this.attenuation = pb.min(this.attenuation, pb.vec3(this.shadow));
        }
        this.$if(pb.greaterThan(this.NdotL, 0), function () {
          illumLight(this, lightType, lm, this.surfaceData, this.positionRange, this.directionCutoff, this.lightDir, this.attenuation);
        });
      });
    }
    pb.globalScope[funcNameIllumAllights](surfaceData);
  }
  if (!pb.getFunction(funcNameComputeLighting)) {
    pb.globalScope.$function(funcNameComputeLighting, [], function () {
      const worldPosition = pb.queryGlobal(ShaderLib.USAGE_WORLD_POSITION);
      if (!worldPosition) {
        throw new Error('ShaderLib.computeLightingWithBRDF(): query world position failed');
      }
      const worldNormal = pb.queryGlobal(ShaderLib.USAGE_WORLD_NORMAL);
      const worldTangent = pb.queryGlobal(ShaderLib.USAGE_WORLD_TANGENT);
      const worldBinormal = pb.queryGlobal(ShaderLib.USAGE_WORLD_BINORMAL);
      this.$l.surfaceData = lm.getSurfaceData(this, env, worldPosition, worldNormal, worldTangent, worldBinormal);
      illumAllLights(lm, this.surfaceData);
      if (env) {
        lm.envBRDF(env, this, this.surfaceData);
      }
      this.$l.result = lm.finalComposite(this, this.surfaceData);
      // this.$l.result = pb.add(this.lightDiffuse, this.lightSpecular);
      this.$return(pb.vec4(this.result, this.surfaceData.diffuse.a));
    });
  }
  return pb.globalScope[funcNameComputeLighting]();
}
