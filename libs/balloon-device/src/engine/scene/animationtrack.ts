import type { Device } from "../device";
import type { Interpolator } from "./interpolator";

export class AnimationTrack {
  protected _interpolator: Interpolator;
  protected _currentPlayTime: number;
  protected _playing: boolean;
  constructor(interpolator: Interpolator) {
    this._currentPlayTime = 0;
    this._playing = false;
    this._interpolator = interpolator;
  }
  get interpolator(): Interpolator {
    return this._interpolator;
  }
  get playing(): boolean {
    return this._playing;
  }
  start() {
    this._playing = true;
  }
  stop() {
    this._playing = false;
  }
  rewind() {
    this._currentPlayTime = 0;
  }
  reset() {
    this.stop();
    this._currentPlayTime = 0;
  }
  update(device: Device, result: Float32Array, playTime: number, duration: number) {
    this._interpolator.interpolate(this._currentPlayTime, duration, result);
  }
}
