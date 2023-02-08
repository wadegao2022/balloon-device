import { REventPath, REventPathBuilder, REventTarget } from '../shared/event';

export interface RCoord {
  x: number;
  y: number;
}

export interface RColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/*
export type REventHandler = (evt: REvent)=>void;
export interface REventHandlerObject {
    handleEvent: REventHandler;
}
export type REventListener = REventHandler|REventHandlerObject;

export class REvent {
    private static readonly FLAG_STOP_PROPAGATION = (1<<0);
    private static readonly FLAG_STOP_IMMEDIATE_PROPAGATION = (1<<1);
    private static readonly FLAG_CANCELED = (1<<2);
    private static readonly FLAG_DISPATCHED = (1<<3);
    private _type: string;
    private _flags: number;
    private _bubbles: boolean;
    private _cancelable: boolean;
    private _target: unknown;
    private _currentTarget: unknown;
    private _timestamp: number;
    constructor (type: string, initOptions?: { bubbles?: boolean, cancelable?: boolean }) {
        this._type = type;
        this._flags = 0;
        this._bubbles = !!initOptions?.bubbles;
        this._cancelable = !!initOptions?.cancelable;
        this._target = null;
        this._currentTarget = null;
        this._timestamp = Date.now ();
    }
    get type (): string {
        return this._type;
    }
    get bubbles (): boolean {
        return this._bubbles;
    }
    get cancelable (): boolean {
        return this._cancelable;
    }
    get cancelBubble (): boolean {
        return !!(this._flags & REvent.FLAG_STOP_PROPAGATION);
    }
    get cancelImmediate (): boolean {
        return !!(this._flags & REvent.FLAG_STOP_IMMEDIATE_PROPAGATION);
    }
    set cancelBubble (val: boolean) {
        val && this.stopPropagation ();
    }
    get defaultPrevented (): boolean {
        return !!(this._flags & REvent.FLAG_CANCELED);
    }
    get target (): unknown {
        return this._target;
    }
    get currentTarget (): unknown {
        return this._currentTarget;
    }
    get timestamp (): number {
        return this._timestamp;
    }
    preventDefault () {
        this._flags |= REvent.FLAG_CANCELED;
    }
    stopPropagation () {
        this._flags |= REvent.FLAG_STOP_PROPAGATION;
    }
    stopImmediatePropagation () {
        this._flags |= REvent.FLAG_STOP_PROPAGATION;
        this._flags |= REvent.FLAG_STOP_IMMEDIATE_PROPAGATION;
    }
    reset () {
        this._flags = 0;
        this._target = null;
        this._currentTarget = null;
        this._timestamp = Date.now ();
    }
    /// @internal
    _prepareDispatch (target: unknown) {
        if (this._flags & REvent.FLAG_DISPATCHED) {
            throw new Error ('Failed to dispatch event: invalid event state');
        }
        this._target = target;
        this._flags |= REvent.FLAG_DISPATCHED;
    }
    /// @internal
    _invokeListener (listener: REventListener, thisObject: unknown) {
        this._currentTarget = thisObject;
        const handler: REventHandler = typeof listener === 'function' ? listener : listener.handleEvent;
        handler.call (thisObject, this);
        this._currentTarget = null;
    }
}

export interface REventTarget {
    addEventListener (type: string, callback: REventListener): void;
    removeEventListener (type: string, callback: REventListener): void;
    dispatchEvent (evt: REvent): boolean;
}

function guiBubblePolicy (obj: REventTarget): REventTarget {
    const el = obj as any;
    return el.parentNode || el.gui || null;
}

export function eventtarget (bubblePolicy?: (obj:REventTarget)=>REventTarget) {
    return function (ctor: any) {
        bubblePolicy = bubblePolicy || guiBubblePolicy;
        ctor.prototype.addEventListener = function (type: string, callback: REventListener) {
            const listeners: { [type: string]: REventListener[] } = this.__listeners || {};
            this.__listeners = listeners;
            if (!(type in listeners)) {
                listeners[type] = [];
            }
            listeners[type].push (callback);
        };
        ctor.prototype.removeEventListener = function (type: string, callback: REventListener) {
            const listeners: { [type: string]: REventListener[] } = this.__listeners || {};
            if (type in listeners) {
                const stack = listeners[type] as REventListener[];
                const index = stack.indexOf (callback);
                if (index >= 0) {
                    stack.splice (index, 1);
                }
            }
        };
        ctor.prototype.dispatchEvent = function (evt: REvent) {
            evt._prepareDispatch (this);
            let obj = this;
            while (obj) {
                const listeners: { [type: string]: REventListener[] } = obj.__listeners || {};
                if (evt.type in listeners) {
                    const stack = listeners[evt.type].slice();
                    for (let i = 0, l = stack.length; i < l; i++) {
                        evt._invokeListener (stack[i], obj);
                        if (evt.cancelImmediate) {
                            break;
                        }
                    }
                }
                if (evt.bubbles && !evt.cancelBubble) {
                    obj = bubblePolicy (obj);
                } else {
                    break;
                }
            }
            return !evt.defaultPrevented;
        }
    }
}
*/

class GUIEventPath implements REventPath {
  path: REventTarget[];
  constructor() {
    this.path = [];
  }
  toArray(): REventTarget[] {
    return this.path;
  }
}

export class GUIEventPathBuilder implements REventPathBuilder {
  build(node: REventTarget): REventPath {
    const path = new GUIEventPath();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let el: any = node;
    while (el) {
      path.path.push(el);
      el = el.parentNode || el.gui || null;
    }
    return path;
  }
}

