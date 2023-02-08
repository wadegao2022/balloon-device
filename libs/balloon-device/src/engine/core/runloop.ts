import {assert} from '../../shared';

const runningLoopStack: RunLoop[] = [];
const runLoopQueue: RunLoop[] = [];

function runLoopFunc() {
  assert(runningLoopStack.length > 0, 'running loop stack error', true);
  const currentLoop = runningLoopStack[runningLoopStack.length - 1];
  currentLoop._processFrameTasks();

  if (currentLoop.mainFunc(...currentLoop.runArgs)) {
    assert(
      runningLoopStack.length > 0 && runningLoopStack[runningLoopStack.length - 1] === currentLoop,
      'running loop error',
      true,
    );
    runningLoopStack.pop();
    currentLoop.atexit && currentLoop.atexit();
  }

  while (runLoopQueue.length > 0) {
    const rl = runLoopQueue.splice(0, 1);
    runningLoopStack.push(rl[0]);
  }

  if (runningLoopStack.length > 0) {
    requestAnimationFrame(runLoopFunc);
  }
}

export interface IRunLoopOptions {
  main: (...args: unknown[]) => boolean;
  atexit?: () => void;
  eventFilter?: (target: unknown, evt: unknown) => boolean;
  noFrameEvents?: boolean;
}

export class RunLoop {
  /** @internal */
  private _options: IRunLoopOptions;
  /** @internal */
  private _runArgs: unknown[];
  /** @internal */
  private _frameTasks: (() => void)[];
  constructor(options?: IRunLoopOptions | ((...args: unknown[])=>boolean)) {
    this._runArgs = [];
    this._frameTasks = [];
    this._options = {
      main: null,
      atexit: null,
      eventFilter: null,
      noFrameEvents: false,
    };
    if (options) {
      if (typeof options === 'function') {
        this._options.main = options;
      } else {
        Object.assign(this._options, options);
      }
    }
  }
  get eventFilter() {
    return this._options.eventFilter;
  }
  set eventFilter(filter: (target: unknown, evt: unknown) => boolean) {
    this._options.eventFilter = filter || null;
  }
  get noFrameEvents(): boolean {
    return !!this._options.noFrameEvents;
  }
  set noFrameEvents(val: boolean) {
    this._options.noFrameEvents = val;
  }
  get runArgs() {
    return this._runArgs;
  }
  set runArgs(args) {
    this._runArgs = args;
  }
  get mainFunc() {
    return this._options.main;
  }
  set mainFunc(func: (...args: unknown[]) => boolean) {
    this._options.main = func || null;
  }
  get atexit() {
    return this._options.atexit;
  }
  set atexit(func: () => void) {
    this._options.atexit = func || null;
  }
  scheduleNextFrame(task: () => void) {
    task && this._frameTasks.push(task);
  }
  /** @internal */
  _processFrameTasks() {
    for (const f of this._frameTasks) {
      f();
    }
    this._frameTasks = [];
  }
  run(...args: unknown[]) {
    if (assert(!!this._options.main, 'invalid runloop main function', false)) {
      this._runArgs = [...args];
      if (runningLoopStack.indexOf(this) < 0) {
        if (runningLoopStack.length === 0) {
          assert(runLoopQueue.length === 0, 'run loop queue error', true);
          runningLoopStack.push(this);
          runLoopFunc();
        } else if (runLoopQueue.indexOf(this) < 0) {
          runLoopQueue.push(this);
        }
      }
    }
  }
  static current(): RunLoop {
    return runningLoopStack[runningLoopStack.length - 1];
  }
}
