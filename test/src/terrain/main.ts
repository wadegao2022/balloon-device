import * as chaos from 'balloon-device';
import * as common from '../common';
import { loadEarthSculptorMap } from './earthscuptor';

(async function () {
  const viewer = new chaos.Viewer(document.getElementById('canvas') as HTMLCanvasElement);
  await viewer.initDevice(common.getQueryString('dev') as chaos.DeviceType || 'webgl', { msaa: true });
  const guiRenderer = new chaos.GUIRenderer(viewer.device);
  const GUI = new chaos.GUI(guiRenderer);

  await GUI.deserializeFromXML(document.querySelector('#main-ui').innerHTML);
  const sceneView = GUI.document.querySelector('#scene-view');
  sceneView.customDraw = true;
  const scene = new chaos.Scene(viewer.device);
  const scheme = new chaos.ForwardRenderScheme(viewer.device);
  const camera = scene.addCamera();
  camera.setProjectionMatrix(chaos.Matrix4x4.perspective(Math.PI / 3, viewer.device.getDrawingBufferWidth() / viewer.device.getDrawingBufferHeight(), 1, 300));
  camera.mouseInputSource = sceneView;
  camera.keyboardInputSource = sceneView;
  camera.setModel(new chaos.FPSCameraModel({ moveSpeed: 0.5 }));
  scene.envLightStrength = 0.5;

  const light = new chaos.DirectionalLight(scene)
    .setColor(new chaos.Vector4(1, 1, 1, 1))
    .setCastShadow(false);
  light.lookAt(new chaos.Vector3(10, 3, 10), new chaos.Vector3(0, 0, 0), chaos.Vector3.axisPY());
  light.shadow.shadowMapSize = 2048;
  light.shadow.numShadowCascades = 4;

  common.createTestPanel(scene, sceneView, {
    width: '200px'
  });
  common.createSceneTweakPanel(scene, sceneView, { width: '200px' });
  common.createTextureViewPanel(viewer.device, sceneView, 300);
  common.createLightTweakPanel(light, sceneView, {
    width: '200px'
  });

  function loadTerrain(filename) {
    loadEarthSculptorMap(scene, filename).then(terrain => {
      terrain.castShadow = true;
      const eyePos = terrain.getBoundingVolume().toAABB().maxPoint;
      const destPos = terrain.getBoundingVolume().toAABB().center;
      camera.lookAt(eyePos, destPos, chaos.Vector3.axisPY());
      let timer: number = null;
      let rot = 0;
      sceneView.addEventListener('keydown', function (evt: chaos.REvent) {
        const keyEvent = evt as chaos.RKeyEvent;
        if (keyEvent.code === 'Space') {
          terrain.wireframe = !terrain.wireframe;
        } else if (keyEvent.code === 'KeyR') {
          if (timer !== null) {
            window.clearInterval(timer);
            terrain.scaling.set(1, 1, 1);
            terrain.rotation.identity();
            terrain.position.set(0, 0, 0);
            timer = null;
          } else {
            timer = window.setInterval(() => {
              const center = terrain.getBoundingVolume().toAABB().center;
              const t1 = chaos.Matrix4x4.translation(new chaos.Vector3(-center.x, 0, -center.z));
              const r = chaos.Quaternion.fromAxisAngle(chaos.Vector3.axisPY(), rot).toMatrix4x4();
              const t2 = chaos.Matrix4x4.translation(new chaos.Vector3(center.x, 0, center.z));
              const matrix = chaos.Matrix4x4.multiply(chaos.Matrix4x4.multiply(t2, r), t1);
              matrix.decompose(terrain.scaling, terrain.rotation, terrain.position);
              rot += 0.02;
            }, 20);
          }
        }
      });
    });
  }
  sceneView.addEventListener('layout', function (this: chaos.RElement) {
    const rect = this.getClientRect();
    camera.setProjectionMatrix(chaos.Matrix4x4.perspective(camera.getFOV(), rect.width / rect.height, camera.getNearPlane(), camera.getFarPlane()));
  });

  sceneView.addEventListener('draw', function (this: chaos.RElement, evt: chaos.REvent) {
    evt.preventDefault();
    scheme.renderScene(scene, camera);
  });

  loadTerrain('./assets/maps/map1/test1.map');
  viewer.device.runLoop(device => GUI.render());

}());


