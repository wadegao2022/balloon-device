import * as chaospace from 'balloon-device';
import { assert, rand, randInt, randNonZero, toFloat32 } from './common';

type VectorType = chaospace.Vector2 | chaospace.Vector3 | chaospace.Vector4;
interface VectorConstructor {
  new(...args: any[]): VectorType;
  add: Function;
  sub: Function;
  mul: Function;
  div: Function;
  scale: Function;
  dot?: Function;
  cross?: Function;
  normalize?: Function;
}

type MatrixType = chaospace.Matrix3x3 | chaospace.Matrix4x4;
interface MatrixConstructor {
  new(...args: any[]): MatrixType;
  add: Function;
  sub: Function;
  mul: Function;
  div: Function;
  scale: Function;
  identity: Function;
  inverse: Function;
  multiply: Function;
  translation?: Function;
  scaling: Function;
  rotationX: Function;
  rotationY: Function;
  rotationZ: Function;
  rotation: Function;
  translateRight?: Function;
  translateLeft?: Function;
  scaleRight?: Function;
  scaleLeft?: Function;
  rotateRight?: Function;
  rotateLeft?: Function;
}

export function testVectorType(c: VectorConstructor, size: 2 | 3 | 4 | 16) {
  function randVec(): VectorType {
    const values = [randNonZero(), randNonZero(), randNonZero(), randNonZero()].slice(0, size);
    return new c(values);
  }
  (function testConstructor() {
    const v1 = new c();
    assert(v1.size === size, 'constructor test failed');
    for (let i = 0; i < size; i++) {
      assert(v1.getArray()[i] === 0, 'default constructor test failed');
    }
    const v2 = randVec();
    const v3 = new c(v2);
    assert(v2.equalsTo(v3), 'copy constructor test failed');
    const values = [rand(), rand(), rand(), rand()].slice(0, size);
    const v4 = new c(values);
    for (let i = 0; i < size; i++) {
      assert(Math.abs(v4.getArray()[i] - values[i]) < 0.01, 'construct from array failed');
    }
  })();

  (function testMathOp() {
    const opAdd = (a: number, b: number) => toFloat32(a + b);
    const opSub = (a: number, b: number) => toFloat32(a - b);
    const opMul = (a: number, b: number) => toFloat32(a * b);
    const opDiv = (a: number, b: number) => toFloat32(a / b);
    const opList = [
      [c.add, c.prototype.addBy, opAdd, 'add'],
      [c.sub, c.prototype.subBy, opSub, 'sub'],
      [c.mul, c.prototype.mulBy, opMul, 'mul'],
      [c.div, c.prototype.divBy, opDiv, 'div']
    ];
    for (const op of opList) {
      const v1 = randVec();
      const v2 = randVec();
      const v3 = new c();
      const v4 = op[0](v1, v2);
      op[0](v1, v2, v3);
      for (let i = 0; i < size; i++) {
        const t = op[2](v1.getArray()[i], v2.getArray()[i]);
        assert(Math.abs(t - v3.getArray()[i]) < 0.01 && Math.abs(t - v4.getArray()[i]) < 0.01, `${op[3]} failed`);
      }
      op[1].bind(v1)(v2 as any);
      assert(v1.equalsTo(v3), `${op[3]} failed`)
    }
    const factor = rand();
    const v5 = randVec();
    const v6 = c.scale(v5, factor);
    const v7 = new c();
    c.scale(v5, factor, v7);
    for (let i = 0; i < size; i++) {
      const t = toFloat32(v5.getArray()[i] * factor);
      assert(Math.abs(v6.getArray()[i] - t) < 0.01 && Math.abs(v7.getArray()[i] - t) < 0.01, 'scale failed');
    }
    v5.scaleBy(factor);
    assert(v5.equalsTo(v6), 'scaleBy failed');
  })();

  if (c.normalize) {
    (function testNormalize() {
      const v1 = randVec();
      const v2 = c.normalize(v1);
      const v3 = new c();
      c.normalize(v1, v3);
      v1.inplaceNormalize();
      assert(v1.equalsTo(v2) && v1.equalsTo(v3) && chaospace.numberEquals(v1.magnitude, 1), 'normalize failed');
    })();
  }

  if (c.dot) {
    (function testDotProduct() {
      const v1 = randVec();
      assert(chaospace.numberEquals(c.dot(v1, v1), v1.magnitudeSq), 'dot production failed');
    })();
  }

  if (c.cross && size === 3) {
    (function testCrossProduct() {
      const v1 = new c(1, 0, 0);
      const v2 = new c(0, 1, 0);
      const v3 = c.cross(v1, v2);
      const v4 = new c();
      c.cross(v1, v2, v4);
      assert(v3.equalsTo(v4) && v3.equalsTo(new c(0, 0, 1)), 'cross product failed');
      const v5 = c.cross(v1, v1);
      assert(v5.equalsTo(new c(0, 0, 0)), 'cross product failed');
      const v6 = c.normalize(randVec());
      const v7 = c.normalize(randVec());
      const v8 = c.cross(v6, v7);
      c.cross(v7, v8, v6);
      const d1 = c.dot(v6, v7);
      const d2 = c.dot(v7, v8);
      const d3 = c.dot(v8, v6);
      assert(chaospace.numberEquals(d1, 0) && chaospace.numberEquals(d2, 0) && chaospace.numberEquals(d3, 0), 'cross product failed');
    })();
  }
}

export function testQuaternion() {
  function randQuaternion() {
    const q = new chaospace.Quaternion(rand(), rand(), rand(), rand());
    return q.inplaceNormalize();
  }
  (function testConstructor() {
    const q1 = new chaospace.Quaternion();
    assert(q1.x === 0 && q1.y === 0 && q1.z === 0 && q1.w === 0, 'default constructor failed');
    const x = rand();
    const y = rand();
    const z = rand();
    const w = rand();
    const q2 = new chaospace.Quaternion(x, y, z, w);
    assert(Math.abs(q2.x - x) < 0.01 && Math.abs(q2.y - y) < 0.01 && Math.abs(q2.z - z) < 0.01 && Math.abs(q2.w - w) < 0.01, 'assign constructor failed');
    const q3 = new chaospace.Quaternion([x, y, z, w]);
    assert(q3.x === q2.x && q3.y === q2.y && q3.z === q2.z && q3.w === q2.w, 'array constructor failed');
    const axis = new chaospace.Vector3(-0.10452544552113772, 0.43864725489574524, -0.8925598114474093); //new chaospace.Vector3(rand(), rand(), rand()).inplaceNormalize();
    const angle = 3.1390559093244788; //rand (0, Math.PI);
    const axisAngle = new chaospace.Quaternion(chaospace.Matrix3x3.rotation(axis, angle)).getAxisAngle();
    assert(axisAngle.xyz().equalsTo(axis) && chaospace.numberEquals(axisAngle.w, angle), 'chaospace.Matrix3x3 constructor failed');
    const axisAngle2 = new chaospace.Quaternion(chaospace.Matrix4x4.rotation(axis, angle)).getAxisAngle();
    assert(axisAngle2.xyz().equalsTo(axis) && chaospace.numberEquals(axisAngle2.w, angle), 'chaospace.Matrix4x4 constructor failed');
  })();
  (function testNormalize() {
    const q1 = new chaospace.Quaternion(rand(), rand(), rand(), rand()).inplaceNormalize();
    assert(chaospace.numberEquals(q1.magnitude, 1), 'normalize failed');
  })();
  (function testVetorToVector() {
    const v1 = new chaospace.Vector3(rand(), rand(), rand()).inplaceNormalize();
    const v2 = new chaospace.Vector3(rand(), rand(), rand()).inplaceNormalize();
    const q1 = chaospace.Quaternion.unitVectorToUnitVector(v1, v2);
    const v3 = q1.transform(v1);
    assert(v2.equalsTo(v3), 'vector to vector rotation failed');
  })();
  (function testAngleBetween() {
    const q1 = new chaospace.Quaternion(rand(), rand(), rand(), rand()).inplaceNormalize();
    const q2 = new chaospace.Quaternion(rand(), rand(), rand(), rand()).inplaceNormalize();
    const angle = chaospace.Quaternion.angleBetween(q1, q2);
    const axis1 = q1.getAxisAngle().xyz();
    const axis2 = q2.getAxisAngle().xyz();
    const angle2 = Math.acos(chaospace.Vector3.dot(axis1, axis2));
    assert(chaospace.numberEquals(angle, angle2), 'angle between failed');
  });
  (function testEulerAngle() {
    const angle1 = rand(-Math.PI, Math.PI);
    const angle2 = rand(-Math.PI, Math.PI);
    const angle3 = rand(-Math.PI, Math.PI);
    const matX = chaospace.Matrix3x3.rotationX(angle1);
    const matY = chaospace.Matrix3x3.rotationY(angle2);
    const matZ = chaospace.Matrix3x3.rotationZ(angle3);
    const testMat = new chaospace.Matrix3x3();
    const rotMatrixXYZ = chaospace.Matrix3x3.identity().multiplyRightAffine(matX).multiplyRightAffine(matY).multiplyRightAffine(matZ);
    chaospace.Quaternion.fromEulerAngle(angle1, angle2, angle3, 'XYZ').toMatrix(testMat);
    assert(testMat.equalsTo(rotMatrixXYZ), 'euler angle XYZ failed');
    const rotMatrixXZY = chaospace.Matrix3x3.identity().multiplyRightAffine(matX).multiplyRightAffine(matZ).multiplyRightAffine(matY);
    chaospace.Quaternion.fromEulerAngle(angle1, angle2, angle3, 'XZY').toMatrix(testMat);
    assert(testMat.equalsTo(rotMatrixXZY), 'euler angle XZY failed');
    const rotMatrixYXZ = chaospace.Matrix3x3.identity().multiplyRightAffine(matY).multiplyRightAffine(matX).multiplyRightAffine(matZ);
    chaospace.Quaternion.fromEulerAngle(angle1, angle2, angle3, 'YXZ').toMatrix(testMat);
    assert(testMat.equalsTo(rotMatrixYXZ), 'euler angle YXZ failed');
    const rotMatrixYZX = chaospace.Matrix3x3.identity().multiplyRightAffine(matY).multiplyRightAffine(matZ).multiplyRightAffine(matX);
    chaospace.Quaternion.fromEulerAngle(angle1, angle2, angle3, 'YZX').toMatrix(testMat);
    assert(testMat.equalsTo(rotMatrixYZX), 'euler angle YZX failed');
    const rotMatrixZXY = chaospace.Matrix3x3.identity().multiplyRightAffine(matZ).multiplyRightAffine(matX).multiplyRightAffine(matY);
    chaospace.Quaternion.fromEulerAngle(angle1, angle2, angle3, 'ZXY').toMatrix(testMat);
    assert(testMat.equalsTo(rotMatrixZXY), 'euler angle ZXY failed');
    const rotMatrixZYX = chaospace.Matrix3x3.identity().multiplyRightAffine(matZ).multiplyRightAffine(matY).multiplyRightAffine(matX);
    chaospace.Quaternion.fromEulerAngle(angle1, angle2, angle3, 'ZYX').toMatrix(testMat);
    assert(testMat.equalsTo(rotMatrixZYX), 'euler angle ZYX failed');
  })();
  (function testSlerp() {
    const axis = new chaospace.Vector3(rand(), rand(), rand()).inplaceNormalize();
    const a1 = rand(0, Math.PI / 2);
    const a2 = a1 + Math.PI / 2;
    const t = rand(0, 1);
    const a3 = a1 * (1 - t) + a2 * t;
    const q1 = chaospace.Quaternion.fromAxisAngle(axis, a1);
    const q2 = chaospace.Quaternion.fromAxisAngle(axis, a2);
    const q3 = chaospace.Quaternion.slerp(q1, q2, t);
    const q4 = chaospace.Quaternion.fromAxisAngle(axis, a3);
    const axisAngle1 = q3.getAxisAngle();
    const axisAngle2 = q4.getAxisAngle();
    assert(axisAngle1.equalsTo(axisAngle2), 'slerp test failed');
  })();
}

export function testMatrixType(c: MatrixConstructor, rows: number, cols: number) {
  const size = rows * cols;
  function randMatrix(): MatrixType {
    const m = new c();
    const v = m.getArray();
    for (let i = 0; i < m.size; i++) {
      v[i] = randNonZero();
    }
    return m;
  }
  (function testConstructor() {
    const m1 = new c();
    assert(m1.size === size, 'constructor test failed');
    for (let i = 0; i < size; i++) {
      assert(m1.getArray()[i] === 0, 'default constructor test failed');
    }
    const m2 = randMatrix();
    const m3 = new c(m2);
    assert(m2.equalsTo(m3), 'copy constructor test failed');
    const values = Array<number>(size);
    for (let i = 0; i < size; i++) {
      values[i] = rand();
    }
    const m4 = new c(values);
    for (let i = 0; i < size; i++) {
      assert(Math.abs(m4.getArray()[i] - values[i]) < 0.01, 'construct from array failed');
    }
  })();

  (function testMathOp() {
    const opAdd = (a: number, b: number) => toFloat32(a + b);
    const opSub = (a: number, b: number) => toFloat32(a - b);
    const opMul = (a: number, b: number) => toFloat32(a * b);
    const opDiv = (a: number, b: number) => toFloat32(a / b);
    const opList = [
      [c.add, c.prototype.addBy, opAdd, 'add'],
      [c.sub, c.prototype.subBy, opSub, 'sub'],
      [c.mul, c.prototype.mulBy, opMul, 'mul'],
      [c.div, c.prototype.divBy, opDiv, 'div']
    ];
    for (const op of opList) {
      const m1 = randMatrix();
      const m2 = randMatrix();
      const m3 = new c();
      const m4 = op[0](m1, m2);
      op[0](m1, m2, m3);
      for (let i = 0; i < size; i++) {
        const t = op[2](m1.getArray()[i], m2.getArray()[i]);
        assert(Math.abs(t - m3.getArray()[i]) < 0.01 && Math.abs(t - m4.getArray()[i]) < 0.01, `${op[3]} failed`);
      }
      op[1].bind(m1)(m2 as any);
      assert(m1.equalsTo(m3), `${op[3]} failed`)
    }
    const factor = rand();
    const m5 = randMatrix();
    const m6 = c.scale(m5, factor);
    const m7 = new c();
    c.scale(m5, factor, m7);
    for (let i = 0; i < size; i++) {
      const t = m5.getArray()[i] * factor;
      assert(Math.abs(m6.getArray()[i] - t) < 0.01 && Math.abs(m7.getArray()[i] - t) < 0.01, 'scale failed');
    }
    m5.scaleBy(factor);
    assert(m5.equalsTo(m6), 'scaleBy failed');
  })();
  (function testIdentity() {
    const m1 = new c();
    m1.identity();
    const m2 = c.identity();
    for (let i = 0; i < size; i++) {
      const val = i % (cols + 1) === 0 ? 1 : 0;
      assert(Math.abs(m1.getArray()[i] - val) < 0.01 && Math.abs(m2.getArray()[i] - val) < 0.01, 'identity failed');
    }
  })();
  (function testInverse() {
    const m1 = randMatrix();
    const m2 = c.inverse(m1);
    const m3 = new c();
    c.inverse(m1, m3);
    assert(m2.equalsTo(m3), 'inverse failed');
    const m4 = c.multiply(m1, m2);
    assert(m4.equalsTo(c.identity()), 'inverse failed');
  })();
  if (c.translation) {
    (function testTranslation() {
      const t = { x: rand(), y: rand(), z: rand() };
      const v1 = { x: rand(), y: rand(), z: rand() };
      const m = c.translation(t);
      const v2 = m.transformPoint(v1);
      assert(chaospace.numberEquals(v2.x, v1.x + t.x) && chaospace.numberEquals(v2.y, v1.y + t.y) && chaospace.numberEquals(v2.z, v1.z + t.z), 'translation failed');
      if (rows === 4 && cols === 4) {
        const m1 = randMatrix() as chaospace.Matrix4x4;
        const t1 = { x: rand(), y: rand(), z: rand() };
        const m2 = m1.multiplyRight(chaospace.Matrix4x4.translation(t1));
        m1.translateRight(t1);
        assert(m1.equalsTo(m2), 'translateRight test failed');
        const m3 = randMatrix() as chaospace.Matrix4x4;
        const t2 = { x: rand(), y: rand(), z: rand() };
        const m4 = m3.multiplyLeft(chaospace.Matrix4x4.translation(t2));
        m3.translateLeft(t2);
        assert(m3.equalsTo(m4), 'translateLeft test failed');
      }
    })();
  }
  (function testSaling() {
    const s = { x: rand(), y: rand(), z: rand() };
    const v1 = { x: rand(), y: rand(), z: rand() };
    const m = c.scaling(s);
    const v2 = m.transformPoint(v1);
    assert(chaospace.numberEquals(v2.x, v1.x * s.x) && chaospace.numberEquals(v2.y, v1.y * s.y) && chaospace.numberEquals(v2.z, v1.z * s.z), 'scaling failed');
    if (rows === 4 && cols === 4) {
      const m1 = randMatrix() as chaospace.Matrix4x4;
      const s1 = { x: rand(), y: rand(), z: rand() };
      const m2 = m1.multiplyRight(chaospace.Matrix4x4.scaling(s1));
      m1.scaleRight(s1);
      assert(m1.equalsTo(m2), 'scaleRight test failed');
      const m3 = randMatrix() as chaospace.Matrix4x4;
      const s2 = { x: rand(), y: rand(), z: rand() };
      const m4 = m3.multiplyLeft(chaospace.Matrix4x4.scaling(s2));
      m3.scaleLeft(s2);
      assert(m3.equalsTo(m4), 'scaleLeft test failed');
    }
  })();
  (function testRotationX() {
    const angle = rand(-Math.PI * 2, Math.PI * 2);
    const v1 = { x: 0, y: 1, z: 0 };
    const m = c.rotationX(angle);
    const v2 = m.transformPoint(v1);
    assert(chaospace.numberEquals(v2.x, 0) && chaospace.numberEquals(v2.y, Math.cos(angle)) && chaospace.numberEquals(v2.z, Math.sin(angle)), 'rotationX failed');
  })();
  (function testRotationY() {
    const angle = rand(-Math.PI * 2, Math.PI * 2);
    const v1 = { x: 0, y: 0, z: 1 };
    const m = c.rotationY(angle);
    const v2 = m.transformPoint(v1);
    assert(chaospace.numberEquals(v2.x, Math.sin(angle)) && chaospace.numberEquals(v2.y, 0) && chaospace.numberEquals(v2.z, Math.cos(angle)), 'rotationY failed');
  })();
  (function testRotationZ() {
    const angle = rand(-Math.PI * 2, Math.PI * 2);
    const v1 = { x: 1, y: 0, z: 0 };
    const m = c.rotationZ(angle);
    const v2 = m.transformPoint(v1);
    assert(chaospace.numberEquals(v2.x, Math.cos(angle)) && chaospace.numberEquals(v2.y, Math.sin(angle)) && chaospace.numberEquals(v2.z, 0), 'rotationZ failed');
  })();
  (function testRotation() {
    const angle = rand(-Math.PI * 2, Math.PI * 2);
    const v1 = { x: rand(), y: rand(), z: rand() };
    const vx1 = c.rotation({ x: 1, y: 0, z: 0 }, angle).transformPoint(v1);
    const vx2 = c.rotationX(angle).transformPoint(v1);
    assert(vx1.equalsTo(vx2), 'rotation failed');
    const vy1 = c.rotation({ x: 0, y: 1, z: 0 }, angle).transformPoint(v1);
    const vy2 = c.rotationY(angle).transformPoint(v1);
    assert(vy1.equalsTo(vy2), 'rotation failed');
    const vz1 = c.rotation({ x: 0, y: 0, z: 1 }, angle).transformPoint(v1);
    const vz2 = c.rotationZ(angle).transformPoint(v1);
    assert(vz1.equalsTo(vz2), 'rotation failed');
    if (rows === 4 && cols === 4) {
      const m1 = randMatrix() as chaospace.Matrix4x4;
      const r1 = chaospace.Matrix4x4.rotation(new chaospace.Vector3(rand(), rand(), rand()).inplaceNormalize(), rand(0, Math.PI * 2));
      const m2 = m1.multiplyRight(r1);
      m1.rotateRight(r1);
      assert(m1.equalsTo(m2), 'rotateRight test failed');
      const m3 = randMatrix() as chaospace.Matrix4x4;
      const r2 = chaospace.Matrix4x4.rotation(new chaospace.Vector3(rand(), rand(), rand()).inplaceNormalize(), rand(0, Math.PI * 2));
      const m4 = m3.multiplyLeft(r2);
      m3.rotateLeft(r2);
      assert(m3.equalsTo(m4), 'rotateLeft test failed');
    }
  })();
  if (rows === 4 && cols === 4) {
    (function testDecompose() {
      const eye = new chaospace.Vector3(rand(), rand(), rand()).inplaceNormalize().scaleBy(100);
      const target = new chaospace.Vector3(rand(), rand(), rand()).inplaceNormalize().scaleBy(100);
      const up = new chaospace.Vector3(rand(), rand(), rand()).inplaceNormalize();
      const matrix = chaospace.Matrix4x4.lookAt(eye, target, up);
      const t = new chaospace.Vector3();
      const s = new chaospace.Vector3();
      const r = new chaospace.Matrix4x4();
      matrix.decompose(s, r, t);
      const matrix2 = chaospace.Matrix4x4.translation(t).multiplyRightAffine(r).multiplyRightAffine(chaospace.Matrix4x4.scaling(s));
      assert(matrix.equalsTo(matrix2), 'decompose test failed');
      const eye2 = new chaospace.Vector3();
      const target2 = new chaospace.Vector3();
      const up2 = new chaospace.Vector3();
      matrix.decomposeLookAt(eye2, target2, up2);
      matrix2.lookAt(eye2, target2, up2);
      assert(matrix.equalsTo(matrix2), 'decompose test failed');
    })();
    (function testProjection() {
      const fovY = rand(0.1, 0.8 * Math.PI);
      const aspect = rand(0.1, 10);
      const near = rand(0.1, 10);
      const far = rand(100, 1000);
      const top = toFloat32(near * Math.tan(fovY / 2));
      const bottom = toFloat32(-top);
      const right = toFloat32(top * aspect);
      const left = toFloat32(-right);
      const m1 = chaospace.Matrix4x4.perspective(fovY, aspect, near, far);
      const m2 = chaospace.Matrix4x4.frustum(left, right, bottom, top, near, far);
      const vmin = new chaospace.Vector4(-1, -1, -1, 1);
      const vmax = new chaospace.Vector4(1, 1, 1, 1);
      assert(m1.equalsTo(m2), 'projection test failed');
      const vx1 = m2.transformPoint(new chaospace.Vector4(left, bottom, -near, 1));
      vx1.scaleBy(1 / vx1.w);
      const vx2 = m2.transformPoint(new chaospace.Vector4(right * far / near, top * far / near, -far, 1));
      vx2.scaleBy(1 / vx2.w);
      assert(vx1.equalsTo(vmin), 'projection test failed');
      assert(vx2.equalsTo(vmax), 'projection test failed');
      const leftFar = toFloat32(left * far / near);
      const rightFar = toFloat32(right * far / near);
      const bottomFar = toFloat32(bottom * far / near);
      const topFar = toFloat32(top * far / near);
      const v = [
        new chaospace.Vector3(left, bottom, -near),
        new chaospace.Vector3(right, bottom, -near),
        new chaospace.Vector3(right, top, -near),
        new chaospace.Vector3(left, top, -near),
        new chaospace.Vector3(leftFar, bottomFar, -far),
        new chaospace.Vector3(rightFar, bottomFar, -far),
        new chaospace.Vector3(rightFar, topFar, -far),
        new chaospace.Vector3(leftFar, topFar, -far),
      ];
      const v2 = [
        new chaospace.Vector4(-1, -1, -1, 1),
        new chaospace.Vector4(1, -1, -1, 1),
        new chaospace.Vector4(1, 1, -1, 1),
        new chaospace.Vector4(-1, 1, -1, 1),
        new chaospace.Vector4(-1, -1, 1, 1),
        new chaospace.Vector4(1, -1, 1, 1),
        new chaospace.Vector4(1, 1, 1, 1),
        new chaospace.Vector4(-1, 1, 1, 1),
      ];
      for (let i = 0; i < 8; i++) {
        const t = m1.transformPoint(v[i]);
        t.scaleBy(1 / t.w);
        assert(v2[i].equalsTo(t), 'projection test failed');
      }
      const m3 = chaospace.Matrix4x4.ortho(left, right, bottom, top, near, far);
      const v3 = [
        new chaospace.Vector3(left, bottom, -near),
        new chaospace.Vector3(right, bottom, -near),
        new chaospace.Vector3(right, top, -near),
        new chaospace.Vector3(left, top, -near),
        new chaospace.Vector3(left, bottom, -far),
        new chaospace.Vector3(right, bottom, -far),
        new chaospace.Vector3(right, top, -far),
        new chaospace.Vector3(left, top, -far),
      ];
      const v4 = [
        new chaospace.Vector4(-1, -1, -1, 1),
        new chaospace.Vector4(1, -1, -1, 1),
        new chaospace.Vector4(1, 1, -1, 1),
        new chaospace.Vector4(-1, 1, -1, 1),
        new chaospace.Vector4(-1, -1, 1, 1),
        new chaospace.Vector4(1, -1, 1, 1),
        new chaospace.Vector4(1, 1, 1, 1),
        new chaospace.Vector4(-1, 1, 1, 1),
      ];
      for (let i = 0; i < 8; i++) {
        const t = m3.transformPoint(v3[i]);
        t.scaleBy(1 / t.w);
        assert(v4[i].equalsTo(t), 'projection test failed');
      }
    })();
  }
}

export function testXForm() {
  function multiplyMatrices(matrices: chaospace.Matrix4x4[], out: chaospace.Matrix4x4[], outInv: chaospace.Matrix4x4[]) {
    out[0] = new chaospace.Matrix4x4(matrices[0]);
    outInv[0] = chaospace.Matrix4x4.inverseAffine(out[0]);
    for (let i = 1; i < matrices.length; i++) {
      out[i] = chaospace.Matrix4x4.multiply(out[i - 1], matrices[i]);
      outInv[i] = chaospace.Matrix4x4.inverseAffine(out[i]);
    }
  }
  function combinedMatrices(matrices: chaospace.Matrix4x4[], matricesInv: chaospace.Matrix4x4[], start: number, end: number) {
    if (start === 0) {
      return matrices[end];
    } else {
      return chaospace.Matrix4x4.multiplyAffine(matricesInv[start - 1], matrices[end]);
    }
  }
  function randomIndices(minIndex: number, maxIndex: number, size: number) {
    const arr = Array<number>(size);
    for (let i = 0; i < size; i++) {
      arr[i] = randInt(minIndex, maxIndex);
    }
    return arr;
  }
  const count = 10;
  const xformArray = Array<chaospace.XForm>(count);
  const matrixArray = Array<chaospace.Matrix4x4>(count);
  const mulArray = Array<chaospace.Matrix4x4>(count);
  const invArray = Array<chaospace.Matrix4x4>(count);
  for (let i = 0; i < count; i++) {
    xformArray[i] = new chaospace.XForm(null, xformArray[i - 1]);
    matrixArray[i] = chaospace.Matrix4x4.identity();
  }
  const indices = randomIndices(0, count - 1, 50);
  indices[0] = 0;
  for (const index of indices) {
    const t = new chaospace.Vector3(rand(-1000, 1000), rand(-1000, 1000), rand(-1000, 1000));
    const r = new chaospace.Quaternion(rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(-1, 1)).inplaceNormalize();
    const s = new chaospace.Vector3(rand(1, 10), rand(1, 10), rand(1, 10));
    if (index === 0) {
      matrixArray[index].assign(chaospace.Matrix4x4.translation(t).rotateRight(r).getArray());
      xformArray[index].position = t;
      xformArray[index].rotation = r;
    } else {
      matrixArray[index].assign(chaospace.Matrix4x4.translation(t).rotateRight(r).scaleRight(s).getArray());
      if (xformArray[index].position) {
        xformArray[index].position.assign(t.getArray());
      } else {
        xformArray[index].position = t;
      }
      if (xformArray[index].rotation) {
        xformArray[index].rotation.assign(r.getArray());
      } else {
        xformArray[index].rotation = r;
      }
      if (xformArray[index].scaling) {
        xformArray[index].scaling.assign(s.getArray());
      } else {
        xformArray[index].scaling = s;
      }
    }
    if (index % 5 === 0) {
      multiplyMatrices(matrixArray, mulArray, invArray);
      const indices2 = randomIndices(1, count - 1, 50);
      for (const i of indices2) {
        const xformMatrixWorld = xformArray[i].worldMatrix;
        const bfMatrixWorld = combinedMatrices(mulArray, invArray, 0, i);
        assert(xformMatrixWorld.equalsTo(bfMatrixWorld), 'getWorldMatrix test failed');
      }
    }
  }
}
