import { Vector3, Quaternion, Matrix3x3, Matrix4x4 } from '../../math';
import { BaseCameraModel } from './base';
import type { AbstractCameraModel, IMouseEvent, IKeyEvent } from '../camera';
export interface IFPSCameraModelOptions {
  controlKeys?: {
    up: string;
    down: string;
    forward: string;
    backward: string;
    left: string;
    right: string;
  };
  moveSpeed?: number;
  rotateSpeed?: number;
}

export class FPSCameraModel extends BaseCameraModel implements AbstractCameraModel {
  /** @internal */
  private options: IFPSCameraModelOptions;
  /** @internal */
  private mouseDown: boolean;
  /** @internal */
  private lastMouseX: number;
  /** @internal */
  private lastMouseY: number;
  /** @internal */
  private keyUp: boolean;
  /** @internal */
  private keyDown: boolean;
  /** @internal */
  private keyLeft: boolean;
  /** @internal */
  private keyRight: boolean;
  /** @internal */
  private keyForward: boolean;
  /** @internal */
  private keyBackward: boolean;
  constructor(options?: IFPSCameraModelOptions) {
    super();
    this.options = Object.assign(
      {
        controlKeys: {
          up: 'KeyQ',
          down: 'KeyE',
          forward: 'KeyW',
          backward: 'KeyS',
          left: 'KeyA',
          right: 'KeyD',
        },
        moveSpeed: 0.2,
        rotateSpeed: 0.01,
      },
      options || {},
    );
  }
  reset() {
    this.mouseDown = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.keyUp = false;
    this.keyDown = false;
    this.keyLeft = false;
    this.keyRight = false;
    this.keyForward = false;
    this.keyBackward = false;
  }
  /** @internal */
  protected _onMouseDown(evt: IMouseEvent) {
    if (evt.button === 0) {
      this.mouseDown = true;
      this.lastMouseX = evt.offsetX;
      this.lastMouseY = evt.offsetY;
    }
  }
  /** @internal */
  protected _onMouseUp(evt: IMouseEvent) {
    if (evt.button === 0) {
      this.mouseDown = false;
    }
  }
  /** @internal */
  protected _onMouseWheel() {
    void 0;
  }
  /** @internal */
  protected _onMouseMove(evt: IMouseEvent) {
    if (this.mouseDown) {
      const dx = evt.offsetX - this.lastMouseX;
      const dy = evt.offsetY - this.lastMouseY;
      this.lastMouseX = evt.offsetX;
      this.lastMouseY = evt.offsetY;
      const zAxis = this._getCamera().worldMatrix.getRow(2).xyz();
      const alpha = Math.atan2(zAxis.z, zAxis.x) + dx * this.options.rotateSpeed;
      const beta = Math.min(
        Math.PI / 2.1,
        Math.max(-Math.PI / 2.1, Math.asin(zAxis.y) + dy * this.options.rotateSpeed),
      );
      const newY = Math.sin(beta);
      const r = Math.sqrt(Math.max(0, 1 - newY * newY));
      const newZ = Math.sin(alpha) * r;
      const newX = Math.cos(alpha) * r;
      zAxis.set(newX, newY, newZ).inplaceNormalize();
      const XAxis = Vector3.cross(Vector3.axisPY(), zAxis).inplaceNormalize();
      const YAxis = Vector3.cross(zAxis, XAxis).inplaceNormalize();
      const rotation = Quaternion.fromRotationMatrix(
        new Matrix3x3([
          XAxis.x,
          XAxis.y,
          XAxis.z,
          YAxis.x,
          YAxis.y,
          YAxis.z,
          zAxis.x,
          zAxis.y,
          zAxis.z,
        ]),
      );
      if (!this._getCamera().parent) {
        this._getCamera().rotation = rotation;
      } else {
        const pos = new Vector3();
        const scale = new Vector3();
        this._getCamera().worldMatrix.decompose(scale, null, pos);
        const newWorldMatrix = Matrix4x4.scaling(scale).rotateLeft(rotation).translateLeft(pos);
        const newLocalMatrix = this._getCamera().parent ? newWorldMatrix.multiplyLeftAffine(Matrix4x4.inverseAffine(this._getCamera().parent.worldMatrix)) : newWorldMatrix;
        newLocalMatrix.decompose(scale, rotation, pos);
        this._getCamera().position = pos;
        this._getCamera().scaling = scale;
        this._getCamera().rotation = rotation;
      }
    }
  }
  /** @internal */
  protected _onKeyDown(evt: IKeyEvent) {
    switch (evt.code) {
      case this.options.controlKeys.up:
        this.keyUp = true;
        break;
      case this.options.controlKeys.down:
        this.keyDown = true;
        break;
      case this.options.controlKeys.left:
        this.keyLeft = true;
        break;
      case this.options.controlKeys.right:
        this.keyRight = true;
        break;
      case this.options.controlKeys.forward:
        this.keyForward = true;
        break;
      case this.options.controlKeys.backward:
        this.keyBackward = true;
        break;
    }
  }
  /** @internal */
  protected _onKeyUp(evt: IKeyEvent) {
    switch (evt.code) {
      case this.options.controlKeys.up:
        this.keyUp = false;
        break;
      case this.options.controlKeys.down:
        this.keyDown = false;
        break;
      case this.options.controlKeys.left:
        this.keyLeft = false;
        break;
      case this.options.controlKeys.right:
        this.keyRight = false;
        break;
      case this.options.controlKeys.forward:
        this.keyForward = false;
        break;
      case this.options.controlKeys.backward:
        this.keyBackward = false;
        break;
    }
  }
  setOptions(opt?: IFPSCameraModelOptions) {
    opt && Object.assign(this.options, opt);
    this.reset();
  }
  update() {
    const x = this._getCamera().worldMatrix.getRow(0).xyz().setY(0).inplaceNormalize();
    if (x.isNaN()) {
      console.log(`Camera error 1: ${x.toString()}`);
    }
    const z = this._getCamera().worldMatrix.getRow(2).xyz().inplaceNormalize();
    if (z.isNaN()) {
      console.log(`Camera error 2: ${z.toString()}`);
    }
    const move = new Vector3(0, 0, 0);
    let changed = false;
    if (this.keyForward) {
      changed = true;
      move.subBy(Vector3.scale(z, this.options.moveSpeed));
    }
    if (this.keyBackward) {
      changed = true;
      move.addBy(Vector3.scale(z, this.options.moveSpeed));
    }
    if (this.keyUp) {
      changed = true;
      move.y += this.options.moveSpeed;
    }
    if (this.keyDown) {
      changed = true;
      move.y -= this.options.moveSpeed;
    }
    if (this.keyLeft) {
      changed = true;
      move.subBy(Vector3.scale(x, this.options.moveSpeed));
    }
    if (this.keyRight) {
      changed = true;
      move.addBy(Vector3.scale(x, this.options.moveSpeed));
    }
    if (changed) {
      if (this._getCamera().parent) {
        const pos = new Vector3();
        const scale = new Vector3();
        const rotation = new Quaternion();
        this._getCamera().worldMatrix.decompose(scale, rotation, pos);
        pos.addBy(move);
        const newWorldMatrix = Matrix4x4.scaling(scale).rotateLeft(rotation).translateLeft(pos);
        const newLocalMatrix = newWorldMatrix.multiplyLeftAffine(Matrix4x4.inverseAffine(this._getCamera().parent.worldMatrix));
        newLocalMatrix.decompose(scale, rotation, pos);
        if (scale.isNaN() || rotation.isNaN() || pos.isNaN()) {
          console.log(`Camera error 3: ${scale.toString()} ${rotation.toString()} ${pos.toString()}`);
        }
        this._getCamera().position = pos;
        this._getCamera().scaling = scale;
        this._getCamera().rotation = rotation;
      } else {
        this._getCamera().position.addBy(move);
      }
    }
  }
}
