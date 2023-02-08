import type { Texture2D } from '../engine/device';
import type { RCoord } from './types';

export class TextureAtlas {
  /** @internal */
  protected _texture: Texture2D;
  /** @internal */
  protected _uvMin: RCoord;
  /** @internal */
  protected _uvMax: RCoord;
  /** @internal */
  protected _topLeftPatch9: RCoord;
  /** @internal */
  protected _bottomRightPatch9: RCoord;
  constructor(
    texture?: Texture2D,
    uvMin?: RCoord,
    uvMax?: RCoord,
    topLeftPatch9?: RCoord,
    bottomRightPatch9?: RCoord,
  ) {
    this._texture = texture || null;
    this._uvMin = uvMin || { x: 0, y: 0 };
    this._uvMax = uvMax || { x: 1, y: 1 };
    this._topLeftPatch9 = topLeftPatch9 || null;
    this._bottomRightPatch9 = bottomRightPatch9 || null;
  }
  get texture(): Texture2D {
    return this._texture;
  }
  set texture(tex: Texture2D) {
    this._texture = tex;
  }
  get uvMin() {
    return this._uvMin;
  }
  set uvMin(v: RCoord) {
    this._uvMin.x = v.x;
    this._uvMin.y = v.y;
  }
  get uvMax() {
    return this._uvMax;
  }
  set uvMax(v: RCoord) {
    this._uvMax.x = v.x;
    this._uvMax.y = v.y;
  }
  get topLeftPatch9() {
    return this._topLeftPatch9;
  }
  set topLeftPatch9(v: RCoord) {
    this._topLeftPatch9.x = v.x;
    this._topLeftPatch9.y = v.y;
  }
  get bottomRightPatch9() {
    return this._bottomRightPatch9;
  }
  set bottomRightPatch9(v: RCoord) {
    this._bottomRightPatch9.x = v.x;
    this._bottomRightPatch9.y = v.y;
  }
}
