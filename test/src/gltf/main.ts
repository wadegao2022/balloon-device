import * as chaos from 'balloon-device';
import * as common from '../common';
import { GLTFViewer } from './gltfviewer';

(async function () {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const viewer = new chaos.Viewer(canvas);
  await viewer.initDevice(common.getQueryString('dev') as chaos.DeviceType || 'webgl', { msaa: true });
  const guiRenderer = new chaos.GUIRenderer(viewer.device);
  const GUI = new chaos.GUI(guiRenderer);
  await GUI.deserializeFromXML(document.querySelector('#main-ui').innerHTML);
  const sceneView = GUI.document.querySelector('#scene-view');
  sceneView.customDraw = true;
  const group = GUI.document.querySelector('#button-group');
  const scene = new chaos.Scene(viewer.device);
  common.createTestPanel(scene, group);
  common.createSceneTweakPanel(scene, group, { width: '200px' });
  common.createTextureViewPanel(viewer.device, sceneView, 300);

  const gltfViewer = new GLTFViewer(GUI, scene);
  gltfViewer.camera.mouseInputSource = sceneView;
  gltfViewer.camera.keyboardInputSource = sceneView;
  // await gltfViewer.initEnvironment();

  canvas.addEventListener('dragover', (ev: DragEvent) => {
    ev.preventDefault();
  });
  canvas.addEventListener('drop', (ev: DragEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.dataTransfer.items.length > 0) {
      gltfViewer.handleDrop(ev.dataTransfer);
    }
  });

  /*
  common.createLightTweakPanel(gltfViewer.light, sceneView, {
    width: '200px'
  });
  */
  sceneView.addEventListener('layout', function (this: chaos.RElement) {
    const rect = this.getClientRect();
    gltfViewer.aspect = rect.width / rect.height;
  });

  sceneView.addEventListener('draw', function (this: chaos.RElement, evt: chaos.REvent) {
    evt.preventDefault();
    gltfViewer.render();
  });

  sceneView.addEventListener('mousemove', evt => {
    const intersected = gltfViewer.raycast(evt.offsetX, evt.offsetY);
    console.log(`raycast: ${intersected?.constructor.name || null}`);
  });

  viewer.device.runLoop(device => GUI.render());

}());


