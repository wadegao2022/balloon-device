export class Heap<T = unknown> {
  /** @internal */
  private _less: (a: T, b: T) => boolean;
  /** @internal */
  private _data: T[];
  constructor(lessFunc: (a: T, b: T) => boolean) {
    this._less = lessFunc;
    this._data = [];
  }
  get top(): T {
    return this._data[0];
  }
  get length(): number {
    return this._data.length;
  }
  pop(): T {
    const val = this.top;
    this.remove(0);
    return val;
  }
  add(val: T): this {
    this._data.push(val);
    this._up(this._data.length - 1);
    return this;
  }
  remove(index: number): this {
    this._data[index] = this._data[this._data.length - 1];
    this._data.length--;
    this._up(index);
    this._down(index);
    return this;
  }
  /** @internal */
  _up(index: number): void {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this._less(this._data[parent], this._data[index])) {
        this._swap(index, parent);
        index = parent;
      } else {
        break;
      }
    }
  }
  /** @internal */
  _down(index: number): void {
    const len = this._data.length;
    while (true) {
      let maxval = index;
      const left = 2 * index + 1;
      const right = left + 1;
      if (left < len && this._less(this._data[maxval], this._data[left])) {
        maxval = left;
      }
      if (right < len && this._less(this._data[maxval], this._data[right])) {
        maxval = right;
      }
      if (maxval === index) {
        break;
      }
      this._swap(index, maxval);
      index = maxval;
    }
  }
  /** @internal */
  _swap(a: number, b: number): void {
    const tmp = this._data[a];
    this._data[a] = this._data[b];
    this._data[b] = tmp;
  }
}
