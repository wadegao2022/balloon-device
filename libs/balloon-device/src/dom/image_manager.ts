import { TextureAtlas } from './texture_atlas';
import { AtlasManager, IAtlasInfo } from './atlas_manager';
import type { GUIRenderer } from './renderer';

export class ImageManager {
  /** @internal */
  protected _renderer: GUIRenderer;
  /** @internal */
  protected _atlasManager: AtlasManager;
  /** @internal */
  protected _cachedImages: { [name: string]: TextureAtlas };
  /** @internal */
  protected _urlImages: { [url: string]: TextureAtlas };
  constructor(renderer: GUIRenderer) {
    this._renderer = renderer;
    this._cachedImages = {};
    this._urlImages = {};
    this._atlasManager = new AtlasManager(this._renderer, 1024, 1024, 0, false);
    this._atlasManager.atlasTextureRestoreHandler = async tex => {
      if (!this._atlasManager.isEmpty()) {
        this._atlasManager.clear();
        this._createBuiltinImages();
      }
    };
    this._createBuiltinImages();
  }
  get renderer() {
    return this._renderer;
  }
  getImage(name: string): TextureAtlas {
    return this._cachedImages[name] || null;
  }
  dispose() {
    this._cachedImages = {};
    this._urlImages = {};
  }
  /** @internal */
  private _createBuiltinImages() {
    let cvs = document.createElement('canvas');
    cvs.width = 256;
    cvs.height = 256;
    const ctx = cvs.getContext('2d', { alpha: true });
    ctx.imageSmoothingEnabled = false;
    let offsetX = 0;
    let offsetY = 0;

    // 测量stroke偏移
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.clearRect(0, 0, 10, 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();
    const bitmap = ctx.getImageData(0, 0, 10, 2);
    if (bitmap.data[5 * 4 + 3] < 255) {
      offsetX = 0.5;
      offsetY = 0.5;
    }

    let size = 10;
    let atlasInfo: IAtlasInfo;
    ctx.fillStyle = '#ffffff';

    // input
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    const radius = (size - 2) / 2;
    ctx.ellipse(1 + radius + offsetX, 1 + radius + offsetY, radius, radius, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    atlasInfo = this._atlasManager.pushCanvas('default.input', ctx, 0, 0, size, size);
    this._cachedImages['default.input'] = new TextureAtlas(
      this._atlasManager.getAtlasTexture(atlasInfo.atlasIndex),
      { x: atlasInfo.uMin, y: atlasInfo.vMin },
      { x: atlasInfo.uMax, y: atlasInfo.vMax },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    );

    // button
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.ellipse(1 + radius + offsetX, 1 + radius + offsetY, radius, radius, 0, 0, 2 * Math.PI);
    ctx.fill();
    atlasInfo = this._atlasManager.pushCanvas('default.button', ctx, 0, 0, size, size);
    this._cachedImages['default.button'] = new TextureAtlas(
      this._atlasManager.getAtlasTexture(atlasInfo.atlasIndex),
      { x: atlasInfo.uMin, y: atlasInfo.vMin },
      { x: atlasInfo.uMax, y: atlasInfo.vMax },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    );

    size = 32;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#aaaaaa';
    pathTriangle(ctx, ORIENTATION_VERTICAL, 16, 10, -10, 10, 14);
    ctx.fill();
    atlasInfo = this._atlasManager.pushCanvas('default.scrollbar.down', ctx, 0, 0, size, size);
    this._cachedImages['default.scrollbar.down'] = new TextureAtlas(
      this._atlasManager.getAtlasTexture(atlasInfo.atlasIndex),
      { x: atlasInfo.uMin, y: atlasInfo.vMin },
      { x: atlasInfo.uMax, y: atlasInfo.vMax },
    );

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#aaaaaa';
    pathTriangle(ctx, ORIENTATION_VERTICAL, 16, 24, -10, 10, -14);
    ctx.fill();
    atlasInfo = this._atlasManager.pushCanvas('default.scrollbar.up', ctx, 0, 0, size, size);
    this._cachedImages['default.scrollbar.up'] = new TextureAtlas(
      this._atlasManager.getAtlasTexture(atlasInfo.atlasIndex),
      { x: atlasInfo.uMin, y: atlasInfo.vMin },
      { x: atlasInfo.uMax, y: atlasInfo.vMax },
    );

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#aaaaaa';
    pathTriangle(ctx, ORIENTATION_HORIZONAL, 24, 16, -10, 10, -14);
    ctx.fill();
    atlasInfo = this._atlasManager.pushCanvas('default.scrollbar.left', ctx, 0, 0, size, size);
    this._cachedImages['default.scrollbar.left'] = new TextureAtlas(
      this._atlasManager.getAtlasTexture(atlasInfo.atlasIndex),
      { x: atlasInfo.uMin, y: atlasInfo.vMin },
      { x: atlasInfo.uMax, y: atlasInfo.vMax },
    );

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#aaaaaa';
    pathTriangle(ctx, ORIENTATION_HORIZONAL, 10, 16, -10, 10, 14);
    ctx.fill();
    atlasInfo = this._atlasManager.pushCanvas('default.scrollbar.right', ctx, 0, 0, size, size);
    this._cachedImages['default.scrollbar.right'] = new TextureAtlas(
      this._atlasManager.getAtlasTexture(atlasInfo.atlasIndex),
      { x: atlasInfo.uMin, y: atlasInfo.vMin },
      { x: atlasInfo.uMax, y: atlasInfo.vMax },
    );

    cvs = null;
  }
}

const ORIENTATION_HORIZONAL = 0;
const ORIENTATION_VERTICAL = 1;

function pathTriangle(
  ctx: CanvasRenderingContext2D,
  orientation: number,
  anchorX: number,
  anchorY: number,
  left: number,
  right: number,
  top: number,
) {
  ctx.beginPath();
  if (orientation === ORIENTATION_VERTICAL) {
    ctx.moveTo(anchorX + left, anchorY);
    ctx.lineTo(anchorX + right, anchorY);
    ctx.lineTo(anchorX, anchorY + top);
  } else {
    ctx.moveTo(anchorX, anchorY + left);
    ctx.lineTo(anchorX, anchorY + right);
    ctx.lineTo(anchorX + top, anchorY);
  }
  ctx.closePath();
}
