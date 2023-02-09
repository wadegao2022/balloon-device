import * as chaospace from 'balloon-device';
import { ITestCase, doTest } from '../common';
import { testVectorType, testMatrixType, testQuaternion, testXForm } from './vector';
import { testPlane } from './plane';
import { testFrustum } from './frustum';
import { testAABB } from './aabb';
import { testSH } from './sh';


const testCases: ITestCase[] = [{
  caseName: 'Vector2 test',
  times: 100,
  execute: () => testVectorType(chaospace.Vector2, 2)
}, {
  caseName: 'Vector3 test',
  times: 100,
  execute: () => testVectorType(chaospace.Vector3, 3)
}, {
  caseName: 'Vector4 test',
  times: 100,
  execute: () => testVectorType(chaospace.Vector4, 4)
}, {
  caseName: 'Quaternion test',
  times: 100,
  execute: () => testQuaternion()
}, {
  caseName: 'Matrix3x3 test',
  times: 100,
  execute: () => testMatrixType(chaospace.Matrix3x3, 3, 3)
}, {
  caseName: 'Matrix4x4 test',
  times: 100,
  execute: () => testMatrixType(chaospace.Matrix4x4, 4, 4)
}, {
  caseName: 'XForm test',
  times: 100,
  execute: () => testXForm()
}, {
  caseName: 'Plane test',
  times: 100,
  execute: () => testPlane()
}, {
  caseName: 'Frustum test',
  times: 100,
  execute: () => testFrustum()
}, {
  caseName: 'AABB test',
  times: 100,
  execute: () => testAABB()
}, {
  caseName: 'SH test',
  times: 1,
  execute: () => testSH()
}];

class E extends chaospace.REvent {
  constructor() {
    super('xyz', false, false);
  }
}

(async function () {
  await doTest('math test', testCases);
} ());
