import { MaxRectsPacker } from './maxrects-packer';
import type { BaseTexture, Texture2D } from '../engine/device';
import type { GUIRenderer } from './renderer';

export interface IAtlasInfo {
  atlasIndex: number;
  width: number;
  height: number;
  uMin: number;
  vMin: number;
  uMax: number;
  vMax: number;
}

export class AtlasManager {
  /** @internal */
  protected static readonly ATLAS_WIDTH = 1024;
  /** @internal */
  protected static readonly ATLAS_HEIGHT = 1024;
  /** @internal */
  protected _renderer: GUIRenderer;
  /** @internal */
  protected _packer: MaxRectsPacker;
  /** @internal */
  protected _cachePadding: number;
  /** @internal */
  protected _cacheWidth: number;
  /** @internal */
  protected _cacheHeight: number;
  /** @internal */
  protected _linearSpace: boolean;
  /** @internal */
  protected _atlasList: Texture2D[];
  /** @internal */
  protected _atlasInfoMap: { [hash: string]: IAtlasInfo };
  /** @internal */
  protected _atlasRestoreHandler: (tex: BaseTexture) => Promise<void>;
  constructor(
    renderer: GUIRenderer,
    cacheWidth?: number,
    cacheHeight?: number,
    cachePadding?: number,
    linearSpace?: boolean,
  ) {
    this._renderer = renderer;
    this._cacheWidth =
      typeof cacheWidth === 'number'
        ? cacheWidth || AtlasManager.ATLAS_WIDTH
        : AtlasManager.ATLAS_WIDTH;
    this._cacheHeight =
      typeof cacheHeight === 'number'
        ? cacheHeight || AtlasManager.ATLAS_HEIGHT
        : AtlasManager.ATLAS_HEIGHT;
    this._cachePadding = typeof cachePadding === 'number' ? cachePadding : 0;
    this._linearSpace = Boolean(linearSpace);
    this._packer = new MaxRectsPacker(this._cacheWidth, this._cacheHeight, this._cachePadding, {
      smart: true,
      pot: false,
      square: false,
      allowRotation: false,
      border: 1,
      tag: false,
    });
    this._atlasList = [];
    this._atlasInfoMap = {};
    this._atlasRestoreHandler = null;
  }
  get atlasTextureRestoreHandler(): (tex: BaseTexture) => Promise<void> {
    return this._atlasRestoreHandler;
  }
  set atlasTextureRestoreHandler(f: (tex: BaseTexture) => Promise<void>) {
    this._atlasRestoreHandler = f;
  }
  getAtlasTexture(index: number): Texture2D {
    return this._atlasList[index];
  }
  getAtlasInfo(key: string): IAtlasInfo {
    return this._atlasInfoMap[key] || null;
  }
  isEmpty(): boolean {
    return this._atlasList.length === 0;
  }
  clear() {
    this._packer = new MaxRectsPacker(this._cacheWidth, this._cacheHeight, this._cachePadding, {
      smart: true,
      pot: false,
      square: false,
      allowRotation: false,
      border: 1,
      tag: false,
    });
    for (const tex of this._atlasList) {
      this._renderer.disposeTexture(tex);
    }
    this._atlasList = [];
    this._atlasInfoMap = {};
  }
  pushCanvas(
    key: string,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    /*
    const imgdata = ctx.getImageData(x, y, w, h);
    return this.pushBitmap(key, imgdata);
    */
    const rc = this._packer.add(w, h, null);
    if (rc) {
      this._updateAtlasTextureCanvas(
        this._packer.bins.length - 1,
        ctx,
        rc.x,
        rc.y,
        rc.width,
        rc.height,
        x,
        y,
      );
      const info: IAtlasInfo = {
        atlasIndex: this._packer.bins.length - 1,
        uMin: rc.x / (this._cacheWidth + this._cachePadding),
        vMin: rc.y / (this._cacheHeight + this._cachePadding),
        uMax: (rc.x + rc.width) / (this._cacheWidth + this._cachePadding),
        vMax: (rc.y + rc.height) / (this._cacheHeight + this._cachePadding),
        width: rc.width,
        height: rc.height,
      };
      this._atlasInfoMap[key] = info;
      return info;
    }
  }
  pushBitmap(key: string, bitmap: ImageData): IAtlasInfo {
    const rc = this._packer.add(bitmap.width, bitmap.height, null);
    if (rc) {
      this._updateAtlasTexture(
        this._packer.bins.length - 1,
        bitmap,
        rc.x,
        rc.y,
      );
      const info: IAtlasInfo = {
        atlasIndex: this._packer.bins.length - 1,
        uMin: rc.x / (this._cacheWidth + this._cachePadding),
        vMin: rc.y / (this._cacheHeight + this._cachePadding),
        uMax: (rc.x + rc.width) / (this._cacheWidth + this._cachePadding),
        vMax: (rc.y + rc.height) / (this._cacheHeight + this._cachePadding),
        width: rc.width,
        height: rc.height,
      };
      this._atlasInfoMap[key] = info;
      return info;
    }
    return null;
  }
  /** @internal */
  protected _createAtlasTexture(): Texture2D {
    const zeroColor = { r: 0, g: 0, b: 0, a: 0 };
    const tex = this._renderer.createTexture(this._cacheWidth + this._cachePadding, this._cacheHeight + this._cachePadding, zeroColor, this._linearSpace);
    tex.restoreHandler = async tex => {
      this._renderer.clearTexture(tex as Texture2D, zeroColor);
      this._atlasRestoreHandler && await this._atlasRestoreHandler(tex as BaseTexture);
    };
    return tex;
  }
  /** @internal */
  private _updateAtlasTextureCanvas(
    atlasIndex: number,
    bitmap: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    xOffset: number,
    yOffset: number,
  ) {
    let textureAtlas: Texture2D = null;
    if (atlasIndex === this._atlasList.length) {
      textureAtlas = this._createAtlasTexture();
      this._atlasList.push(textureAtlas);
    } else {
      textureAtlas = this._atlasList[atlasIndex];
    }
    this._renderer.updateTextureWithCanvas(textureAtlas, bitmap, xOffset, yOffset, w, h, x, y);
  }
  /** @internal */
  private _updateAtlasTexture(
    atlasIndex: number,
    bitmap: ImageData,
    x: number,
    y: number,
  ) {
    let textureAtlas: Texture2D = null;
    if (atlasIndex === this._atlasList.length) {
      textureAtlas = this._createAtlasTexture();
      this._atlasList.push(textureAtlas);
    } else {
      textureAtlas = this._atlasList[atlasIndex];
    }
    this._renderer.updateTextureWithImage(textureAtlas, bitmap, x, y);
  }
}
