import { RenderScheme } from './renderscheme';
import { ForwardRenderPass } from './forward_pass';
import { ForwardMultiRenderPass } from './forward_multi_pass';
import { ShadowMapPass } from './shadowmap_pass';
import type { Device, FrameBuffer } from '../../device';
import type { Scene } from '../scene';
import type { Camera } from '../camera';

export class ForwardRenderScheme extends RenderScheme {
  /** @internal */
  private _scenePass: ForwardRenderPass | ForwardMultiRenderPass;
  /** @internal */
  private _shadowMapPass: ShadowMapPass;
  constructor(device: Device) {
    super(device);
    this._scenePass = device.getDeviceType() === 'webgl' ? new ForwardMultiRenderPass(this, '') : new ForwardRenderPass(this, '');
    this._shadowMapPass = new ShadowMapPass(this, '');
    this._shadowMapPass.mainPass = this._scenePass;
  }
  get scenePass(): ForwardRenderPass | ForwardMultiRenderPass {
    return this._scenePass;
  }
  get shadowMapPass(): ShadowMapPass {
    return this._shadowMapPass;
  }
  protected _renderScene(scene: Scene, camera: Camera): void {
    this._shadowMapPass.render(scene, camera);
    this._scenePass.render(scene, camera);
  }
  protected _renderSceneToTexture(scene: Scene, camera: Camera, frameBuffer: FrameBuffer): void {
    this._shadowMapPass.render(scene, camera);
    this._scenePass.renderToTexture(scene, camera, frameBuffer);
  }
  protected _renderSceneToCubeTexture(scene: Scene, camera: Camera, frameBuffer: FrameBuffer): void {
    this._shadowMapPass.render(scene, camera);
    this._scenePass.renderToCubeTexture(scene, camera, frameBuffer);
  }
  protected _dispose() {
    this._scenePass.dispose();
    this._scenePass = null;
    this._shadowMapPass.dispose();
    this._shadowMapPass = null;
  }
}
