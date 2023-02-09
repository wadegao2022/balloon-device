import * as chaos from 'balloon-device';
import * as common from '../common';
import { TestTexture2D, TestTexture2DArray, TestTexture3D, TestTextureCube, TestTextureCubeSH, TestTextureVideo } from './case';

(async function () {
  const viewer = new chaos.Viewer(document.getElementById('canvas') as HTMLCanvasElement);
  await viewer.initDevice(common.getQueryString('dev') as chaos.DeviceType || 'webgl', { msaa: true });
  const guiRenderer = new chaos.GUIRenderer(viewer.device);
  const GUI = new chaos.GUI(guiRenderer);
  await GUI.deserializeFromXML(document.querySelector('#main-ui').innerHTML);
  const assetManager = new chaos.AssetManager(viewer.device);
  const sceneView = GUI.document.querySelector('.scene-view-container');
  const sceneView2d = GUI.document.querySelector('#scene-view-2d');
  sceneView2d.customDraw = true;
  const sceneView3d = GUI.document.querySelector('#scene-view-3d');
  sceneView3d.customDraw = true;
  const sceneViewCube = GUI.document.querySelector('#scene-view-cube');
  sceneViewCube.customDraw = true;
  const sceneView2dArray = GUI.document.querySelector('#scene-view-2darray');
  sceneView2dArray.customDraw = true;
  const sceneViewVideo = GUI.document.querySelector('#scene-view-video');
  sceneViewVideo.customDraw = true;

  const case2d = new TestTexture2D(viewer.device, assetManager);
  await case2d.init();
  const case3d = viewer.device.getDeviceType() === 'webgl' ? null : new TestTexture3D(viewer.device, assetManager);
  await case3d?.init();
  const caseCube = new TestTextureCube(viewer.device, assetManager);
  await caseCube.init();
  const case2dArray = viewer.device.getDeviceType() === 'webgl' ? null : new TestTexture2DArray(viewer.device, assetManager);
  await case2dArray?.init();
  const caseVideo = new TestTextureVideo(viewer.device, assetManager, './assets/images/sample-video.mp4');
  await caseVideo.init();

  sceneView2d.addEventListener('draw', function (this: chaos.RElement, evt: chaos.REvent) {
    evt.preventDefault();
    viewer.device.clearFrameBuffer(new chaos.Vector4(0, 0, 0.5, 1), 1, 0);
    const rect = this.getClientRect();
    case2d.draw(rect.width, rect.height);
  });

  sceneView3d.addEventListener('draw', function (this: chaos.RElement, evt: chaos.REvent) {
    evt.preventDefault();
    viewer.device.clearFrameBuffer(new chaos.Vector4(0, 0, 0.5, 1), 1, 0);
    if (viewer.device.getDeviceType() !== 'webgl') {
      const rect = this.getClientRect();
      case3d.draw(rect.width, rect.height);
    }
  });

  sceneViewCube.addEventListener('draw', function (this: chaos.RElement, evt: chaos.REvent) {
    evt.preventDefault();
    viewer.device.clearFrameBuffer(new chaos.Vector4(0, 0, 0.5, 1), 1, 0);
    const rect = this.getClientRect();
    caseCube.draw(rect.width, rect.height);
  });

  sceneView2dArray.addEventListener('draw', function (this: chaos.RElement, evt: chaos.REvent) {
    evt.preventDefault();
    viewer.device.clearFrameBuffer(new chaos.Vector4(0, 0, 0.5, 1), 1, 0);
    if (viewer.device.getDeviceType() !== 'webgl') {
      const rect = this.getClientRect();
      case2dArray.draw(rect.width, rect.height);
    }
  });

  sceneViewVideo.addEventListener('draw', function (this: chaos.RElement, evt: chaos.REvent) {
    evt.preventDefault();
    viewer.device.clearFrameBuffer(new chaos.Vector4(0, 0, 0.5, 1), 1, 0);
    const rect = this.getClientRect();
    caseVideo.draw(rect.width, rect.height);
  });

  common.createTextureViewPanel(viewer.device, GUI.document.body, 300);
  viewer.device.runLoop(device => GUI.render());

}());

