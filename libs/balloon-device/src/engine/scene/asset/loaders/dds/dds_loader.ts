import { BaseTexture, GPUResourceUsageFlags } from '../../../../device';
import { getDDSMipLevelsInfo } from './dds';
import { AbstractTextureLoader } from '../loader';
import type { AssetManager } from '../../assetmanager';

export class DDSLoader extends AbstractTextureLoader {
  supportExtension(ext: string): boolean {
    return ext === '.dds';
  }
  supportMIMEType(mimeType: string): boolean {
    return mimeType === 'image/dds';
  }
  async load(assetManager: AssetManager, url: string, mimeType: string, data: ArrayBuffer, srgb: boolean, noMipmap: boolean, texture?: BaseTexture): Promise<BaseTexture> {
    const arrayBuffer = data;
    const mipmapLevelData = getDDSMipLevelsInfo(arrayBuffer);
    if (!mipmapLevelData) {
      throw new Error(`read DDS file failed: ${url}`);
    }
    const colorSpaceFlag = srgb ? 0 : GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE;
    const mipmapFlag = noMipmap ? GPUResourceUsageFlags.TF_NO_MIPMAP : 0;
    const creationFlags = colorSpaceFlag | mipmapFlag;
    if (mipmapLevelData.isCubemap) {
      if (texture) {
        if (!texture.isTextureCube()) {
          throw new Error('can not reload texture: invalid texture type');
        }
        texture.createWithMipmapData(mipmapLevelData, creationFlags);
        return texture;
      } else {
        return assetManager.device.createCubeTextureFromMipmapData(mipmapLevelData, creationFlags);
      }
    } else if (mipmapLevelData.isVolume) {
      throw new Error(`load DDS volume texture is not supported`);
    } else {
      if (texture) {
        if (!texture.isTexture2D()) {
          throw new Error('can not reload texture: invalid texture type');
        }
        texture.createWithMipmapData(mipmapLevelData, creationFlags);
        return texture;
      } else {
        return assetManager.device.createTexture2DFromMipmapData(mipmapLevelData, creationFlags);
      }
    }
  }
}

