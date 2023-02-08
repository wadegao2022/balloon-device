import { Font, FontCanvas } from '../shared';
import { GUIRenderer } from './renderer';
import { RColor } from './types';
import { AtlasManager } from './atlas_manager';
import type { Texture2D } from '../engine/device';

export interface IGlyphInfo {
  atlasIndex: number;
  width: number;
  height: number;
  uMin: number;
  vMin: number;
  uMax: number;
  vMax: number;
}

export class GlyphManager extends AtlasManager {
  constructor(
    renderer: GUIRenderer,
    cacheWidth?: number,
    cacheHeight?: number,
    cachePadding?: number,
  ) {
    super(renderer, Math.max(cacheWidth || 0, 0), cacheHeight, cachePadding, true);
    this._atlasRestoreHandler = async tex => {
      if (this._atlasList.length > 0) {
        this.clear();
      }
    };
  }
  getGlyphTexture(index: number): Texture2D {
    return this.getAtlasTexture(index);
  }
  getGlyphInfo(char: string, font: Font, color: RColor): IGlyphInfo {
    if (!char || !font || !color) {
      return null;
    }
    let glyphInfo = this.getAtlasInfo(this._hash(char, font, color));
    if (!glyphInfo) {
      glyphInfo = this._cacheGlyph(char, font, color);
      glyphInfo.width = Math.round(glyphInfo.width * (font.maxHeight / font.maxHeightScaled));
      glyphInfo.height = font.maxHeight;
    }
    return glyphInfo;
  }
  measureStringWidth(str: string, charMargin: number, font: Font) {
    let w = 0;
    for (const ch of str) {
      w += charMargin + this.getCharWidth(ch, font);
    }
    return w;
  }
  clipStringToWidth(str: string, width: number, charMargin: number, start: number, font: Font) {
    let sum = 0;
    let i = start;
    for (; i < str.length; i++) {
      sum += charMargin + this.getCharWidth(str[i], font);
      if (sum > width) {
        break;
      }
    }
    return i - start;
  }
  /** @internal */
  private _normalizeColor(color: RColor): string {
    const r = `0${(Math.round(color.r * 255) & 0xff).toString(16)}`.slice(-2);
    const g = `0${(Math.round(color.g * 255) & 0xff).toString(16)}`.slice(-2);
    const b = `0${(Math.round(color.b * 255) & 0xff).toString(16)}`.slice(-2);
    return `#${r}${g}${b}`;
  }
  /** @internal */
  private _hash(char: string, font: Font, color: RColor) {
    const clr = this._renderer.supportColorComposition() ? '' : `@${this._normalizeColor(color)}`;
    return `${font.family}@${font.size}${clr}&${char}`;
  }
  /** @internal */
  private _cacheGlyph(char: string, font: Font, color: RColor): IGlyphInfo {
    const bitmap = this._getGlyphBitmap(char, font, color) as ImageData;
    return this.pushBitmap(this._hash(char, font, color), bitmap);
  }
  getCharWidth(char: string, font: Font): number {
    if (!font) {
      return 0;
    }
    FontCanvas.font = font.fontNameScaled;
    const metric = FontCanvas.context.measureText(char);
    let w = metric.width;
    if (w === 0) {
      return 0;
    }
    if (typeof metric.actualBoundingBoxRight === 'number') {
      w = Math.floor(Math.max(w, metric.actualBoundingBoxRight) + 0.8);
    }
    w = Math.round(w * (font.maxHeight / font.maxHeightScaled))
    return w;
  }
  /** @internal */
  private _getGlyphBitmap(
    char: string,
    font: Font,
    color: RColor,
  ): ImageData | { x: number; y: number; w: number; h: number } {
    if (!font) {
      return null;
    }
    FontCanvas.font = font.fontNameScaled;
    const metric = FontCanvas.context.measureText(char);
    let w = metric.width;
    if (w === 0) {
      return null;
    }
    if (typeof metric.actualBoundingBoxRight === 'number') {
      w = Math.floor(Math.max(w, metric.actualBoundingBoxRight) + 0.8);
    }
    const h = font.maxHeightScaled;
    FontCanvas.context.fillStyle = this._renderer.supportColorComposition()
      ? '#fff'
      : this._normalizeColor(color);
    FontCanvas.context.clearRect(0, 0, w + 2, h);
    FontCanvas.context.fillText(char, 0, -font.topScaled);
    return FontCanvas.context.getImageData(0, 0, w, h);
  }
}
