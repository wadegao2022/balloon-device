export const vert = `
struct ch_generated_struct_name0 {
  position: vec3<f32>,
  viewProjectionMatrix: mat4x4<f32>,
  viewMatrix: mat4x4<f32>,
  projectionMatrix: mat4x4<f32>,
  params: vec4<f32>
};
struct ch_generated_struct_name1 {
  numLights: i32,
  lightIndices: array<vec4<i32>, 9>,
  lightParams: array<vec4<f32>, 184>,
  envLightStrength: f32
};
struct ch_generated_struct_name2 {
  camera: ch_generated_struct_name0,
  light: ch_generated_struct_name1
};
struct ch_generated_struct_name3 {
  matrices: array<mat4x4<f32>, 1024>
};
struct ch_VertexInput {
  @builtin(instance_index) ch_builtin_instanceIndex: u32,
  @location(0) ch_input_pos: vec3<f32>,
  @location(1) ch_input_normal: vec3<f32>
};
struct ch_VertexOutput {
  @builtin(position) ch_builtin_position: vec4<f32>,
  @location(0) ch_output_worldPosition: vec4<f32>,
  @location(1) ch_output_worldNormal: vec3<f32>
};
struct ch_generated_struct_name6 {
  instanceBufferOffset: u32
};
@group(0) @binding(0) var<uniform> global: ch_generated_struct_name2;
@group(3) @binding(0) var<uniform> worldMatrix: ch_generated_struct_name3;
@group(1) @binding(0) var<uniform> ch_shared_block_1: ch_generated_struct_name6;
var<private> ch_VertexInputCpy: ch_VertexInput;
var<private> ch_VertexOutputCpy: ch_VertexOutput;
fn lib_objPosToWorld(pos: vec3<f32>) -> vec4<f32> {
  return worldMatrix.matrices[ch_shared_block_1.instanceBufferOffset + u32(ch_VertexInputCpy.ch_builtin_instanceIndex)] * vec4<f32>(pos,1.0);
}
fn lib_objVecToWorld(v: vec3<f32>) -> vec3<f32> {
  return (worldMatrix.matrices[ch_shared_block_1.instanceBufferOffset + u32(ch_VertexInputCpy.ch_builtin_instanceIndex)] * vec4<f32>(v,0.0)).xyz;
}
fn lib_ftransform(inputPos: vec3<f32>) -> vec4<f32> {
  var pos: vec4<f32> = global.camera.viewProjectionMatrix * lib_objPosToWorld(inputPos);
  if (global.camera.params.z != 0.0) {
    pos.y = -pos.y;
  }
  return pos;
}
fn chMainStub() {
  let pos: vec3<f32> = ch_VertexInputCpy.ch_input_pos;
  let norm: vec3<f32> = ch_VertexInputCpy.ch_input_normal;
  ch_VertexOutputCpy.ch_output_worldPosition = lib_objPosToWorld(pos);
  ch_VertexOutputCpy.ch_output_worldNormal = normalize(lib_objVecToWorld(norm));
  ch_VertexOutputCpy.ch_builtin_position = lib_ftransform(pos.xyz);
}
@vertex fn main(ch_app_input: ch_VertexInput) -> ch_VertexOutput {
  ch_VertexInputCpy = ch_app_input;
  chMainStub();
  ch_VertexOutputCpy.ch_builtin_position.z = (ch_VertexOutputCpy.ch_builtin_position.z + ch_VertexOutputCpy.ch_builtin_position.w) * 0.5;
  return ch_VertexOutputCpy;
}`;

export const frag = `
struct ch_generated_struct_name0 {
  position: vec3<f32>,
  viewProjectionMatrix: mat4x4<f32>,
  viewMatrix: mat4x4<f32>,
  projectionMatrix: mat4x4<f32>,
  params: vec4<f32>
};
struct ch_generated_struct_name1 {
  numLights: i32,
  lightIndices: array<vec4<i32>, 9>,
  lightParams: array<vec4<f32>, 184>,
  envLightStrength: f32
};
struct ch_generated_struct_name2 {
  camera: ch_generated_struct_name0,
  light: ch_generated_struct_name1
};
struct ch_generated_struct_name3 {
  matrices: array<mat4x4<f32>, 1024>
};
struct ch_FragInput {
  @builtin(front_facing) ch_builtin_frontFacing: bool,
  @location(0) ch_output_worldPosition: vec4<f32>,
  @location(1) ch_output_worldNormal: vec3<f32>
};
struct ch_FragOutput {
  @location(0) ch_output_outColor: vec4<f32>
};
struct ch_generated_struct_name4 {
  f0: vec3<f32>,
  metallic: f32,
  roughness: f32
};
struct ch_generated_struct_name5 {
  lm_albedo: vec4<f32>,
  lm_pbrF0: f32,
  lm_pbrMetallic: f32,
  lm_pbrRoughness: f32
};
struct ch_generated_struct_name6 {
  instanceBufferOffset: u32
};
@group(0) @binding(0) var<uniform> global: ch_generated_struct_name2;
@group(0) @binding(2) var ch_auto_sampler_shadowMap: sampler;
@group(0) @binding(3) var ch_auto_sampler_shadowMap_comparison: sampler_comparison;
@group(0) @binding(1) var shadowMap: texture_depth_2d;
@group(3) @binding(0) var<uniform> worldMatrix: ch_generated_struct_name3;
@group(2) @binding(0) var<uniform> ch_fragment_block_2: ch_generated_struct_name5;
@group(1) @binding(0) var<uniform> ch_shared_block_1: ch_generated_struct_name6;
var<private> ch_FragInputCpy: ch_FragInput;
var<private> ch_FragOutputCpy: ch_FragOutput;

fn lib_sampleShadowMap(coords: vec4<f32>,z: f32) -> f32 {
  return dpdx(coords).x;
}
fn lib_computeShadow(NdotL: f32) -> f32 {
  var worldPos = ch_FragInputCpy.ch_output_worldPosition;
  let shadowVertex: vec4<f32> = vec4<f32>(dot(global.light.lightParams[7],worldPos),dot(global.light.lightParams[8],worldPos),dot(global.light.lightParams[9],worldPos),dot(global.light.lightParams[10],worldPos));
  var shadowCoord: vec4<f32> = shadowVertex / shadowVertex.w;
  shadowCoord = (shadowCoord * 0.5) + 0.5;
  var shadow: f32 = f32(1.0);
  return lib_sampleShadowMap(shadowCoord,shadowCoord.z);
}
@fragment fn main(ch_app_input: ch_FragInput) -> ch_FragOutput {
  ch_FragInputCpy = ch_app_input;
  var shadow: f32 = lib_computeShadow(1.0);
  ch_FragOutputCpy.ch_output_outColor = vec4<f32>(shadow);
  return ch_FragOutputCpy;
}`;
