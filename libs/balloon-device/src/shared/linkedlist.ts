export class ListIterator<T = unknown> {
  /** @internal */
  private _node: ListNodeImpl;
  /** @internal */
  private _reverse: boolean;
  /** @internal */
  private _dl: List<T>;
  constructor(dl: List<T>, node: ListNodeImpl, reverse: boolean) {
    this._dl = dl;
    this._node = node;
    this._reverse = reverse;
  }
  valid(): boolean {
    return this._node !== this._dl.head;
  }
  next(): ListIterator<T> {
    if (this.valid()) {
      this._node = this._reverse ? this._node.prev : this._node.next;
    }
    return this;
  }
  getNext(): ListIterator<T> {
    if (!this.valid()) {
      throw new Error('Failed to get next iterator: this iterator is invalid');
    }
    return new ListIterator<T>(
      this._dl,
      this._reverse ? this._node.prev : this._node.next,
      this._reverse,
    );
  }
  prev(): ListIterator<T> {
    if (this.valid()) {
      this._node = this._reverse ? this._node.next : this._node.prev;
    }
    return this;
  }
  getPrev(): ListIterator<T> {
    if (!this.valid()) {
      throw new Error('Failed to get previous iterator: this iterator is invalid');
    }
    return new ListIterator<T>(
      this._dl,
      this._reverse ? this._node.next : this._node.prev,
      this._reverse,
    );
  }
  get node() {
    return this._node;
  }
  set node(n: ListNodeImpl) {
    this._node = n;
  }
  get reversed() {
    return this._reverse;
  }
  get list() {
    return this._dl;
  }
  get data() {
    if (this.valid()) {
      return (this._node as ListNode<T>).data;
    } else {
      throw new Error('Invalid interator');
    }
  }
  set data(val: T) {
    if (this.valid()) {
      (this._node as ListNode<T>).data = val;
    }
  }
}

export class List<T = unknown> {
  /** @internal */
  private _head: ListNodeImpl;
  /** @internal */
  private _length: number;
  constructor() {
    this._head = new ListNodeImpl();
    this._length = 0;
  }
  get head() {
    return this._head;
  }
  get length() {
    return this._length;
  }
  clear() {
    while (this._length > 0) {
      this.remove(this.begin());
    }
  }
  append(data: T): ListIterator<T> {
    return this._insertAt(data, this._head);
  }
  prepend(data: T): ListIterator<T> {
    return this._insertAt(data, this._head.next);
  }
  removeAndAppend(it: ListIterator<T>): void {
    this._move(it, this._head);
  }
  removeAndPrepend(it: ListIterator<T>) {
    this._move(it, this._head.next);
  }
  remove(it: ListIterator<T>): void {
    if (it.valid() && it.list === this) {
      const node = it.node;
      it.next();
      this._remove(node);
    }
  }
  insertAt(data: T, at: ListIterator<T>): ListIterator<T> {
    if (at.list === this) {
      if (at.valid()) {
        if (at.reversed) {
          return this._insertAt(data, at.node.next);
        } else {
          return this._insertAt(data, at.node);
        }
      } else {
        return this.append(data);
      }
    }
    return null;
  }
  forEach(callback: (data: T) => void) {
    for (let it = this.begin(); it.valid(); it.next()) {
      callback && callback(it.data);
    }
  }
  forEachReverse(callback: (data: T) => void) {
    for (let it = this.rbegin(); it.valid(); it.next()) {
      callback && callback(it.data);
    }
  }
  front(): T {
    return this.begin().data;
  }
  back(): T {
    return this.rbegin().data;
  }
  begin(): ListIterator<T> {
    return new ListIterator(this, this._length > 0 ? this._head.next : this._head, false);
  }
  rbegin(): ListIterator<T> {
    return new ListIterator(this, this._length > 0 ? this._head.prev : this._head, true);
  }
  /** @internal */
  private _remove(node: ListNodeImpl) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
    delete node.prev;
    delete node.next;
    this._length--;
  }
  /** @internal */
  private _insertAt(data: T, node: ListNodeImpl): ListIterator<T> {
    const newNode = new ListNode(data);
    newNode.next = node;
    newNode.prev = node.prev;
    node.prev.next = newNode;
    node.prev = newNode;
    this._length++;
    return new ListIterator(this, newNode, false);
  }
  /** @internal */
  private _move(iter: ListIterator<T>, at: ListNodeImpl) {
    const node = iter.node;
    node.prev.next = node.next;
    node.next.prev = node.prev;
    node.next = at;
    node.prev = at.prev;
    at.prev.next = node;
    at.prev = node;
  }
}

class ListNodeImpl {
  next: ListNodeImpl;
  prev: ListNodeImpl;
  constructor() {
    this.next = this;
    this.prev = this;
  }
}

class ListNode<T = unknown> extends ListNodeImpl {
  data: T;
  constructor(data: T) {
    super();
    this.data = data;
  }
}
