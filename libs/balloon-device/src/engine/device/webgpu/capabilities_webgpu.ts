import { TextureFormat } from '../base_types';
import type { FramebufferCaps, ITextureFormatInfo, MiscCaps, ShaderCaps, TextureCaps } from '../device';
import type { WebGPUDevice } from './device';

export interface ITextureParams {
  gpuFormat: GPUTextureFormat;
  stride: number;
  filterable: boolean;
  renderable: boolean;
  repeatable: boolean;
  compressed: boolean;
  writable: boolean;
  generateMipmap: boolean;
}

export interface ITextureFormatInfoWebGPU extends ITextureFormatInfo {
  gpuSampleType: GPUTextureSampleType;
  filterable: boolean;
  renderable: boolean;
  compressed: boolean;
  writable: boolean;
  size: number;
  blockWidth?: number;
  blockHeight?: number;
}

export class WebGPUFramebufferCap implements FramebufferCaps {
  maxDrawBuffers: number;
  supportDrawBuffers: boolean;
  supportRenderMipmap: boolean;
  constructor(device: WebGPUDevice) {
    this.maxDrawBuffers = 8;
    this.supportDrawBuffers = true;
    this.supportRenderMipmap = true;
  }
}

export class WebGPUMiscCap implements MiscCaps {
  supportBlendMinMax: boolean;
  support32BitIndex: boolean;
  supportLoseContext: boolean;
  supportDebugRendererInfo: boolean;
  supportSharedUniforms: boolean;
  constructor(device: WebGPUDevice) {
    this.supportBlendMinMax = true;
    this.support32BitIndex = true;
    // TODO:
    this.supportLoseContext = false;
    this.supportDebugRendererInfo = false;
    this.supportSharedUniforms = true;
  }
}
export class WebGPUShaderCap implements ShaderCaps {
  supportFragmentDepth: boolean;
  supportStandardDerivatives: boolean;
  supportShaderTextureLod: boolean;
  supportHighPrecisionFloat: boolean;
  supportHighPrecisionInt: boolean;
  maxUniformBufferSize: number;
  uniformBufferOffsetAlignment: number;
  constructor(device: WebGPUDevice) {
    this.supportFragmentDepth = true;
    this.supportStandardDerivatives = true;
    this.supportShaderTextureLod = true;
    this.supportHighPrecisionFloat = true;
    this.maxUniformBufferSize = device.device.limits.maxUniformBufferBindingSize || 65536;
    this.uniformBufferOffsetAlignment = device.device.limits.minUniformBufferOffsetAlignment || 256;
  }
}
export class WebGPUTextureCap implements TextureCaps {
  private _textureFormatInfos: { [format: number]: ITextureFormatInfoWebGPU };
  maxTextureSize: number;
  maxCubeTextureSize: number;
  npo2Mipmapping: boolean;
  npo2Repeating: boolean;
  supportS3TC: boolean;
  supportS3TCSRGB: boolean;
  supportDepthTexture: boolean;
  support3DTexture: boolean;
  supportSRGBTexture: boolean;
  supportFloatTexture: boolean;
  supportLinearFloatTexture: boolean;
  supportHalfFloatTexture: boolean;
  supportLinearHalfFloatTexture: boolean;
  supportAnisotropicFiltering: boolean;
  supportFloatColorBuffer: boolean;
  supportHalfFloatColorBuffer: boolean;
  supportFloatBlending: boolean;
  constructor(device: WebGPUDevice) {
    this._textureFormatInfos = {
      [TextureFormat.RGBA8UNORM]: {
        gpuSampleType: 'float',
        filterable: true,
        renderable: true,
        compressed: false,
        writable: true,
        size: 4,
      },
      [TextureFormat.RGBA8SNORM]: {
        gpuSampleType: 'float',
        filterable: true,
        renderable: false,
        compressed: false,
        writable: true,
        size: 4,
      },
      [TextureFormat.BGRA8UNORM]: {
        gpuSampleType: 'float',
        filterable: true,
        renderable: true,
        compressed: false,
        writable: false, // TODO: require "bgra8unorm-storage" feature
        size: 4,
      },
    };
    if (this.supportS3TC) {
      this._textureFormatInfos[TextureFormat.DXT1] = {
        gpuSampleType: 'float',
        filterable: true,
        renderable: false,
        compressed: true,
        size: 8,
        writable: false,
        blockWidth: 4,
        blockHeight: 4,
      };
      this._textureFormatInfos[TextureFormat.DXT3] = {
        gpuSampleType: 'float',
        filterable: true,
        renderable: false,
        compressed: true,
        size: 16,
        writable: false,
        blockWidth: 4,
        blockHeight: 4,
      };
      this._textureFormatInfos[TextureFormat.DXT5] = {
        gpuSampleType: 'float',
        filterable: true,
        renderable: false,
        compressed: true,
        size: 16,
        writable: false,
        blockWidth: 4,
        blockHeight: 4,
      };
    }
    if (this.supportS3TCSRGB) {
      this._textureFormatInfos[TextureFormat.DXT1_SRGB] = {
        gpuSampleType: 'float',
        filterable: true,
        renderable: false,
        compressed: true,
        size: 8,
        writable: false,
        blockWidth: 4,
        blockHeight: 4,
      };
      this._textureFormatInfos[TextureFormat.DXT3_SRGB] = {
        gpuSampleType: 'float',
        filterable: true,
        renderable: false,
        compressed: true,
        size: 16,
        writable: false,
        blockWidth: 4,
        blockHeight: 4,
      };
      this._textureFormatInfos[TextureFormat.DXT5_SRGB] = {
        gpuSampleType: 'float',
        filterable: true,
        renderable: false,
        compressed: true,
        size: 16,
        writable: false,
        blockWidth: 4,
        blockHeight: 4,
      };
    }
    this._textureFormatInfos[TextureFormat.R8UNORM] = {
      gpuSampleType: 'float',
      filterable: true,
      renderable: true,
      compressed: false,
      writable: false,
      size: 1,
    };
    this._textureFormatInfos[TextureFormat.R8SNORM] = {
      gpuSampleType: 'float',
      filterable: true,
      renderable: false,
      compressed: false,
      writable: false,
      size: 1,
    },
      this._textureFormatInfos[TextureFormat.R16F] = {
        gpuSampleType: 'float',
        filterable: true,
        renderable: true,
        compressed: false,
        writable: false,
        size: 2,
      };
    this._textureFormatInfos[TextureFormat.R32F] = {
      gpuSampleType: 'unfilterable-float',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: true,
      size: 4,
    };
    this._textureFormatInfos[TextureFormat.R8UI] = {
      gpuSampleType: 'uint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: false,
      size: 1,
    };
    this._textureFormatInfos[TextureFormat.R8I] = {
      gpuSampleType: 'sint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: false,
      size: 1,
    };
    this._textureFormatInfos[TextureFormat.R16UI] = {
      gpuSampleType: 'uint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: false,
      size: 2,
    };
    this._textureFormatInfos[TextureFormat.R16I] = {
      gpuSampleType: 'sint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: false,
      size: 2,
    };
    this._textureFormatInfos[TextureFormat.R32UI] = {
      gpuSampleType: 'uint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: true,
      size: 4,
    };
    this._textureFormatInfos[TextureFormat.R32I] = {
      gpuSampleType: 'sint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: true,
      size: 4,
    };
    this._textureFormatInfos[TextureFormat.RG8UNORM] = {
      gpuSampleType: 'float',
      filterable: true,
      renderable: true,
      compressed: false,
      writable: false,
      size: 2,
    };
    this._textureFormatInfos[TextureFormat.RG8SNORM] = {
      gpuSampleType: 'float',
      filterable: true,
      renderable: false,
      compressed: false,
      writable: false,
      size: 2,
    };
    this._textureFormatInfos[TextureFormat.RG16F] = {
      gpuSampleType: 'float',
      filterable: true,
      renderable: true,
      compressed: false,
      writable: false,
      size: 4,
    };
    this._textureFormatInfos[TextureFormat.RG32F] = {
      gpuSampleType: 'unfilterable-float',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: true,
      size: 8,
    };
    this._textureFormatInfos[TextureFormat.RG8UI] = {
      gpuSampleType: 'uint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: false,
      size: 2,
    };
    this._textureFormatInfos[TextureFormat.RG8I] = {
      gpuSampleType: 'sint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: false,
      size: 2,
    };
    this._textureFormatInfos[TextureFormat.RG16UI] = {
      gpuSampleType: 'uint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: false,
      size: 4,
    };
    this._textureFormatInfos[TextureFormat.RG16I] = {
      gpuSampleType: 'sint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: false,
      size: 4,
    };
    this._textureFormatInfos[TextureFormat.RG32UI] = {
      gpuSampleType: 'uint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: true,
      size: 8,
    };
    this._textureFormatInfos[TextureFormat.RG32I] = {
      gpuSampleType: 'sint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: true,
      size: 8,
    };
    this._textureFormatInfos[TextureFormat.RGBA8UNORM_SRGB] = {
      gpuSampleType: 'float',
      filterable: true,
      renderable: true,
      compressed: false,
      writable: false,
      size: 4,
    };
    this._textureFormatInfos[TextureFormat.BGRA8UNORM_SRGB] = {
      gpuSampleType: 'float',
      filterable: true,
      renderable: true,
      compressed: false,
      writable: false,
      size: 4,
    };
    this._textureFormatInfos[TextureFormat.RGBA16F] = {
      gpuSampleType: 'float',
      filterable: true,
      renderable: true,
      compressed: false,
      writable: true,
      size: 8,
    };
    this._textureFormatInfos[TextureFormat.RGBA32F] = {
      gpuSampleType: 'unfilterable-float',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: true,
      size: 16,
    };
    this._textureFormatInfos[TextureFormat.RGBA8UI] = {
      gpuSampleType: 'uint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: true,
      size: 4,
    };
    this._textureFormatInfos[TextureFormat.RGBA8I] = {
      gpuSampleType: 'sint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: true,
      size: 4,
    };
    this._textureFormatInfos[TextureFormat.RGBA16UI] = {
      gpuSampleType: 'uint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: true,
      size: 8,
    };
    this._textureFormatInfos[TextureFormat.RGBA16I] = {
      gpuSampleType: 'sint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: true,
      size: 8,
    };
    this._textureFormatInfos[TextureFormat.RGBA32UI] = {
      gpuSampleType: 'uint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: true,
      size: 16,
    };
    this._textureFormatInfos[TextureFormat.RGBA32I] = {
      gpuSampleType: 'sint',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: true,
      size: 16,
    };
    this._textureFormatInfos[TextureFormat.D16] = {
      gpuSampleType: 'depth',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: false,
      size: 2,
    };
    this._textureFormatInfos[TextureFormat.D24] = {
      gpuSampleType: 'depth',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: false,
      size: 4,
    };
    this._textureFormatInfos[TextureFormat.D32F] = {
      gpuSampleType: 'depth',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: false,
      size: 4,
    };
    this._textureFormatInfos[TextureFormat.D32FS8] = {
      gpuSampleType: 'depth',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: false,
      size: 8,
    }
    this._textureFormatInfos[TextureFormat.D24S8] = {
      gpuSampleType: 'depth',
      filterable: false,
      renderable: true,
      compressed: false,
      writable: false,
      size: 4,
    };
    this.supportAnisotropicFiltering = true;
    this.supportDepthTexture = true;
    this.support3DTexture = true;
    this.supportSRGBTexture = true;
    this.supportFloatTexture = true;
    this.supportLinearFloatTexture = this._textureFormatInfos[TextureFormat.R32F].filterable && this._textureFormatInfos[TextureFormat.RG32F].filterable && this._textureFormatInfos[TextureFormat.RGBA32F].filterable;
    this.supportHalfFloatTexture = true;
    this.supportLinearHalfFloatTexture = this._textureFormatInfos[TextureFormat.R16F].filterable && this._textureFormatInfos[TextureFormat.RG16F].filterable && this._textureFormatInfos[TextureFormat.RGBA16F].filterable;
    this.supportFloatColorBuffer = true;
    this.supportHalfFloatColorBuffer = true;
    this.supportFloatBlending = true;
    this.supportS3TC = device.device.features.has('texture-compression-bc');
    this.supportS3TCSRGB = this.supportS3TC;

    this.maxTextureSize = device.device.limits.maxTextureDimension2D;
    this.maxCubeTextureSize = device.device.limits.maxTextureDimension2D;
    this.npo2Mipmapping = true;
    this.npo2Repeating = true;
  }
  calcMemoryUsage(format: TextureFormat, numPixels): number {
    return this._textureFormatInfos[format] ? this._textureFormatInfos[format].size * numPixels : 0;
  }
  getTextureFormatInfo(format: TextureFormat): ITextureFormatInfoWebGPU {
    return this._textureFormatInfos[format];
  }
}
