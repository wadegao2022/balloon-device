class TreapNode<T> {
  /** @internal */
  private static _seed = 911;
  value: T;
  weight: number;
  size: number;
  count: number;
  constructor(val: T) {
    this.value = val;
    this.weight = TreapNode._randint();
    this.size = 1;
    this.count = 1;
  }
  /** @internal */
  private static _randint() {
    this._seed = (this._seed * 48271) % ((1 << 31) - 1);
    return this._seed;
  }
}

export class BSTNode<T> {
  value: TreapNode<T>;
  left: BSTNode<T>;
  right: BSTNode<T>;
  constructor(val: TreapNode<T>) {
    this.value = val;
    this.left = null;
    this.right = null;
  }
}

function bstGetRank<T>(node: BSTNode<T>, value: T, fnComp: (a: T, b: T) => number): number {
  if (!node) {
    return 0;
  } else {
    const cmp = fnComp(value, node.value.value);
    if (cmp < 0) {
      return node.left ? bstGetRank(node.left, value, fnComp) : 0;
    } else if (cmp === 0 && node.value.count > 0) {
      return node.left ? node.left.value.size + 1 : 1;
    } else {
      return (
        bstGetRank(node.right, value, fnComp) +
        (node.left ? node.left.value.size : 0) +
        node.value.count
      );
    }
  }
}

export class Treap<T> {
  /** @internal */
  private _root: BSTNode<T>;
  /** @internal */
  private _fnComp: (a: T, b: T) => number;

  constructor(root?: BSTNode<T>, fnComp?: (a: T, b: T) => number) {
    this._root = root || null;
    this._fnComp =
      fnComp ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function (a: any, b: any) {
        return a - b;
      };
  }
  get root(): BSTNode<T> {
    return this._root;
  }
  get length(): number {
    return this._root ? this._root.value.size : 0;
  }
  add(val: T): void {
    const k = bstGetRank(this._root, val, this._fnComp);
    const c = this._splitNode(this._root, k);
    const newNode = new BSTNode<T>(new TreapNode<T>(val));
    this._root = this._mergeNode(this._mergeNode(c[0], newNode), c[1]);
  }
  delete(val: T): void {
    const k = bstGetRank(this._root, val, this._fnComp);
    if (k) {
      const x = this._splitNode(this._root, k - 1);
      const y = this._splitNode(x[1], 1);
      this._root = this._mergeNode(x[0], y[1]);
    }
  }
  has(val: T): boolean {
    return this._root ? this._find(this._root, val) !== null : false;
  }
  forEach(fn: (val: T) => void) {
    if (this._root) {
      this._forEach(this._root, fn);
    }
  }
  kth(k: number): BSTNode<T> {
    return this._root ? this._findKth(this._root, k) : null;
  }
  min(): T {
    const n = this.kth(1);
    return n ? n.value.value : null;
  }
  max(): T {
    const n = this._root ? this.kth(this._root.value.size) : null;
    return n ? n.value.value : null;
  }
  next(val: T): T {
    return this._next(this._root, val)?.value.value || null;
  }
  prev(val: T): T {
    return this._prev(this._root, val)?.value.value || null;
  }
  [Symbol.iterator]() {
    let node = this.kth(1);
    const that = this;
    return {
      next() {
        if (!node) {
          node = that.kth(1);
          return {done: true};
        } else {
          const val = node.value.value;
          node = that._next(that._root, val);
          return {value: val, done: false};
        }
      },
    };
  }
  /** @internal */
  private _splitNode(root: BSTNode<T>, k: number) {
    if (!root) {
      return [null, null];
    } else if (this._getSize(root.left) >= k) {
      const couple = this._splitNode(root.left, k);
      root.left = couple[1];
      this._updateSize(root);
      couple[1] = root;
      return couple;
    } else {
      const couple = this._splitNode(root.right, k - this._getSize(root.left) - 1);
      root.right = couple[0];
      this._updateSize(root);
      couple[0] = root;
      return couple;
    }
  }
  /** @internal */
  private _mergeNode(left: BSTNode<T>, right: BSTNode<T>): BSTNode<T> {
    if (!left) {
      return right;
    } else if (!right) {
      return left;
    } else if (left.value.weight < right.value.weight) {
      left.right = this._mergeNode(left.right, right);
      this._updateSize(left);
      return left;
    } else {
      right.left = this._mergeNode(left, right.left);
      this._updateSize(right);
      return right;
    }
  }
  /** @internal */
  private _getSize(node: BSTNode<T>): number {
    return node ? node.value.size : 0;
  }
  /** @internal */
  private _updateSize(node: BSTNode<T>): void {
    if (node) {
      node.value.size = this._getSize(node.left) + this._getSize(node.right) + node.value.count;
    }
  }
  /** @internal */
  private _find(node: BSTNode<T>, val: T): BSTNode<T> {
    const curVal = node.value.value;
    const comp = this._fnComp(curVal, val);
    if (comp < 0) {
      return node.right ? this._find(node.right, val) : null;
    } else if (comp > 0) {
      return node.left ? this._find(node.left, val) : null;
    } else {
      return node;
    }
  }
  /** @internal */
  _forEach(node: BSTNode<T>, fn: (val: T) => void) {
    if (node.left) {
      this._forEach(node.left, fn);
    }
    fn(node.value.value);
    if (node.right) {
      this._forEach(node.right, fn);
    }
  }
  /** @internal */
  _findKth(root: BSTNode<T>, k: number): BSTNode<T> {
    if (!root) {
      return null;
    }
    const leftSize = root.left ? root.left.value.size : 0;
    if (k <= leftSize) {
      return root.left ? this._findKth(root.left, k) : null;
    } else if (k <= leftSize + root.value.count) {
      return root;
    } else if (root.right) {
      return this._findKth(root.right, k - leftSize - root.value.count);
    } else {
      return null;
    }
  }
  /** @internal */
  _next(root: BSTNode<T>, val: T): BSTNode<T> {
    if (!root) {
      return null;
    }
    const comp = this._fnComp(root.value.value, val);
    if (comp <= 0) {
      return root.right ? this._next(root.right, val) : null;
    } else {
      const p = root.left ? this._next(root.left, val) : null;
      return p ? p : root.value.count ? root : root.right ? this._next(root.right, val) : null;
    }
  }
  /** @internal */
  _prev(root: BSTNode<T>, val: T): BSTNode<T> {
    if (!root) {
      return null;
    }
    const comp = this._fnComp(root.value.value, val);
    if (comp >= 0) {
      return root.left ? this._prev(root.left, val) : null;
    } else {
      const p = root.right ? this._prev(root.right, val) : null;
      return p ? p : root.value.count ? root : root.left ? this._prev(root.left, val) : null;
    }
  }
}
