import type {BaseLight} from './light';
import type {Camera} from './camera';

export class AddLight {
  node: BaseLight;
  constructor(node?: BaseLight) {
    this.node = node || null;
  }
}

export class RemoveLight {
  node: BaseLight;
  constructor(node?: BaseLight) {
    this.node = node || null;
  }
}

export class CameraChange {
  camera: Camera;
  constructor(camera?: Camera) {
    this.camera = camera || null;
  }
}
