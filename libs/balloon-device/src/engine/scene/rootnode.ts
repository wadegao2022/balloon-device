import {SceneNode} from './scene_node';
import type {Scene} from './scene';

export class RootNode extends SceneNode {
  constructor(scene: Scene) {
    super(scene);
  }
}
