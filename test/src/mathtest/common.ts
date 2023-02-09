// Common test utilities

export interface ITestCase {
    caseName: string;
    times: number;
    execute: ()=>void;
}

export function assert (exp, msg) {
  if (!exp) {
    throw new Error(msg);
  }
}

const a = new Float32Array(1);
export function toFloat32 (val: number): number {
  a[0] = val;
  return a[0];
}

export function rand (minval = -10, maxval = 10): number {
  return toFloat32(Math.random() * (maxval - minval) + minval);
}

export function randInt (minval = -999999, maxval = 999999) {
  return Math.floor(Math.random() * (maxval - minval + 1) + minval);
}

export function randNonZero (minval = -10, maxval = 10) {
  while (true) {
    const r = rand (minval, maxval);
    if (Math.abs(r) > Number.EPSILON) {
      return r;
    }
  }
}


