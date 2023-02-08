export const RENDER_PASS_TYPE_UNKNOWN = 0;
export const RENDER_PASS_TYPE_FORWARD = 1;
export const RENDER_PASS_TYPE_MULTI_FORWARD = 2;
export const RENDER_PASS_TYPE_SHADOWMAP = 3;
export const RENDER_PASS_TYPE_DEPTH_ONLY = 4;

// user defined render pass types
export const RENDER_PASS_TYPE_USER = 100;

// material function interfaces
export const MATERIAL_FUNC_NORMAL = 0;
export const MATERIAL_FUNC_DEPTH_ONLY = 1;
export const MATERIAL_FUNC_DEPTH_SHADOW = 2;

// max light count for forward rendering
export const MAX_FORWARD_LIGHT_COUNT = 8;

// debug csm
export const DEBUG_CASCADED_SHADOW_MAPS = false;

// use linear depth for shadow
export const LINEAR_DEPTH_SHADOWMAP = true;

// hard shadow
export const SHADOW_TECH_HARD_SHADOW = 1;
// hard ESM shadow
export const SHADOW_TECH_HARD_ESM_SHADOW = 2;
// soft ESM shadow
export const SHADOW_TECH_SOFT_ESM_SHADOW = 3;

// use texture array or texture atlas for CSM
export const USE_TEXTURE_ARRAY_FOR_CSM = true;

// ESM depth scale
export const ESM_DEPTH_SCALE = 50;

// current shadow tech
// eslint-disable-next-line prefer-const
export let SHADOW_TECHNIQUE = SHADOW_TECH_HARD_ESM_SHADOW;
