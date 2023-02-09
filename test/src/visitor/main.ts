import { doTest } from '../common';
import { testVisitor, testMaxHeap, testMinHeap } from './common';

(async function () {
  await doTest('visitor test', [{
    caseName: 'Visitor test',
    times: 100,
    execute: () => testVisitor ()
  }, {
    caseName: 'Max heap test',
    times: 100,
    execute: () => testMaxHeap ()
  }, {
    caseName: 'Min heap test',
    times: 100,
    execute: () => testMinHeap ()
  }]);
} ());
