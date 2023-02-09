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

export function rand (minval = -999999, maxval = 999999) {
  return Math.random() * (maxval - minval) + minval;
}

export function randInt (minval = -999999, maxval = 999999) {
  return Math.floor(Math.random() * (maxval - minval + 1) + minval);
}

export function randNonZero (minval = -999999, maxval = 999999) {
  while (true) {
    const r = rand (minval, maxval);
    if (Math.abs(r) > Number.EPSILON) {
      return r;
    }
  }
}

