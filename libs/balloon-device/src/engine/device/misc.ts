import type { GPUObject } from "./gpuobject";

/** @internal */
export function genDefaultName(obj: GPUObject) {
  if (obj.isTexture2D()) {
    return 'texture_2d';
  } else if (obj.isTexture2DArray()) {
    return 'texture_2darray';
  } else if (obj.isTexture3D()) {
    return 'texture_3d';
  } else if (obj.isTextureCube()) {
    return 'texture_cube';
  } else if (obj.isTextureVideo()) {
    return 'texture_video';
  } else if (obj.isBuffer()) {
    return 'buffer';
  } else if (obj.isFramebuffer()) {
    return 'framebuffer';
  } else if (obj.isProgram()) {
    return 'program';
  } else if (obj.isSampler()) {
    return 'sampler';
  } else if (obj.isVAO()) {
    return 'vbo';
  } else {
    return 'unknown';
  }
}
