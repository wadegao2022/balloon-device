import { BaseTexture, GPUResourceUsageFlags } from '../../../../device';
import { AbstractTextureLoader } from '../loader';
import type { AssetManager } from '../../assetmanager';

export class WebImageLoader extends AbstractTextureLoader {
  supportExtension(ext: string): boolean {
    return ext === '.jpg' || ext === '.jpeg' || ext === '.png';
  }
  supportMIMEType(mimeType: string): boolean {
    return mimeType === 'image/jpg' || mimeType === 'image/jpeg' || mimeType === 'image/png';
  }
  async load(assetManager: AssetManager, filename: string, mimeType: string, data: ArrayBuffer, srgb: boolean, noMipmap: boolean, texture?: BaseTexture): Promise<BaseTexture> {
    return new Promise<BaseTexture>((resolve, reject) => {
      if (!mimeType) {
        reject('unknown image file type');
      }
      const src = URL.createObjectURL(new Blob([data], { type: mimeType }));
      const img = document.createElement('img');
      img.src = src;

      img.onload = () => {
        createImageBitmap(img, {
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'none',
        }).then(bm => {
          const colorSpaceFlag = srgb ? 0 : GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE;
          const mipmapFlag = noMipmap ? GPUResourceUsageFlags.TF_NO_MIPMAP : 0;
          const creationFlags = colorSpaceFlag | mipmapFlag;
          if (texture) {
            if (!texture.isTexture2D()) {
              throw new Error('can not reload texture: invalid texture type');
            }
            texture.loadFromElement(bm, creationFlags);
            resolve(texture);
          } else {
            const tex = assetManager.device.createTexture2DFromImage(bm, creationFlags);
            if (tex) {
              resolve(tex);
            } else {
              reject('create texture from image element failed');
            }
          }
        });
      };
      img.onerror = err => {
        reject(err);
      };
    });
  }
}

