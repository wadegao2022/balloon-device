import { Device, FrameBuffer, TextureFormat } from '../../device';
import type { Camera } from '../camera';
import type { Scene } from '../scene';

export abstract class RenderScheme {
  protected _device: Device;
  protected _shadowMapFormat: TextureFormat;
  constructor(device: Device) {
    this._device = device;
    this._shadowMapFormat = device.getTextureCaps().supportHalfFloatColorBuffer
      ? device.getDeviceType() === 'webgl' ? TextureFormat.RGBA16F : TextureFormat.R16F
      : device.getTextureCaps().supportFloatColorBuffer
        ? device.getDeviceType() === 'webgl' ? TextureFormat.RGBA32F : TextureFormat.R32F
        : TextureFormat.RGBA8UNORM;
  }
  get device(): Device {
    return this._device;
  }
  renderScene(scene: Scene, camera: Camera): void {
    scene.frameUpdate(camera);
    if (camera && !scene.device.isContextLost()) {
      this._renderScene(scene, camera);
    }
  }
  renderSceneToTexture(scene: Scene, camera: Camera, frameBuffer: FrameBuffer): void {
    scene.frameUpdate(camera);
    if (camera && !scene.device.isContextLost()) {
      this._renderSceneToTexture(scene, camera, frameBuffer);
    }
  }
  renderSceneToCubeTexture(scene: Scene, camera: Camera, frameBuffer: FrameBuffer): void {
    scene.frameUpdate(camera);
    if (camera && !scene.device.isContextLost()) {
      this._renderSceneToCubeTexture(scene, camera, frameBuffer);
    }
  }
  dispose(): void {
    this._dispose();
  }
  getShadowMapFormat(): TextureFormat {
    return this._shadowMapFormat;
  }
  protected abstract _renderScene(scene: Scene, camera: Camera);
  protected abstract _renderSceneToTexture(scene: Scene, camera: Camera, frameBuffer: FrameBuffer);
  protected abstract _renderSceneToCubeTexture(scene: Scene, camera: Camera, frameBuffer: FrameBuffer);
  protected abstract _dispose();
}
