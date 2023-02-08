import type { BaseTexture } from "../../../device";
import type { AssetManager } from "../assetmanager";
import type { SharedModel } from "../model";

export class LoaderBase {
  protected _urlResolver: (url: string) => string;
  constructor() {
    this._urlResolver = null;
  }
  get urlResolver(): (url: string) => string {
    return this._urlResolver;
  }
  set urlResolver(resolver: (url: string) => string) {
    this._urlResolver = resolver;
  }
  async request(url: string, headers: Record<string, string> = {}, crossOrigin = 'anonymous'): Promise<Response> {
    url = this._urlResolver ? this._urlResolver(url) : null;
    return url ? fetch(url, {
      credentials: crossOrigin === 'anonymous' ? 'same-origin' : 'include',
      headers: headers
    }) : null;
  }
}
export abstract class AbstractTextureLoader extends LoaderBase {
  abstract supportExtension(ext: string): boolean;
  abstract supportMIMEType(mimeType: string): boolean;
  abstract load(assetManager: AssetManager, url: string, mimeType: string, data: ArrayBuffer, srgb: boolean, noMipmap: boolean, texture?: BaseTexture): Promise<BaseTexture>;
}

export abstract class AbstractModelLoader extends LoaderBase {
  abstract supportExtension(ext: string): boolean;
  abstract supportMIMEType(mimeType: string): boolean;
  abstract load(assetManager: AssetManager, url: string, mimeType: string, data: Blob): Promise<SharedModel>;
}

