import {NodeType} from './values';
import type {RNode} from './node';

interface IndexIterator extends Iterator<[number, RNode]> {
  lastIndex: number;
}

interface IndexKeyIterator extends Iterator<number> {
  lastIndex: number;
}

interface IndexValueIterator extends Iterator<RNode> {
  lastIndex: number;
}

class ElementIndexer {
  static readonly MODE_ALL = 0;
  static readonly MODE_NON_INTERNAL = 1;
  static readonly MODE_ELEMENT_NON_INTERNAL = 2;
  protected _parent: RNode;
  protected _currentIndex: number;
  protected _currentNode: RNode;
  protected _length: number;
  protected _mode: number;
  protected _domTag: number;
  constructor(parent: RNode, mode: number) {
    this._parent = parent;
    this._currentIndex = -1;
    this._currentNode = null;
    this._length = -1;
    this._mode = mode;
    this._domTag = parent.gui.domTag;
  }
  get length(): number {
    return this._getLength();
  }
  item(index: number): RNode {
    return this._at(index);
  }
  entries(): Iterable<[number, RNode]> {
    return this._getEntriesIterator();
  }
  keys(): Iterable<number> {
    return this._getKeysIterator();
  }
  values(): Iterable<RNode> {
    return this._getValuesIterator();
  }
  forEach(
    callback: (currentValue: RNode, currentIndex?: number, listObj?: unknown) => void,
    thisArg?: unknown,
  ) {
    for (const entry of this.entries()) {
      callback && callback.call(thisArg, entry[1], entry[0], this);
    }
  }
  indexOf(node: RNode): number {
    for (let i = 0; i < this.length; i++) {
      if (this.item(i) === node) {
        return i;
      }
    }
    return -1;
  }
  private _at(index: number): RNode {
    if (index < 0 || index >= this.length) {
      return null;
    }
    if (this._currentIndex < 0 || this._currentIndex >= this.length) {
      this._reset(index);
    } else {
      while (index < this._currentIndex) {
        this._previous();
      }
      while (index > this._currentIndex) {
        this._next();
      }
    }
    return this._currentNode;
  }
  private _reset(index: number) {
    this._length = -1;
    this._currentIndex = 0;
    switch (this._mode) {
    case ElementIndexer.MODE_ALL:
      this._currentNode = this._parent._getLayout().firstChild()?.element || null;
      break;
    case ElementIndexer.MODE_NON_INTERNAL:
      this._currentNode = this._getFirstNonInternalNode();
      break;
    case ElementIndexer.MODE_ELEMENT_NON_INTERNAL:
      this._currentNode = this._getFirstNonInternalElement();
      break;
    default:
      break;
    }
    while (this._currentIndex < index && this._currentNode) {
      this._next();
    }
  }
  private _getFirstNonInternalNode(): RNode {
    for (let child = this._parent._getLayout().firstChild(); child; child = child.nextSibling()) {
      if (!child.element._isInternal()) {
        return child.element;
      }
    }
    return null;
  }
  private _getFirstNonInternalElement(): RNode {
    for (let child = this._parent._getLayout().firstChild(); child; child = child.nextSibling()) {
      if (!child.element._isInternal() && child.element.nodeType === NodeType.ELEMENT_NODE) {
        return child.element;
      }
    }
    return null;
  }
  private _getLengthAll(): number {
    return this._parent._getLayout().getNumChildren();
  }
  private _getLengthNonInternalNode(): number {
    let length = 0;
    for (let child = this._parent._getLayout().firstChild(); child; child = child.nextSibling()) {
      if (!child.element._isInternal()) {
        length++;
      }
    }
    return length;
  }
  private _getLengthNonInternalElement(): number {
    let length = 0;
    for (let child = this._parent._getLayout().firstChild(); child; child = child.nextSibling()) {
      if (!child.element._isInternal() && child.element.nodeType === NodeType.ELEMENT_NODE) {
        length++;
      }
    }
    return length;
  }
  private _getLength(): number {
    if (this._domTag !== this._parent.gui.domTag) {
      this._domTag = this._parent.gui.domTag;
      this._reset(this._currentIndex);
    }
    if (this._length < 0) {
      switch (this._mode) {
      case ElementIndexer.MODE_ALL:
        this._length = this._getLengthAll();
        break;
      case ElementIndexer.MODE_NON_INTERNAL:
        this._length = this._getLengthNonInternalNode();
        break;
      case ElementIndexer.MODE_ELEMENT_NON_INTERNAL:
        this._length = this._getLengthNonInternalElement();
        break;
      }
    }
    return this._length;
  }
  private _getKeysIterator() {
    const that = this;
    return {
      [Symbol.iterator](): IndexKeyIterator {
        return {
          lastIndex: -1,
          next(): IteratorResult<number> {
            this.lastIndex++;
            if (that._domTag !== that._parent.gui.domTag) {
              that._domTag = that._parent.gui.domTag;
              that._reset(this.lastIndex);
            }
            if (this.lastIndex >= that.length) {
              this.lastIndex = -1;
              return {
                done: true,
                value: null,
              };
            } else {
              return {
                done: false,
                value: this.lastIndex,
              };
            }
          },
        };
      },
    };
  }
  private _getEntriesIterator() {
    const that = this;
    return {
      [Symbol.iterator](): IndexIterator {
        return {
          lastIndex: -1,
          next(): IteratorResult<[number, RNode]> {
            this.lastIndex++;
            if (that._domTag !== that._parent.gui.domTag || that._currentIndex !== this.lastIndex) {
              that._domTag = that._parent.gui.domTag;
              that._reset(this.lastIndex);
            }
            if (!that._currentNode) {
              this.lastIndex = -1;
              return {
                done: true,
                value: null,
              };
            } else {
              const ret: IteratorResult<[number, RNode]> = {
                done: false,
                value: [that._currentIndex, that._currentNode],
              };
              that._next();
              return ret;
            }
          },
        };
      },
    };
  }
  private _getValuesIterator() {
    const that = this;
    return {
      [Symbol.iterator](): IndexValueIterator {
        return {
          lastIndex: -1,
          next(): IteratorResult<RNode> {
            this.lastIndex++;
            if (that._domTag !== that._parent.gui.domTag || that._currentIndex !== this.lastIndex) {
              that._domTag = that._parent.gui.domTag;
              that._reset(this.lastIndex);
            }
            if (!that._currentNode) {
              this.lastIndex = -1;
              return {
                done: true,
                value: null,
              };
            } else {
              const ret: IteratorResult<RNode> = {
                done: false,
                value: that._currentNode,
              };
              that._next();
              return ret;
            }
          },
        };
      },
    };
  }
  private _next(): void {
    if (this._currentNode) {
      switch (this._mode) {
      case ElementIndexer.MODE_ALL: {
        this._currentNode = this._currentNode._getLayout().nextSibling()?.element || null;
        break;
      }
      case ElementIndexer.MODE_NON_INTERNAL: {
        do {
          this._currentNode = this._currentNode._getLayout().nextSibling()?.element || null;
        } while (this._currentNode?._isInternal());
        break;
      }
      case ElementIndexer.MODE_ELEMENT_NON_INTERNAL: {
        do {
          this._currentNode = this._currentNode._getLayout().nextSibling()?.element || null;
        } while (
          this._currentNode &&
            (this._currentNode._isInternal() ||
              this._currentNode.nodeType !== NodeType.ELEMENT_NODE)
        );
        break;
      }
      }
      this._currentIndex++;
    }
  }
  private _previous(): void {
    if (this._currentNode) {
      switch (this._mode) {
      case ElementIndexer.MODE_ALL: {
        this._currentNode = this._currentNode._getLayout().previousSibling()?.element || null;
        break;
      }
      case ElementIndexer.MODE_NON_INTERNAL: {
        do {
          this._currentNode = this._currentNode._getLayout().previousSibling()?.element || null;
        } while (this._currentNode?._isInternal());
        break;
      }
      case ElementIndexer.MODE_ELEMENT_NON_INTERNAL: {
        do {
          this._currentNode = this._currentNode._getLayout().previousSibling()?.element || null;
        } while (
          this._currentNode &&
            (this._currentNode._isInternal() ||
              this._currentNode.nodeType !== NodeType.ELEMENT_NODE)
        );
        break;
      }
      }
      this._currentIndex--;
    }
  }
}

export interface RNodeList {
  length: number;
  item(index: number): RNode;
  entries(): Iterable<[number, RNode]>;
  keys(): Iterable<number>;
  values(): Iterable<RNode>;
  indexOf(node: RNode): number;
  forEach(
    callback: (currentValue: RNode, currentIndex?: number, listObj?: RNodeList) => void,
    thisArg?: unknown,
  ): void;
  [index: number]: RNode;
}

/** @internal */
export interface RStaticNodeList extends RNodeList {}

/** @internal */
export class RStaticNodeList {
  private _nodelist: RNode[];
  constructor(nodelist: RNode[]) {
    this._nodelist = nodelist;
    return new Proxy(this, {
      get: function (target, name) {
        if (typeof name === 'string' && /^\d+$/.test(name)) {
          return target._nodelist[parseInt(name)] || undefined;
        } else {
          return target[name];
        }
      },
      set: function () {
        return false;
      },
    });
  }
  get length(): number {
    return this._nodelist.length;
  }
  item(index: number): RNode {
    return this._nodelist[index] || null;
  }
  entries(): Iterable<[number, RNode]> {
    const that = this;
    return {
      [Symbol.iterator](): IndexIterator {
        return {
          lastIndex: -1,
          next(): IteratorResult<[number, RNode]> {
            this.lastIndex++;
            if (this.lastIndex >= that.length) {
              this.lastIndex = -1;
              return {
                done: true,
                value: null,
              };
            } else {
              return {
                done: false,
                value: [this.lastIndex, that.item(this.lastIndex)],
              };
            }
          },
        };
      },
    };
  }
  keys(): Iterable<number> {
    const that = this;
    return {
      [Symbol.iterator](): IndexKeyIterator {
        return {
          lastIndex: -1,
          next(): IteratorResult<number> {
            this.lastIndex++;
            if (this.lastIndex >= that.length) {
              this.lastIndex = -1;
              return {
                done: true,
                value: null,
              };
            } else {
              return {
                done: false,
                value: this.lastIndex,
              };
            }
          },
        };
      },
    };
  }
  values(): Iterable<RNode> {
    const that = this;
    return {
      [Symbol.iterator](): IndexValueIterator {
        return {
          lastIndex: -1,
          next(): IteratorResult<RNode> {
            this.lastIndex++;
            if (this.lastIndex >= that.length) {
              this.lastIndex = -1;
              return {
                done: true,
                value: null,
              };
            } else {
              return {
                done: false,
                value: that.item(this.lastIndex),
              };
            }
          },
        };
      },
    };
  }
  indexOf(node: RNode): number {
    return this._nodelist.indexOf(node);
  }
  forEach(
    callback: (currentValue: RNode, currentIndex?: number, listObj?: RNodeList) => void,
    thisArg?: unknown,
  ): void {
    const that = this;
    if (callback) {
      for (let i = 0; i < this._nodelist.length; i++) {
        callback.call(thisArg, that._nodelist[i], i, that);
      }
    }
  }
}

/** @internal */
export interface RLiveNodeList extends RNodeList {}

/** @internal */
export class RLiveNodeList {
  static readonly MODE_ALL = ElementIndexer.MODE_ALL;
  static readonly MODE_NON_INTERNAL = ElementIndexer.MODE_NON_INTERNAL;
  static readonly MODE_ELEMENT_NON_INTERNAL = ElementIndexer.MODE_ELEMENT_NON_INTERNAL;
  private _indexer: ElementIndexer;
  constructor(parent: RNode, mode: number) {
    this._indexer = new ElementIndexer(parent, mode);
    const proxy = new Proxy(this, {
      get: function (target, name) {
        if (typeof name === 'string' && /^\d+$/.test(name)) {
          return target._indexer.item(parseInt(name)) || undefined;
        } else {
          return target._indexer[name];
        }
      },
      set: function (target, name, value) {
        if (typeof name === 'string' && /^\d+$/.test(name)) {
          return false;
        } else {
          target._indexer[name] = value;
          return true;
        }
      },
    });
    return proxy;
  }
}
