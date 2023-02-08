import type { Camera, CameraInputSource, IMouseEvent, IKeyEvent } from '../camera';

export class BaseCameraModel {
  /** @internal */
  private _camera: Camera;
  /** @internal */
  private _mouseDownHandler: (evt: IMouseEvent) => void;
  /** @internal */
  private _mouseUpHandler: (evt: IMouseEvent) => void;
  /** @internal */
  private _mouseWheelHandler: (evt: IMouseEvent) => void;
  /** @internal */
  private _mouseMoveHandler: (evt: IMouseEvent) => void;
  /** @internal */
  private _keyDownHandler: (evt: IKeyEvent) => void;
  /** @internal */
  private _keyUpHandler: (evt: IKeyEvent) => void;
  constructor() {
    this._camera = null;
    this._mouseDownHandler = this.onMouseDown.bind(this);
    this._mouseUpHandler = this.onMouseUp.bind(this);
    this._mouseWheelHandler = this.onMouseWheel.bind(this);
    this._mouseMoveHandler = this.onMouseMove.bind(this);
    this._keyDownHandler = this.onKeyDown.bind(this);
    this._keyUpHandler = this.onKeyUp.bind(this);
    this.reset();
  }
  /** @internal */
  _getCamera() {
    return this._camera;
  }
  /** @internal */
  _setCamera(camera: Camera) {
    if (this._camera !== camera) {
      if (this._camera) {
        this.uninstallMouseInput(this._camera.mouseInputSource);
        this.uninstallKeyboardInput(this._camera.keyboardInputSource);
      }
      this._camera = camera;
      if (this._camera) {
        this.installMouseInput(this._camera.mouseInputSource);
        this.installKeyboardInput(this._camera.keyboardInputSource);
        this.reset();
      }
    }
  }
  installMouseInput(input: CameraInputSource) {
    if (input) {
      input.addEventListener('mousedown', this._mouseDownHandler);
      input.addEventListener('mouseup', this._mouseUpHandler);
      input.addEventListener('wheel', this._mouseWheelHandler);
      input.addEventListener('mousemove', this._mouseMoveHandler);
    }
  }
  uninstallMouseInput(input: CameraInputSource) {
    if (input) {
      input.removeEventListener('mousedown', this._mouseDownHandler);
      input.removeEventListener('mouseup', this._mouseUpHandler);
      input.removeEventListener('wheel', this._mouseWheelHandler);
      input.removeEventListener('mousemove', this._mouseMoveHandler);
    }
  }
  installKeyboardInput(input: CameraInputSource) {
    if (input) {
      input.addEventListener('keydown', this._keyDownHandler);
      input.addEventListener('keyup', this._keyUpHandler);
    }
  }
  uninstallKeyboardInput(input: CameraInputSource) {
    if (input) {
      input.removeEventListener('keydown', this._keyDownHandler);
      input.removeEventListener('keyup', this._keyUpHandler);
    }
  }
  reset(): void { }
  onMouseDown(evt: IMouseEvent): void {
    if (evt.target === this._camera?.mouseInputSource) {
      this._onMouseDown(evt);
    }
  }
  onMouseUp(evt: IMouseEvent): void {
    if (evt.target === this._camera?.mouseInputSource) {
      this._onMouseUp(evt);
    }
  }
  onMouseWheel(evt: IMouseEvent): void {
    if (evt.target === this._camera?.mouseInputSource) {
      this._onMouseWheel(evt);
    }
  }
  onMouseMove(evt: IMouseEvent): void {
    if (evt.target === this._camera?.mouseInputSource) {
      this._onMouseMove(evt);
    }
  }
  onKeyDown(evt: IKeyEvent): void {
    if (evt.target === this._camera?.keyboardInputSource) {
      this._onKeyDown(evt);
    }
  }
  onKeyUp(evt: IKeyEvent): void {
    if (evt.target === this._camera?.keyboardInputSource) {
      this._onKeyUp(evt);
    }
  }
  update(): void { }
  /** @internal */
  protected _onMouseDown(evt: IMouseEvent): void { }
  /** @internal */
  protected _onMouseUp(evt: IMouseEvent): void { }
  /** @internal */
  protected _onMouseWheel(evt: IMouseEvent): void { }
  /** @internal */
  protected _onMouseMove(evt: IMouseEvent): void { }
  /** @internal */
  protected _onKeyDown(evt: IKeyEvent): void { }
  /** @internal */
  protected _onKeyUp(evt: IKeyEvent): void { }
}
