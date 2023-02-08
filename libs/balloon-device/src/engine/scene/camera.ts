import { CubeFace, Matrix4x4, Vector3, Frustum } from '../math';
import { SceneNode } from './scene_node';
import type { Scene } from './scene';
export interface IMouseEvent {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  button: number;
  buttons: number;
  wheelDeltaX: number;
  wheelDeltaY: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  target: unknown;
}

export interface IKeyEvent {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  target: unknown;
}

export interface IFrameStamp {
  frameId: number;
  timestamp: number;
}

export interface CameraInputSource {
  addEventListener(eventname: string, func: (evt: any) => void);
  removeEventListener(eventname: string, func: (evt: any) => void);
}

export interface AbstractCameraModel {
  reset(): void;
  installMouseInput(input: CameraInputSource);
  uninstallMouseInput(input: CameraInputSource);
  installKeyboardInput(input: CameraInputSource);
  uninstallKeyboardInput(input: CameraInputSource);
  onMouseDown(evt: IMouseEvent): void;
  onMouseUp(evt: IMouseEvent): void;
  onMouseWheel(evt: IMouseEvent): void;
  onMouseMove(evt: IMouseEvent): void;
  onKeyDown(evt: IKeyEvent): void;
  onKeyUp(evt: IKeyEvent): void;
  update(): void;
  /** @internal */
  _getCamera(): Camera;
  /** @internal */
  _setCamera(camera: Camera): void;
}

export class Camera extends SceneNode {
  /** @internal */
  protected _projMatrix: Matrix4x4;
  /** @internal */
  protected _viewMatrix: Matrix4x4;
  /** @internal */
  protected _viewProjMatrix: Matrix4x4;
  /** @internal */
  protected _invViewProjMatrix: Matrix4x4;
  /** @internal */
  protected _framestamp: IFrameStamp;
  /** @internal */
  protected _xformDirty: boolean;
  /** @internal */
  protected _linearOutput: boolean;
  /** @internal */
  protected _model: AbstractCameraModel;
  /** @internal */
  protected _mouseInputSource: CameraInputSource;
  /** @internal */
  protected _keyboardInputSource: CameraInputSource;
  /** @internal */
  protected _cameraTag: number;
  /** @internal */
  protected _frustum: Frustum;
  constructor(scene: Scene, projectionMatrix?: Matrix4x4) {
    super(scene);
    this._projMatrix = projectionMatrix || Matrix4x4.identity();
    this._viewMatrix = Matrix4x4.identity();
    this._viewProjMatrix = Matrix4x4.identity();
    this._invViewProjMatrix = Matrix4x4.identity();
    this._framestamp = { frameId: 0, timestamp: 0 };
    this._xformDirty = true;
    this._linearOutput = false;
    this._model = null;
    this._cameraTag = 0;
    this._frustum = null;
    this._mouseInputSource = null;
    this._keyboardInputSource = null;
    this._projMatrix.setChangeCallback(() => this._invalidate());
    this.addDefaultEventListener('xform_change', () => this._invalidate());
  }
  get cameraTag(): number {
    return this._cameraTag;
  }
  get framestamp(): IFrameStamp {
    return this._framestamp;
  }
  get mouseInputSource(): CameraInputSource {
    return this._mouseInputSource;
  }
  set mouseInputSource(inputSource: CameraInputSource) {
    if (inputSource !== this._mouseInputSource) {
      if (this._model) {
        this._model.uninstallMouseInput(this._mouseInputSource);
      }
      this._mouseInputSource = inputSource;
      if (this._model) {
        this._model.installMouseInput(this._mouseInputSource);
      }
    }
  }
  get keyboardInputSource(): CameraInputSource {
    return this._keyboardInputSource;
  }
  set keyboardInputSource(inputSource: CameraInputSource) {
    if (inputSource !== this._keyboardInputSource) {
      if (this._model) {
        this._model.uninstallKeyboardInput(this._keyboardInputSource);
      }
      this._keyboardInputSource = inputSource;
      if (this._model) {
        this._model.installKeyboardInput(this._keyboardInputSource);
      }
    }
  }
  lookAt(eye: Vector3, target: Vector3, up: Vector3): this {
    Matrix4x4.lookAt(eye, target, up).decompose(this.scaling, this.rotation, this.position);
    return this;
  }
  lookAtCubeFace(face: CubeFace, position?: Vector3): void {
    Matrix4x4.lookAtCubeFace(face).decompose(this.scaling, this.rotation, this.position);
    if (position) {
      this.position = position;
    }
  }
  get projectionMatrix(): Matrix4x4 {
    return this._projMatrix;
  }
  set projectionMatrix(matrix: Matrix4x4) {
    this.setProjectionMatrix(matrix);
  }
  setProjectionMatrix(matrix: Matrix4x4) {
    this._projMatrix.assign(matrix.getArray());
    this._invalidate();
    return this;
  }
  get viewMatrix(): Matrix4x4 {
    if (this._xformDirty) {
      this._xformDirty = false;
      this._computeViewProj();
    }
    return this._viewMatrix;
  }
  get viewProjectionMatrix(): Matrix4x4 {
    if (this._xformDirty) {
      this._xformDirty = false;
      this._computeViewProj();
    }
    return this._viewProjMatrix;
  }
  get invViewProjectionMatrix(): Matrix4x4 {
    if (this._xformDirty) {
      this._xformDirty = false;
      this._computeViewProj();
    }
    return this._invViewProjMatrix;
  }
  get frustum(): Frustum {
    if (!this._frustum) {
      this._frustum = new Frustum();
      this._frustum.setMatrix(this.viewProjectionMatrix, Matrix4x4.identity());
    }
    return this._frustum;
  }
  get linearOutputEnabled(): boolean {
    return this._linearOutput;
  }
  set linearOutputEnabled(val: boolean) {
    this.enableLinearOutput(val);
  }
  get model(): AbstractCameraModel {
    return this._model || null;
  }
  set model(model: AbstractCameraModel) {
    this.setModel(model);
  }
  enableLinearOutput(val: boolean) {
    this._linearOutput = val;
    return this;
  }
  isPerspective(): boolean {
    return this._projMatrix.isPerspective();
  }
  isOrtho(): boolean {
    return this._projMatrix.isOrtho();
  }
  isCamera(): this is Camera {
    return true;
  }
  getNearPlane(): number {
    return this._projMatrix.getNearPlane();
  }
  getFarPlane(): number {
    return this._projMatrix.getFarPlane();
  }
  getFOV(): number {
    return this._projMatrix.getFov();
  }
  getTanHalfFovy(): number {
    return this._projMatrix.getTanHalfFov();
  }
  getAspect(): number {
    return this._projMatrix.getAspect();
  }
  setNearFar(znear: number, zfar: number) {
    this._projMatrix.setNearFar(znear, zfar);
  }
  setModel(model: AbstractCameraModel) {
    if (this._model !== model) {
      if (model && model._getCamera() && model._getCamera() !== this) {
        throw new Error(
          'Camera.setModel failed: one camera model object cannot be assigned to multiple camera',
        );
      }
      if (this._model) {
        this._model._setCamera(null);
      }
      this._model = model || null;
      if (this._model) {
        this._model._setCamera(this);
      }
    }
    return this;
  }
  frameUpdate() {
    this._framestamp.frameId++;
    this._framestamp.timestamp = Date.now();
    if (this._model) {
      this._model.update();
    }
  }
  /** @internal */
  protected _invalidate() {
    this._xformDirty = true;
    this._cameraTag++;
    this._frustum = null;
  }
  /** @internal */
  protected _computeViewProj() {
    Matrix4x4.inverseAffine(this.worldMatrix, this._viewMatrix);
    Matrix4x4.multiply(this._projMatrix, this._viewMatrix, this._viewProjMatrix);
    Matrix4x4.inverse(this._viewProjMatrix, this._invViewProjMatrix);
  }
  dispose() {
    this.setModel(null);
    this._projMatrix = null;
    this._viewMatrix = null;
    this._viewProjMatrix = null;
  }
}
