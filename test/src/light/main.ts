import * as chaos from 'balloon-device';
import * as common from '../common';

(async function () {
  const viewer = new chaos.Viewer(document.getElementById('canvas') as HTMLCanvasElement);
  await viewer.initDevice(common.getQueryString('dev') as chaos.DeviceType || 'webgl', { msaa: false });
  const guiRenderer = new chaos.GUIRenderer(viewer.device);
  const GUI = new chaos.GUI(guiRenderer);
  await GUI.deserializeFromXML(document.querySelector('#main-ui').innerHTML);
  const sceneView = GUI.document.querySelector('#scene-view');
  sceneView.customDraw = true;
  const scene = new chaos.Scene(viewer.device);
  const scheme = new chaos.ForwardRenderScheme(viewer.device);
  const camera = scene.addCamera().lookAt(new chaos.Vector3(0, 8, 30), new chaos.Vector3(0, 8, 0), chaos.Vector3.axisPY());
  camera.setProjectionMatrix(chaos.Matrix4x4.perspective(Math.PI / 3, viewer.device.getDrawingBufferWidth() / viewer.device.getDrawingBufferHeight(), 1, 260));
  camera.mouseInputSource = sceneView;
  camera.keyboardInputSource = sceneView;
  camera.setModel(new chaos.OrbitCameraModel({ distance: camera.position.magnitude }));

  common.createTestPanel(scene, sceneView, {
    width: '200px'
  });
  common.createSceneTweakPanel(scene, sceneView, { width: '200px' });
  common.createTextureViewPanel(viewer.device, sceneView, 300);

  const directionlight = new chaos.DirectionalLight(scene);
  directionlight.setCastShadow(false).setColor(new chaos.Vector4(1, 0, 1, 1));
  directionlight.lookAt(new chaos.Vector3(0, 28, 0), new chaos.Vector3(0, 0, 0), chaos.Vector3.axisPX());
  directionlight.shadow.shadowMapSize = 1024;
  common.createLightTweakPanel(directionlight, sceneView, {
    width: '200px'
  });

  // const pointlight = null;
  const pointlight = new chaos.SpotLight(scene)
    .setPosition(new chaos.Vector3(0, 28, 0))
    .setRotation(chaos.Quaternion.fromAxisAngle(chaos.Vector3.axisPX(), -Math.PI * 0.25))
    .setRange(50)
    .setIntensity(8)
    .setCutoff(Math.PI * 0.2)
    .setColor(new chaos.Vector4(1, 1, 0, 1))
    .setCastShadow(false);
  pointlight.shadow.shadowMapSize = 1024;
  common.createLightTweakPanel(pointlight, sceneView, {
    width: '200px'
  });

  const ballMaterial = new chaos.UnlitMaterial(viewer.device);
  ballMaterial.lightModel.albedo = new chaos.Vector4(1, 1, 0, 1);
  const ball = chaos.Mesh.unitSphere(scene);
  ball.scaling = new chaos.Vector3(1, 1, 1);
  ball.castShadow = false;
  ball.material = ballMaterial;
  ball.reparent(pointlight);

  /*
  const spotlight = new chaos.SpotLight(null)
  .setRange(100)
  .setCutoff(Math.PI * 0.2)
  .setColor(new chaos.Vector4(1, 1, 1, 1))
  .setCastShadow(true);
new chaos.PointLight(scene, null)
  .setPosition(new chaos.Vector3(-20, 20, 5))
  .setRange(30)
  .setColor(new chaos.Vector4(0.4, 0.8, 0.7, 1));
new chaos.HemiSphericLight(scene, null)
  .setColorDown(new chaos.Vector4(0.1, 0.2, 0, 1))
  .setColorUp(new chaos.Vector4(0, 0.2, 0.4, 1));
*/
  //const sphereMaterial = new chaos.StandardMaterial(viewer.device);
  //const lm = new chaos.PBRLightModel();
  //lm.albedo = new chaos.Vector4(1, 1, 0, 1);
  //lm.metallic = 0.8;
  //lm.roughness = 0.2;
  //sphereMaterial.lightModel = lm;
  //new chaos.SphereMesh(scene, null, { radius: 8, verticalDetail: 40, horizonalDetail: 40 }).setPosition(new chaos.Vector3(0, 8, 0)).material = sphereMaterial;

  const planeMaterial = new chaos.PBRMetallicRoughnessMaterial(viewer.device);
  planeMaterial.lightModel.metallic = 0.1;
  planeMaterial.lightModel.roughness = 0.6;

  const floor = chaos.Mesh.unitBox(scene);
  floor.scaling = new chaos.Vector3(50, 10, 50);
  floor.position = new chaos.Vector3(-25, -5, -25);
  floor.castShadow = true;
  floor.material = planeMaterial;

  const sphere = chaos.Mesh.unitSphere(scene);
  sphere.scaling = new chaos.Vector3(10, 10, 10);
  sphere.position = new chaos.Vector3(0, 20, 0);
  sphere.material = planeMaterial;
  /*
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      const box = chaos.Mesh.unitBox(scene);
      box.scaling = new chaos.Vector3(5, 20, 5);
      box.position = new chaos.Vector3(i * 30, 10, j * 30);
      box.material = planeMaterial;
    }
  }
  */

  sceneView.addEventListener('layout', function (this: chaos.RElement) {
    const rect = this.getClientRect();
    camera.setProjectionMatrix(chaos.Matrix4x4.perspective(camera.getFOV(), rect.width / rect.height, camera.getNearPlane(), camera.getFarPlane()));
  });

  let pause = false;
  sceneView.addEventListener('keydown', function (evt: chaos.REvent) {
    const keyEvent = evt as chaos.RKeyEvent;
    if (keyEvent.code === 'KeyP') {
      pause = !pause;
    }
  });

  scene.addEventListener('tick', () => {
    if (!pause) {
      const elapsed = viewer.device.frameInfo.elapsedOverall;
      if (pointlight) {
        pointlight.position.x = 15 * Math.sin(elapsed / 3000);
        pointlight.position.y = 25;
        pointlight.position.z = 15 * Math.cos(elapsed / 3000);
        pointlight.position.y = 30 + 15 * Math.sin(elapsed / 3000)
      }
      if (directionlight) {
        directionlight.setRotation(chaos.Quaternion.fromAxisAngle(chaos.Vector3.axisNX(), Math.PI * (0.5 + 0.25 * Math.sin(elapsed / 2000))));
        directionlight.lookAt(new chaos.Vector3(0, 28, 0), new chaos.Vector3(40 * Math.cos(elapsed / 2000), 0, 40 * Math.sin(elapsed / 2000)), chaos.Vector3.axisPY());
      }
    }
  });

  sceneView.addEventListener('draw', function (this: chaos.RElement, evt: chaos.REvent) {
    evt.preventDefault();
    scheme.renderScene(scene, camera);
  });

  viewer.device.runLoop(device => GUI.render());

}());


