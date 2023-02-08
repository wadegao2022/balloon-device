import { Device, DeviceOptions, DeviceType, DeviceResizeEvent } from './device';
import { WebGLDevice } from './webgl/device_webgl';
import { WebGPUDevice } from './webgpu/device';

export class Viewer {
  /** @internal */
  private _device: Device;
  /** @internal */
  private _canvas: HTMLCanvasElement;
  /** @internal */
  private _canvasClientWidth: number;
  /** @internal */
  private _canvasClientHeight: number;
  constructor(cvs: HTMLCanvasElement) {
    this._canvas = cvs;
    this._canvasClientWidth = 0;
    this._canvasClientHeight = 0;
    this._device = null;
  }
  get device(): Device {
    return this._device;
  }
  get canvas() {
    return this._canvas;
  }
  async initDevice(deviceType: DeviceType[] | DeviceType, options?: DeviceOptions) {
    const typelist = Array.isArray(deviceType) ? deviceType : [deviceType];
    for (const type of typelist) {
      try {
        if (type === 'webgl' || type === 'webgl2') {
          this._device = new WebGLDevice(this._canvas, type, options);
        } else if (navigator.gpu) {
          this._device = new WebGPUDevice(this._canvas, options);
        }
        if (this._device) {
          break;
        }
      } catch (err) {
        console.log(`create context '${type}' failed: ${err}`);
        this._device = null;
      }
    }
    if (!this._device) {
      throw new Error('ERR: create device failed');
    }
    await this._device.initContext();
    this._device.setViewport();
    this._device.setScissor();

    // let the canvas element receive keyboard event
    if (this._canvas instanceof HTMLCanvasElement) {
      this._canvas.style.outline = 'none';
      this._canvas.setAttribute('tabindex', '1');
    }
    this._onresize();
    this._registerEventHandlers();
  }
  /** @internal */
  private _onresize() {
    const canvas = this._canvas;
    if (
      this._canvasClientWidth !== canvas.clientWidth ||
      this._canvasClientHeight !== canvas.clientHeight
    ) {
      this._canvasClientWidth = canvas.clientWidth;
      this._canvasClientHeight = canvas.clientHeight;
      this._device.dispatchEvent(new DeviceResizeEvent(canvas.clientWidth, canvas.clientHeight));
    }
  }
  /** @internal */
  private _registerEventHandlers() {
    const canvas: HTMLCanvasElement = this._canvas;
    const that = this;
    if (window.ResizeObserver) {
      new window.ResizeObserver(entries => {
        that._onresize();
      }).observe(canvas, {})
    } else {
      new MutationObserver(function (mutations) {
        if (mutations.length > 0) {
          that._onresize();
        }
      }).observe(canvas, { attributes: true, attributeFilter: ['style'] });
      window.addEventListener('resize', () => {
        this._onresize();
      });
    }
  }
}
