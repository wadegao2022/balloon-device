import * as chaos from 'balloon-device';
import * as common from '../common';

class MyRenderScheme extends chaos.ForwardRenderScheme {
  cubemapRenderPass: chaos.RenderPass;
  cubemapRenderCamera: Map<chaos.Scene, chaos.Camera>;
  cubemapCamera: chaos.Camera;
  fb: chaos.FrameBuffer;
  colorAttachment: chaos.TextureCube;
  depthAttachment: chaos.Texture2D;
  reflectiveSphere: chaos.Mesh;
  constructor(device: chaos.Device) {
    super(device);
    this.cubemapRenderPass = device.getDeviceType() === 'webgl' ? new chaos.ForwardMultiRenderPass(this, 'cubemap') : new chaos.ForwardRenderPass(this, 'cubemap');
    this.cubemapRenderCamera = new Map();
    this.colorAttachment = device.createCubeTexture(chaos.TextureFormat.RGBA8UNORM, 512, chaos.GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE);
    this.depthAttachment = device.createTexture2D(chaos.TextureFormat.D24S8, 512, 512, chaos.GPUResourceUsageFlags.TF_NO_MIPMAP);
    this.fb = device.createFrameBuffer({
      colorAttachments: [{
        texture: this.colorAttachment,
      }],
      depthAttachment: {
        texture: this.depthAttachment,
      },
    });
  }
  renderScene(scene: chaos.Scene, camera: chaos.Camera) {
    if (this.reflectiveSphere) {
      if (!this.cubemapRenderCamera.get(scene)) {
        this.cubemapRenderCamera.set(scene, new chaos.Camera(scene));
        this.cubemapRenderCamera.get(scene).projectionMatrix = chaos.Matrix4x4.perspective(Math.PI / 2, 1, 1, 500);
      }
      this.reflectiveSphere.showState = chaos.GraphNode.SHOW_HIDE;
      this.cubemapRenderPass.renderToCubeTexture(scene, this.cubemapRenderCamera.get(scene), this.fb);
      this.reflectiveSphere.showState = chaos.GraphNode.SHOW_DEFAULT;
    }
    super.renderScene(scene, camera);
  }
  dispose() {
    super.dispose();
    this.fb.dispose();
    this.fb = null;
    this.colorAttachment.dispose();
    this.colorAttachment = null;
    this.depthAttachment.dispose();
    this.depthAttachment = null;
  }
}

class ReflectLightModel extends chaos.UnlitLightModel {
  private _reflectTexture: chaos.TextureCube;
  private _reflectTextureSampler: chaos.TextureSampler;
  constructor(reflectTexture: chaos.TextureCube) {
    super();
    this._reflectTexture = reflectTexture;
    this._reflectTextureSampler = reflectTexture?.getDefaultSampler(false);
    this.setTextureOptions('reflection', this._reflectTexture, this._reflectTextureSampler, null, null);
  }
  isNormalUsed(): boolean {
    return true;
  }
  calculateAlbedo(scope: chaos.PBInsideFunctionScope): chaos.PBShaderExp {
    const pb = scope.$builder;
    const reflectTexture = scope[this.getTextureUniformName('reflection')];
    const v = pb.normalize(pb.sub(scope.$inputs.worldPosition.xyz, scope.$query(chaos.ShaderLib.USAGE_CAMERA_POSITION)));
    const r = pb.reflect(v, pb.normalize(scope.$inputs.worldNormal));
    return pb.textureSample(reflectTexture, r);
  }
}

(async function () {
  const viewer = new chaos.Viewer(document.getElementById('canvas') as HTMLCanvasElement);
  await viewer.initDevice(common.getQueryString('dev') as chaos.DeviceType || 'webgl', { msaa: true });
  const guiRenderer = new chaos.GUIRenderer(viewer.device);
  const GUI = new chaos.GUI(guiRenderer);

  await GUI.deserializeFromXML(document.querySelector('#main-ui').innerHTML);
  const sceneView = GUI.document.querySelector('#scene-view');
  sceneView.customDraw = true;
  const scene = new chaos.Scene(viewer.device);
  const scheme = new MyRenderScheme(viewer.device);
  const camera = scene.addCamera().lookAt(new chaos.Vector3(0, 8, 30), new chaos.Vector3(0, 0, 0), chaos.Vector3.axisPY());
  camera.setProjectionMatrix(chaos.Matrix4x4.perspective(Math.PI / 3, viewer.device.getDrawingBufferWidth() / viewer.device.getDrawingBufferHeight(), 1, 160));
  camera.mouseInputSource = sceneView;
  camera.keyboardInputSource = sceneView;
  camera.setModel(new chaos.OrbitCameraModel({ distance: camera.position.magnitude }));

  const reflectionTexture = scheme.fb.getColorAttachments()[0] as chaos.TextureCube;
  const material = new chaos.StandardMaterial<ReflectLightModel>(scene.device);
  material.lightModel = new ReflectLightModel(reflectionTexture);
  const cubeTexture = await viewer.device.loadCubeTextureFromURL('./assets/images/sky2.dds');
  scene.addSkybox(cubeTexture);
  scheme.reflectiveSphere = new chaos.SphereMesh(scene, { radius: 10, material: material });

  const light = new chaos.DirectionalLight(scene)
    .setColor(new chaos.Vector4(1, 1, 1, 1))
    .setIntensity(1)
    .setCastShadow(false);
  light.lookAt(new chaos.Vector3(10, 10, 10), new chaos.Vector3(0, 0, 0), chaos.Vector3.axisPY());

  const stdMat = new chaos.PBRMetallicRoughnessMaterial(scene.device);
  stdMat.lightModel.setAlbedoMap(await viewer.device.loadTexture2DFromURL('./assets/images/rustediron2_basecolor.png'), null, 0);
  stdMat.lightModel.setNormalMap(await viewer.device.loadTexture2DFromURL('./assets/images/rustediron2_normal.png', null, chaos.GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE), null, 0);
  stdMat.lightModel.setMetallicMap(await viewer.device.loadTexture2DFromURL('./assets/images/mr.png', null, chaos.GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE), null, 0);
  stdMat.lightModel.metallicIndex = 0;
  stdMat.lightModel.roughnessIndex = 1;

  const sphere2 = chaos.Mesh.unitSphere(scene);
  sphere2.material = stdMat;
  sphere2.scaling = new chaos.Vector3(3, 3, 3);

  const sphere3 = chaos.Mesh.unitSphere(scene);
  sphere3.material = stdMat;
  sphere3.scaling = new chaos.Vector3(3, 3, 3);

  const sphere4 = chaos.Mesh.unitSphere(scene);
  sphere4.material = stdMat;
  sphere4.scaling = new chaos.Vector3(3, 3, 3);

  sceneView.addEventListener('layout', function (this: chaos.RElement) {
    const rect = this.getClientRect();
    camera.setProjectionMatrix(chaos.Matrix4x4.perspective(camera.getFOV(), rect.width / rect.height, camera.getNearPlane(), camera.getFarPlane()));
  });

  sceneView.addEventListener('keyup', function (evt: chaos.REvent) {
    const keyEvent = evt as chaos.RKeyEvent;
    console.log(keyEvent.code, keyEvent.key);
    if (keyEvent.code === 'Space') {
      if (sphere2.attached) {
        sphere2.parent = null;
      } else {
        sphere2.parent = scene.rootNode;
      }
      if (sphere3.attached) {
        sphere3.parent = null;
      } else {
        sphere3.parent = scene.rootNode;
      }
    }
  });

  sceneView.addEventListener('draw', function (this: chaos.RElement, evt: chaos.REvent) {
    evt.preventDefault();
    const elapsed = viewer.device.frameInfo.elapsedOverall;
    sphere2.position.set(20 * Math.sin(elapsed * 0.003), 0, 20 * Math.cos(elapsed * 0.003));
    sphere3.position.set(0, 20 * Math.sin(elapsed * 0.002), 20 * Math.cos(elapsed * 0.002));
    sphere4.position.set(20 * Math.sin(elapsed * 0.002), 20 * Math.cos(elapsed * 0.002), 0);
    scheme.renderScene(scene, camera);
  });

  viewer.device.runLoop(device => GUI.render());

}());


