export class REvent {
  static readonly NONE = 0;
  static readonly CAPTURING_PHASE = 1;
  static readonly AT_TARGET = 2;
  static readonly BUBBLING_PHASE = 3;

  /** @internal */
  private static readonly BIT_CANBUBBLE = 1 << 0;
  /** @internal */
  private static readonly BIT_CANCELABLE = 1 << 1;
  /** @internal */
  private static readonly BIT_COMPOSED = 1 << 2;
  /** @internal */
  private static readonly BIT_PROPAGATION_STOPPED = 1 << 3;
  /** @internal */
  private static readonly BIT_IMMEDIATE_PROPAGATION_STOPPED = 1 << 4;
  /** @internal */
  private static readonly BIT_WAS_CANCELED = 1 << 5;
  /** @internal */
  private static readonly BIT_DEFAULT_HANDLED = 1 << 6;
  /** @internal */
  private static readonly BIT_EXECUTING_PASSIVE_LISTENER = 1 << 7;

  /** @internal */
  private readonly _type: string;
  /** @internal */
  private _state: number;
  /** @internal */
  private _phase: number;
  /** @internal */
  private _currentTarget: REventTarget;
  /** @internal */
  private _target: REventTarget;
  /** @internal */
  private _timestamp: number;
  /** @internal */

  /** @internal */
  private _path: REventPath;

  constructor(type: string, canBubble: boolean, cancelable: boolean) {
    this._type = type;
    !!canBubble && this._setFlag(REvent.BIT_CANBUBBLE);
    !!cancelable && this._setFlag(REvent.BIT_CANCELABLE);
    this.reset();
  }
  reset() {
    this._state &= (REvent.BIT_CANBUBBLE | REvent.BIT_CANCELABLE);
    this._phase = REvent.NONE;
    this._currentTarget = null;
    this._target = null;
    this._timestamp = window.Date.now();
    this._path = null;
  }
  get bubbles(): boolean {
    return this._hasFlag(REvent.BIT_CANBUBBLE);
  }
  cancelBubble(): void {
    this.stopPropagation();
  }
  get cancelable(): boolean {
    return this._hasFlag(REvent.BIT_CANCELABLE);
  }
  get composed(): boolean {
    return this._hasFlag(REvent.BIT_COMPOSED);
  }
  get currentTarget(): REventTarget {
    return this._currentTarget;
  }
  get defaultPrevented(): boolean {
    return !!(this._state & REvent.BIT_WAS_CANCELED);
  }
  get eventPhase(): number {
    return this._phase;
  }
  get target(): REventTarget {
    return this._target;
  }
  get timeStamp(): number {
    return this._timestamp;
  }
  get type(): string {
    return this._type;
  }
  get isTrusted(): boolean {
    return true;
  }
  composedPath(): REventTarget[] {
    return this._path?.toArray() || null;
  }
  preventDefault(): void {
    if (this.cancelable && !(this._state & REvent.BIT_EXECUTING_PASSIVE_LISTENER)) {
      this._setFlag(REvent.BIT_WAS_CANCELED);
    }
  }
  stopImmediatePropagation(): void {
    this._setFlag(REvent.BIT_IMMEDIATE_PROPAGATION_STOPPED);
  }
  stopPropagation(): void {
    this._setFlag(REvent.BIT_PROPAGATION_STOPPED);
  }
  /** @internal */
  _isDefaultHandled(): boolean {
    return this._hasFlag(REvent.BIT_DEFAULT_HANDLED);
  }
  /** @internal */
  _setDefaultHandled(handled: boolean): void {
    handled
      ? this._setFlag(REvent.BIT_DEFAULT_HANDLED)
      : this._clearFlag(REvent.BIT_DEFAULT_HANDLED);
  }
  /** @internal */
  _setCanceled(prevented: boolean): void {
    prevented ? this._setFlag(REvent.BIT_WAS_CANCELED) : this._clearFlag(REvent.BIT_WAS_CANCELED);
  }
  /** @internal */
  _setPropagationStopped(stopped: boolean): void {
    stopped
      ? this._setFlag(REvent.BIT_PROPAGATION_STOPPED)
      : this._clearFlag(REvent.BIT_PROPAGATION_STOPPED);
  }
  /** @internal */
  _isPropagationStopped(): boolean {
    return this._hasFlag(REvent.BIT_PROPAGATION_STOPPED);
  }
  /** @internal */
  _setImmediatePropagationStopped(stopped: boolean): void {
    stopped
      ? this._setFlag(REvent.BIT_IMMEDIATE_PROPAGATION_STOPPED)
      : this._clearFlag(REvent.BIT_IMMEDIATE_PROPAGATION_STOPPED);
  }
  /** @internal */
  _isImmediatePropagationStopped(): boolean {
    return this._hasFlag(REvent.BIT_IMMEDIATE_PROPAGATION_STOPPED);
  }
  /** @internal */
  _setPassive(passive: boolean): void {
    passive
      ? this._setFlag(REvent.BIT_EXECUTING_PASSIVE_LISTENER)
      : this._clearFlag(REvent.BIT_EXECUTING_PASSIVE_LISTENER);
  }
  /** @internal */
  _isPassive(): boolean {
    return this._hasFlag(REvent.BIT_EXECUTING_PASSIVE_LISTENER);
  }
  /** @internal */
  _isBeingDispatched(): boolean {
    return !!this._phase;
  }
  /** @internal */
  _setTarget(target: REventTarget) {
    this._target = target || null;
  }
  /** @internal */
  _setCurrentTarget(target: REventTarget) {
    this._currentTarget = target || null;
  }
  /** @internal */
  _setEventPhase(phase: number) {
    this._phase = phase;
  }
  /** @internal */
  _getPath(): REventPath {
    return this._path || null;
  }
  /** @internal */
  _setPath(path: REventPath) {
    this._path = path;
  }
  /** @internal */
  private _setFlag(bit: number): void {
    this._state |= bit;
  }
  /** @internal */
  private _clearFlag(bit: number): void {
    this._state &= ~bit;
  }
  /** @internal */
  private _hasFlag(bit: number): boolean {
    return !!(this._state & bit);
  }
}

export type REventHandler<T extends REvent = REvent> = (evt: T) => void;
export type REventHandlerOptions = {
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
};
export interface REventHandlerObject<T extends REvent = REvent> {
  handleEvent: REventHandler<T>;
}
export type REventListener<T extends REvent = REvent> = REventHandler<T> | REventHandlerObject<T>;

export interface REventPath {
  toArray(): REventTarget[];
}

export interface REventPathBuilder {
  build(node: REventTarget): REventPath;
}

export class DefaultEventPath implements REventPath {
  target: REventTarget;
  constructor(target: REventTarget) {
    this.target = target;
  }
  toArray(): REventTarget[] {
    return [this.target];
  }
}

export class DefaultEventPathBuilder implements REventPathBuilder {
  build(node: REventTarget): REventPath {
    return new DefaultEventPath(node);
  }
}

interface EventListenerMap {
  [name: string]: {
    handler: REventHandlerObject;
    options: REventHandlerOptions;
    removed: boolean;
  }[];
}

export class REventTarget {
  /** @internal */
  _listeners: EventListenerMap;
  /** @internal */
  _defaultListeners: EventListenerMap;
  /** @internal */
  _pathBuilder: REventPathBuilder;
  constructor(pathBuilder?: REventPathBuilder) {
    this._listeners = null;
    this._defaultListeners = null;
    this._pathBuilder = pathBuilder || new DefaultEventPathBuilder();
  }
  addEventListener(type: string, listener: REventListener, options?: REventHandlerOptions): void {
    this._listeners = this._internalAddEventListener(this._listeners, type, listener, options);
  }
  removeEventListener(type: string, listener: REventListener, options?: REventHandlerOptions): void {
    this._internalRemoveEventListener(this._listeners, type, listener, options);
  }
  dispatchEvent(evt: REvent): boolean {
    if (!evt || evt._isBeingDispatched()) {
      console.error('dispatchEvent: invalid event object or event has been dispatched');
      return true;
    }
    const target = this;
    const eventPath = this._pathBuilder.build(target);
    evt._setTarget(target);
    evt._setCurrentTarget(target);
    evt._setCanceled(false);
    evt._setEventPhase(REvent.AT_TARGET);
    evt._setDefaultHandled(false);
    evt._setPath(eventPath);
    this._invokeCaptureListeners(evt);
    this._invokeBubbleListeners(evt);
    evt._setPath(null);
    evt._setCurrentTarget(null);
    evt._setEventPhase(REvent.NONE);
    evt._setPropagationStopped(false);
    evt._setImmediatePropagationStopped(false);

    if (!evt._isDefaultHandled() && !evt.defaultPrevented) {
      evt._setTarget(target);
      evt._setCurrentTarget(target);
      evt._setPath(eventPath);
      this._invokeBubbleDefaultListeners(evt);
      evt._setTarget(null);
      evt._setCurrentTarget(null);
      evt._setPath(null);
    }
    return !evt.defaultPrevented;
  }
  /** @internal */
  addDefaultEventListener(type: string, listener: REventListener, options?: REventHandlerOptions): void {
    this._defaultListeners = this._internalAddEventListener(this._defaultListeners, type, listener, options);
  }
  removeDefaultEventListener(type: string, listener: REventListener, options?: REventHandlerOptions): void {
    this._internalRemoveEventListener(this._defaultListeners, type, listener, options);
  }
  /** @internal */
  _internalAddEventListener(listenerMap: EventListenerMap, type: string, listener: REventListener, options?: REventHandlerOptions): EventListenerMap {
    if (typeof type !== 'string') {
      return;
    }
    if (!listenerMap) {
      listenerMap = {};
    }
    const l: REventHandlerObject = typeof listener === 'function' ? { handleEvent: listener } : listener;
    const o: REventHandlerOptions = {
      capture: !!options?.capture,
      once: !!options?.once,
      passive: !!options?.passive,
    };
    let handlers = listenerMap[type];
    if (!handlers) {
      listenerMap[type] = handlers = [];
    }
    for (const handler of handlers) {
      if (handler.handler.handleEvent === l.handleEvent && handler.options.capture === o.capture) {
        return;
      }
    }
    handlers.push({ handler: l, options: o, removed: false });
    return listenerMap;
  }
  /** @internal */
  _internalRemoveEventListener(listenerMap: EventListenerMap, type: string, listener: REventListener, options?: REventHandlerOptions): void {
    if (typeof type !== 'string' || !listenerMap) {
      return;
    }
    const l: REventHandlerObject = typeof listener === 'function' ? { handleEvent: listener } : listener;
    const o: REventHandlerOptions = {
      capture: !!options?.capture,
      once: !!options?.once,
      passive: !!options?.passive,
    };
    const handlers = listenerMap[type];
    if (handlers) {
      for (let i = 0; i < handlers.length; i++) {
        const handler = handlers[i];
        if (
          handler.handler.handleEvent === l.handleEvent &&
          handler.options.capture === o.capture
        ) {
          handlers.splice(i, 1);
          break;
        }
      }
    }
    if (handlers.length === 0) {
      delete listenerMap[type];
    }
  }
  /** @internal */
  _invokeLocalListeners(evt: REvent, useCapture: boolean) {
    if (!this._listeners) {
      return;
    }
    const handlers = this._listeners[evt.type];
    if (handlers && handlers.length > 0) {
      const handlersCopy = handlers.slice();
      for (const handler of handlersCopy) {
        if (handler.options.capture === useCapture) {
          evt._setCurrentTarget(this);
          evt._setPassive(handler.options.passive);
          handler.handler.handleEvent.call(this, evt);
          if (handler.options.once) {
            handler.removed = true;
          }
          if (evt._isImmediatePropagationStopped()) {
            break;
          }
        }
      }
      this._clearRemovedListeners(handlers);
    }
  }
  /** @internal */
  _invokeCaptureListeners = function (evt: REvent) {
    const eventPath = evt.composedPath();
    if (eventPath) {
      for (let i = eventPath.length; i > 0; i--) {
        const currentTarget = eventPath[i - 1];
        evt._setEventPhase(
          currentTarget === evt.target ? REvent.AT_TARGET : REvent.CAPTURING_PHASE,
        );
        currentTarget._invokeLocalListeners(evt, true);
        if (evt._isPropagationStopped()) {
          break;
        }
      }
    }
  };
  /** @internal */
  _invokeBubbleListeners = function (evt: REvent) {
    const eventPath = evt.composedPath();
    if (eventPath) {
      for (const currentTarget of eventPath) {
        if (currentTarget === evt.target) {
          evt._setEventPhase(REvent.AT_TARGET);
        } else if (evt.bubbles) {
          evt._setEventPhase(REvent.BUBBLING_PHASE);
        } else {
          break;
        }
        currentTarget._invokeLocalListeners(evt, false);
        if (evt._isPropagationStopped()) {
          break;
        }
      }
    }
  };
  /** @internal */
  _invokeDefaultListeners(evt: REvent) {
    const handlers = this._defaultListeners?.[evt.type];
    if (handlers && handlers.length > 0) {
      const handlersCopy = handlers.slice();
      for (const handler of handlersCopy) {
        evt._setCurrentTarget(this);
        handler.handler.handleEvent.call(this, evt);
      }
      this._clearRemovedListeners(handlers);
    }
  }
  /** @internal */
  _invokeBubbleDefaultListeners = function (evt: REvent) {
    const eventPath = evt.composedPath();
    if (eventPath) {
      eventPath[0]?._invokeDefaultListeners(evt);
      if (evt._isDefaultHandled() || !evt.bubbles) {
        return;
      }
      for (let i = 1; i < eventPath.length; i++) {
        eventPath[i]?._invokeDefaultListeners(evt);
        if (evt._isDefaultHandled()) {
          return;
        }
      }
    }
  };
  /** @internal */
  _clearRemovedListeners(handlers: {
    handler: REventHandlerObject;
    options: REventHandlerOptions;
    removed: boolean;
  }[]) {
    for (let i = handlers.length - 1; i >= 0; i--) {
      if (handlers[i].removed) {
        handlers.splice(i, 1);
      }
    }
  }
}

