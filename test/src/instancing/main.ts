import * as chaos from 'balloon-device';
import * as common from '../common';

(async function () {
  const viewer = new chaos.Viewer(document.getElementById('canvas') as HTMLCanvasElement);
  await viewer.initDevice(common.getQueryString('dev') as chaos.DeviceType || 'webgl', { msaa: true });
  const guiRenderer = new chaos.GUIRenderer(viewer.device);
  const GUI = new chaos.GUI(guiRenderer);
  await GUI.deserializeFromXML(document.querySelector('#main-ui').innerHTML);
  const sceneView = GUI.document.querySelector('#scene-view');
  const group = GUI.document.querySelector('#button-group');
  sceneView.customDraw = true;
  const scene = new chaos.Scene(viewer.device);
  const scheme = new chaos.ForwardRenderScheme(viewer.device);
  const camera = scene.addCamera().setPosition(new chaos.Vector3(0, 0, 60));
  camera.mouseInputSource = sceneView;
  camera.keyboardInputSource = sceneView;
  camera.setModel(new chaos.OrbitCameraModel({ distance: camera.position.magnitude }));
  common.createTestPanel(scene, group);
  common.createSceneTweakPanel(scene, group, { width: '200px' });
  const assetManager = new chaos.AssetManager(viewer.device);

  // scene.addSkybox(await viewer.device.loadCubeTextureFromURL('./assets/images/sky2.dds'));
  const boxMaterial = new chaos.PBRMetallicRoughnessMaterial(viewer.device);
  boxMaterial.lightModel.setAlbedoMap(await assetManager.fetchTexture('./assets/images/rustediron2_basecolor.png', null, true), null, 0);
  boxMaterial.lightModel.setNormalMap(await assetManager.fetchTexture('./assets/images/rustediron2_normal.png', null, false), null, 0);
  boxMaterial.lightModel.setMetallicMap(await assetManager.fetchTexture('./assets/images/mr.png', null, false), null, 0);
  boxMaterial.lightModel.metallicIndex = 0;
  boxMaterial.lightModel.roughnessIndex = 1;
  for (let x = -20; x <= 20; x += 2) {
    for (let y = -20; y <= 20; y += 2) {
      for (let z = -20; z <= 20; z += 2) {
        const instance = chaos.Mesh.unitBox(scene);
        instance.material = boxMaterial;
        instance.position.set(x, y, z);
      }
    }
  }

  const light = new chaos.DirectionalLight(scene)
    .setCastShadow(false)
    .setColor(new chaos.Vector4(1, 1, 1, 1))
    .setRotation(chaos.Quaternion.fromAxisAngle(new chaos.Vector3(1, 1, 0).inplaceNormalize(), Math.PI * 2 / 3));

  sceneView.addEventListener('draw', function (this: chaos.RElement, evt: chaos.REvent) {
    evt.preventDefault();
    scheme.renderScene(scene, camera);
  });

  viewer.device.runLoop(device => GUI.render());

}());

