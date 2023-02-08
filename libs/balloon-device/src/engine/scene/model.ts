import { AnimationClip } from './animation';
import type { REvent } from '../../shared';
import type { Scene } from './scene';
import type { Camera } from './camera';
import { GraphNode } from './graph_node';

export class Model extends GraphNode {
  /** @internal */
  private _animations: { [name: string]: AnimationClip };
  /** @internal */
  private _animationIndex: number;
  /** @internal */
  private _updateCallback: (evt: REvent) => void;
  constructor(scene: Scene) {
    super(scene);
    this._animations = {};
    this._animationIndex = 0;
    this._updateCallback = (evt: REvent) => {
      if (this.attached) {
        this.update((evt as Scene.TickEvent).camera);
      }
    };
  }
  addAnimation(name?: string): AnimationClip {
    if (!name) {
      for (; ;) {
        name = `animation${this._animationIndex++}`;
        if (!this._animationIndex[name]) {
          break;
        }
      }
    }
    if (this._animations[name]) {
      console.error(`Model.addAnimation() failed: animation '${name}' already exists`);
      return null;
    } else {
      const ani = new AnimationClip(name, this);
      this._animations[name] = ani;
      return ani;
    }
  }
  removeAnimation(name: string) {
    this.stopAnimation(name);
    delete this._animations[name];
  }
  getAnimationNames(): string[] {
    return Object.keys(this._animations);
  }
  update(camera: Camera) {
    for (const k in this._animations) {
      this._animations[k].update();
    }
  }
  isPlayingAnimation(name?: string) {
    if (name) {
      return this._animations[name]?.isPlaying();
    } else {
      for (const k in this._animations) {
        if (this._animations[k].isPlaying()) {
          return true;
        }
      }
      return false;
    }
  }
  playAnimation(name: string, repeat = 1) {
    const isPlaying = this.isPlayingAnimation();
    const ani = this._animations[name];
    if (ani && !ani.isPlaying()) {
      ani.repeat = repeat;
      ani.play();
    }
    if (!isPlaying && this.isPlayingAnimation()) {
      this.scene.addEventListener('tick', this._updateCallback);
    }
  }
  stopAnimation(name: string) {
    const isPlaying = this.isPlayingAnimation();
    this._animations[name]?.stop();
    if (isPlaying && !this.isPlayingAnimation()) {
      this.scene.removeEventListener('tick', this._updateCallback);
    }
  }

}
