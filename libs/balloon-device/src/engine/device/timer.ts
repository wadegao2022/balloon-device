export interface ITimer {
  begin(): void;
  end(): void;
  ended(): boolean;
  elapsed(): number;
}

export class CPUTimer implements ITimer {
  private _cpuTimer: Performance | DateConstructor;
  private _cpuStart: number;
  private _cpuTime: number;
  private _ended: boolean;
  constructor() {
    this._cpuTimer = window.performance || window.Date;
    this._cpuTime = null;
    this._ended = false;
  }
  now(): number {
    return this._cpuTimer.now();
  }
  begin() {
    this._cpuStart = this.now();
    this._cpuTime = null;
    this._ended = false;
  }
  end() {
    this._cpuTime = this.now() - this._cpuStart;
    this._ended = true;
  }
  ended(): boolean {
    return this._ended;
  }
  elapsed(): number {
    return this._cpuTime;
  }
}

