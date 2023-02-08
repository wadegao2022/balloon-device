import {RNode} from './node';
import {tagname} from './gui';
import {RAttributeChangeEvent} from './events';
import {RNodeList, RStaticNodeList} from './nodelist';
import type {REvent} from '../shared/event';
import type {GUI} from './gui';

export interface RClassList {
  [n: number]: string;
}

export class RClassList {
  /** @internal */
  private static _elementMap: WeakMap<RClassList, RElement> = new WeakMap();
  /** @internal */
  private _classList: string[];
  /** @internal */
  private _value: string;
  /** @internal */
  private _valueChanged: boolean;
  /** @internal */
  private _changeEvent: RAttributeChangeEvent;
  constructor(el: RElement) {
    this._classList = [];
    this._value = '';
    this._valueChanged = false;
    this._changeEvent = new RAttributeChangeEvent('class', false);
    const proxy = new Proxy(this, {
      get: function (target, name) {
        if (typeof name === 'string' && /^\d+$/.test(name)) {
          return target._classList[parseInt(name)];
        } else {
          return target[name];
        }
      },
    });
    RClassList._elementMap.set(proxy, el);
    return proxy;
  }
  get value(): string {
    if (this._valueChanged) {
      this._valueChanged = false;
      this._value = this._classList.join(' ');
    }
    return this._value;
  }
  set value(val: string) {
    this._setValue(val, true);
  }
  get length(): number {
    return this._classList.length;
  }
  /** @internal */
  _setValue(val: string, dispatch: boolean) {
    this._classList = val.split(/\s+/).filter((value) => !!value);
    this._valueChanged = true;
    if (dispatch) {
      this._notify();
    }
  }
  /** @internal */
  _notify() {
    const el = RClassList._elementMap.get(this);
    el.dispatchEvent(this._changeEvent);
  }
  add(...args: string[]) {
    let changed = false;
    for (const arg of args) {
      if (arg && typeof arg === 'string') {
        const classes = arg.split(/\s+/);
        classes.forEach((cls) => {
          if (this._classList.indexOf(cls) < 0) {
            this._classList.push(cls);
            changed = true;
          }
        });
      }
    }
    if (changed) {
      this._valueChanged = true;
      this._notify();
    }
  }
  remove(...args: string[]) {
    let changed = false;
    for (const arg of args) {
      if (arg && typeof arg === 'string') {
        const classes = arg.split(/\s+/);
        classes.forEach((cls) => {
          const index = this._classList.indexOf(cls);
          if (index >= 0) {
            this._classList.splice(index, 1);
            changed = true;
          }
        });
      }
    }
    if (changed) {
      this._valueChanged = true;
      this._notify();
    }
  }
  toggle(className: string): boolean {
    this._valueChanged = true;
    const index = this._classList.indexOf(className);
    if (index >= 0) {
      this._classList.splice(index, 1);
      this._notify();
      return false;
    } else {
      this._classList.push(className);
      this._notify();
      return true;
    }
  }
  contains(className: string): boolean {
    return this._classList.indexOf(className) >= 0;
  }
  replace(oldClassName: string, newClassName: string) {
    if (newClassName !== oldClassName) {
      if (!oldClassName || oldClassName.indexOf(' ') >= 0) {
        throw new Error('Failed to replace class: old class name is invalid');
      }
      oldClassName = oldClassName.trim();
      if (oldClassName === '') {
        throw new Error('Failed to replace class: old class name is empty');
      }
      const index = this._classList.indexOf(oldClassName);
      if (index < 0) {
        throw new Error('Failed to replace class: old class name not exists');
      }
      newClassName = newClassName || '';
      newClassName = newClassName.trim();
      const newClassNames = newClassName.split(/\s+/).filter((val) => !!val);
      this._classList.splice(index, 1, ...newClassNames);

      this._notify();
    }
  }
}

export interface RAttr {
  name: string;
  value: string;
}

@tagname('div')
export class RElement extends RNode {
  /** @internal */
  protected _tagname: string;
  /** @internal */
  protected _attributes: {[name: string]: string};
  /** @internal */
  protected _classList: RClassList;
  /** @internal */
  protected _attrChangeEvent: RAttributeChangeEvent;
  constructor(uiscene: GUI) {
    super(uiscene);
    this._tagname = null;
    this._attributes = {};
    this._classList = new RClassList(this);
    this._attrChangeEvent = new RAttributeChangeEvent('', false);
    this.addDefaultEventListener(RAttributeChangeEvent.NAME, (e: REvent) => {
      const data = e as RAttributeChangeEvent;
      if (data.name === 'class') {
        this._uiscene._markStyleRefreshForElement(this);
      }
    });
  }
  get children(): RNodeList {
    return this._childrenElements;
  }
  get childElementCount(): number {
    return this._childrenElements.length;
  }
  get nodeType(): number {
    return RNode.ELEMENT_NODE;
  }
  get localName(): string {
    return this._tagname;
  }
  get tagName(): string {
    return this._tagname;
  }
  get id(): string {
    return this._attributes.id || '';
  }
  set id(id: string) {
    this._attributes.id = id || '';
  }
  get classList(): RClassList {
    return this._classList;
  }
  get className(): string {
    return this._classList.value;
  }
  get attributes(): RAttr[] {
    const result: RAttr[] = [];
    for (const name in this._attributes) {
      result.push({name: name, value: this._attributes[name]});
    }
    return result;
  }
  get firstElementChild(): RElement {
    return this._getFirstChild(true) as RElement;
  }
  get lastElementChild(): RElement {
    return this._getLastChild(true) as RElement;
  }
  get nextElementSibling(): RElement {
    return this._getNextSibling(true) as RElement;
  }
  get previousElementSibling(): RElement {
    return this._getPreviousSibling(true) as RElement;
  }
  getAttribute(k: string): string {
    if (k) {
      k = k.toLowerCase();
      return k === 'class'
        ? this._classList.value
        : (this._attributes && this._attributes[k]) || null;
    }
    return null;
  }
  setAttribute(k: string, v?: string) {
    if (k) {
      v = v || null;
      k = k.toLowerCase();
      if (this._attributes[k] !== v) {
        this._attributes[k] = v;
        if (k === 'class') {
          this._classList._setValue(v || '', false);
        } else if (k === 'style') {
          this._uiscene._markStyleRefreshForElement(this);
        }
        this._attrChangeEvent.name = k;
        this._attrChangeEvent.removed = false;
        this.dispatchEvent(this._attrChangeEvent);
      }
    }
  }
  removeAttribute(k: string) {
    if (k) {
      k = k.toLowerCase();
      if (this._attributes[k] !== undefined) {
        delete this._attributes[k];
        if (k === 'style') {
          this._uiscene._markStyleRefreshForElement(this);
        }
        this._attrChangeEvent.name = k;
        this._attrChangeEvent.removed = true;
        this.dispatchEvent(this._attrChangeEvent);
      }
    }
  }
  hasAttribute(k: string): boolean {
    return k ? this._attributes[k.toLowerCase()] !== undefined : false;
  }
  hasAttributes(): boolean {
    return Object.getOwnPropertyNames(this._attributes).length !== 0;
  }
  insertAdjacentElement(position: string, element: RElement) {
    if (!element) {
      return null;
    }
    if (position === 'beforebegin') {
      this.before(element);
      return element;
    } else if (position === 'afterend') {
      this.after(element);
      return element;
    } else if (position === 'afterbegin') {
      this.prepend(element);
      return element;
    } else if (position === 'beforeend') {
      this.append(element);
      return element;
    }
    return null;
  }
  insertAdjacentText(position: string, text: string) {
    if (!text) {
      return null;
    }
    if (position === 'beforebegin') {
      this.before(text);
      return text;
    } else if (position === 'afterend') {
      this.after(text);
      return text;
    } else if (position === 'afterbegin') {
      this.prepend(text);
      return text;
    } else if (position === 'beforeend') {
      this.append(text);
      return text;
    }
    return null;
  }
  matches(selectorString: string): boolean {
    return this.ownerDocument.querySelectorAll(selectorString).indexOf(this) >= 0;
  }
  cloneNode(deep: boolean): RNode {
    const clone = this._uiscene.createElement(this.tagName);
    clone.classList._setValue(this.classList.value, false);
    clone._attributes = Object.assign({}, this._attributes);
    if (deep) {
      for (let child = this.firstChild; child; child = child.nextSibling) {
        clone.appendChild(child.cloneNode(deep));
      }
    }
    return clone;
  }
  replaceWith(...nodes: (RNode | string)[]): void {
    this.before(...nodes);
    this.remove();
  }
  /** @internal */
  _updateStyle(val: string) {
    super._updateStyle(val);
    this._rawSetStyleAttribute(val);
  }
  /** @internal */
  _applyInlineStyles() {
    this.style.applyStyles(this.getAttribute('style') || '', true);
  }
  /** @internal */
  protected _getNumberAttribute(name: string, defaultValue: number): number {
    const val = this.getAttribute(name);
    const num = val === null ? defaultValue : Number(val);
    return Number.isNaN(num) ? defaultValue : num;
  }
  /** @internal */
  protected _setNumberAttribute(name: string, val: number) {
    this.setAttribute(name, String(val));
  }
  /** @internal */
  protected _getStringAttribute(name: string, defaultValue: string): string {
    const val = this.getAttribute(name);
    return val ? String(val) : defaultValue;
  }
  /** @internal */
  protected _setStringAttribute(name: string, val: string) {
    this.setAttribute(name, String(val));
  }
  /** @internal */
  _rawSetStyleAttribute(style: string) {
    style = style || '';
    if (this._attributes['style'] !== style) {
      this._attributes['style'] = style;
      this._attrChangeEvent.name = 'style';
      this._attrChangeEvent.removed = false;
      this.dispatchEvent(this._attrChangeEvent);
    }
  }
  /** @internal */
  _setTagName(name: string) {
    this._tagname = name;
  }
  remove(): RNode {
    this._remove();
    return this;
  }
  before(...nodes: (RNode | string)[]): void {
    this._before(...nodes);
  }
  after(...nodes: (RNode | string)[]): void {
    this._after(...nodes);
  }
  append(...nodes: (RNode | string)[]): void {
    this._append(...nodes);
  }
  prepend(...nodes: (RNode | string)[]): void {
    this._prepend(...nodes);
  }
  querySelectorAll(selectors: string): RNodeList {
    return new RStaticNodeList(this._uiscene._querySelectorAll(this, selectors, true, false));
  }
  querySelector<T extends RElement>(selectors: string): T {
    return this._uiscene._querySelectorOne<T>(this, selectors, true, false);
  }
  getElementById(id: string): RElement {
    for (let child = this.firstElementChild; child; child = child.nextElementSibling) {
      const el = this._uiscene._getElementById(child, id);
      if (el) {
        return el;
      }
    }
    return null;
  }
  getElementsByTagName(tagName: string): RNodeList {
    const results: RElement[] = [];
    for (let child = this.firstElementChild; child; child = child.nextElementSibling) {
      this._uiscene._getElementsByTagName(child, tagName, results);
    }
    return new RStaticNodeList(results);
  }
  getElementsByClassName(classnames: string): RNodeList {
    const results: RElement[] = [];
    classnames = classnames || '';
    const classNameList = classnames.split(/\s+/).filter((val) => !!val);
    if (classNameList.length > 0) {
      for (let child = this.firstElementChild; child; child = child.nextElementSibling) {
        this._uiscene._getElementsByClassName(child, classNameList, results);
      }
    }
    return new RStaticNodeList(results);
  }
}
