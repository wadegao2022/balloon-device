import * as chaos from 'balloon-device';
import { ITestCase, doTest } from '../common';
import { testBufferReadWrite } from './case';

const viewers: { [name: string]: chaos.Viewer } = {};
const deviceNames = window.navigator.gpu ? ['webgl2', 'webgpu'] : ['webgl2'];

const testCases: ITestCase[] = deviceNames.map(deviceName => ({
  caseName: `Read write buffer test - ${deviceName}`,
  times: 10,
  execute: () => testBufferReadWrite(viewers[deviceName].device)
}));

(async function () {
  for (const name of deviceNames) {
    viewers[name] = new chaos.Viewer(document.querySelector<HTMLCanvasElement>(`#${name}`))
    await viewers[name].initDevice(name as chaos.DeviceType);
  }
  await doTest('buffer test', testCases);
}());
