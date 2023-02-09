// Common test utilities
import * as chaos from 'balloon-device';

export interface ITestCase {
  caseName: string;
  times: number;
  execute: () => void;
}

export function assert(exp, msg) {
  if (!exp) {
    throw new Error(msg);
  }
}

class Foo {
}

class Bar {
}

class SuperBar extends Bar {
}

class Visitor2 extends chaos.Visitor {
  @chaos.visitor(Foo)
  visitFoo() {
    return 'Foo';
  }
  @chaos.visitor(Bar)
  visitBar() {
    return 'Bar';
  }
}

class Visitor3 extends Visitor2 {
  visit(target: unknown) {
    if (target instanceof Foo) {
      return super.visit(target);
    } else {
      return 'AAAA';
    }
  }
}

export function testVisitor() {
  (function case1() {
    const v = new Visitor2();
    const foo = new Foo();
    assert(v.visit(foo) === 'Foo', 'Visitor test failed');
    const bar = new Bar();
    assert(v.visit(bar) === 'Bar', 'Visitor test failed');
    const sbar = new SuperBar();
    assert(v.visit(sbar) === 'Bar', 'Visitor test failed');
    const v2 = new Visitor3();
    assert(v2.visit(foo) === 'Foo', 'Visitor test failed');
    assert(v2.visit(bar) === 'AAAA', 'Visitor test failed');
    assert(v2.visit(sbar) === 'AAAA', 'Visitor test failed');
  })();
}

export function testMaxHeap() {
  const maxHeap = new chaos.Heap<number>((a, b) => a < b);
  for (let i = 0; i < 100; i++) {
    maxHeap.add(Math.random() * 100);
  }
  let maxVal = Number.MAX_VALUE;
  while (maxHeap.length > 0) {
    const top = maxHeap.pop();
    assert(maxVal >= top, 'Max heap test failed');
    maxVal = top;
  }
}

export function testMinHeap() {
  const minHeap = new chaos.Heap<number>((a, b) => a > b);
  for (let i = 0; i < 100; i++) {
    minHeap.add(Math.random() * 100);
  }
  minHeap.remove(21);
  minHeap.remove(55);
  minHeap.remove(1);
  let minVal = -Number.MAX_VALUE;
  while (minHeap.length > 0) {
    const top = minHeap.pop();
    assert(minVal <= top, 'Min heap test failed');
    minVal = top;
  }
}
