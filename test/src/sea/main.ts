import * as chaos from 'balloon-device';
import * as common from '../common';
import { createSeaProgram } from './program';

(async function () {
  const viewer = new chaos.Viewer(document.getElementById('canvas') as HTMLCanvasElement);
  await viewer.initDevice(common.getQueryString('dev') as chaos.DeviceType || 'webgl', { msaa: true });
  const guiRenderer = new chaos.GUIRenderer(viewer.device);
  const GUI = new chaos.GUI(guiRenderer);
  await GUI.deserializeFromXML(document.querySelector('#main-ui').innerHTML);
  const sceneView = GUI.document.querySelector('#scene-view');
  sceneView.customDraw = true;

  const vb = viewer.device.createStructuredBuffer(
    chaos.makeVertexBufferType(4, 'position_f32x2'),
    chaos.GPUResourceUsageFlags.BF_VERTEX | chaos.GPUResourceUsageFlags.MANAGED,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
  const rect = new chaos.Primitive(viewer.device);
  rect.setVertexBuffer(vb);
  rect.indexStart = 0;
  rect.indexCount = 4;
  rect.primitiveType = chaos.PrimitiveType.TriangleStrip;
  const program = createSeaProgram(viewer.device);
  const bindGroup = viewer.device.createBindGroup(program.bindGroupLayouts[0]);

  sceneView.addEventListener('draw', function (this: chaos.RElement, evt: chaos.REvent) {
    evt.preventDefault();
    bindGroup.setValue('uniforms', new chaos.Vector4(viewer.device.frameInfo.elapsedOverall * 0.001, 0, viewer.device.getDrawingBufferWidth(), viewer.device.getDrawingBufferHeight()));
    viewer.device.setProgram(program);
    viewer.device.setBindGroup(0, bindGroup);
    rect.draw();
  });

  viewer.device.runLoop(device => GUI.render());

}());


