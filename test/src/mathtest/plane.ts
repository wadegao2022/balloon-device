import * as chaospace from 'balloon-device';
import { assert, rand } from './common';

export function testPlane() {
  const x = rand(-1000, 1000);
  const y = rand(1, 100);
  const z = rand(-1000, 1000);
  const plane = new chaospace.Plane(new chaospace.Vector3(x, y, z), new chaospace.Vector3(0, 1, 0));
  const x1 = rand(-1000, 1000);
  const y1 = rand(y + rand(0, 100));
  const z1 = rand(-1000, 1000);
  assert(chaospace.numberEquals(plane.distanceToPoint(new chaospace.Vector3(x1, y1, z1)), y1 - y), 'distanceToPoint test failed');
  assert(plane.nearestPointToPoint(new chaospace.Vector3(x1, y1, z1)).equalsTo(new chaospace.Vector3(x1, y, z1)), 'nearestPointToPoint test failed');
  plane.inplaceFlip();
  assert(chaospace.numberEquals(plane.distanceToPoint(new chaospace.Vector3(x1, y1, z1)), y - y1), 'distanceToPoint test failed');
  assert(plane.nearestPointToPoint(new chaospace.Vector3(x1, y1, z1)).equalsTo(new chaospace.Vector3(x1, y, z1)), 'nearestPointToPoint test failed');
}
