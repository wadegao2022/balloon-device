import {RNode} from './node';
import {RNodeList, RStaticNodeList} from './nodelist';
import type {RElement} from './element';
import type { RText } from './components/text';
import type {GUI} from './gui';
import type {IStyleSheet} from './style';

export class RDocument extends RNode {
  /** @internal */
  private _textContent: string;
  constructor(uiscene: GUI) {
    super(uiscene);
    this._textContent = '';
  }
  get nodeType(): number {
    return RNode.DOCUMENT_NODE;
  }
  get nodeName(): string {
    return '#document';
  }
  get head(): RElement {
    return this.querySelector('head');
  }
  get body(): RElement {
    return this.querySelector('body');
  }
  get baseURI(): string {
    return this._uiscene.baseURI;
  }
  set baseURI(val: string) {
    this._uiscene.baseURI = val;
  }
  get textContent(): string {
    return this._textContent;
  }
  set textContent(val: string) {
    this._textContent = val;
  }
  get documentElement(): RElement {
    return this.firstElementChild || null;
  }
  get children(): RNodeList {
    return this._childrenElements;
  }
  get childElementCount(): number {
    return this._childrenElements.length;
  }
  get firstElementChild(): RElement {
    return this._getFirstChild(true) as RElement;
  }
  get lastElementChild(): RElement {
    return this._getLastChild(true) as RElement;
  }
  appendChild(child: RNode): RNode {
    if (child.nodeType !== RNode.ELEMENT_NODE) {
      throw new Error('Failed to execute appendChild: only element can be inserted into document');
    } else if (this.childElementCount > 0) {
      throw new Error(
        'Failed to execute appendChild: only one element can be inserted into document',
      );
    }
    return super.appendChild(child);
  }
  insertBefore(newElement: RNode, referenceElement: RNode) {
    if (!newElement || newElement.nodeType !== RNode.ELEMENT_NODE) {
      throw new Error('Failed to execute insertBefore: only element can be inserted into document');
    } else if (referenceElement || this.childElementCount > 0) {
      throw new Error(
        'Failed to execute insertBefore: only one element can be inserted into document',
      );
    }
    return super.appendChild(newElement);
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
  getElementsByTagName(tagname: string): RNodeList {
    const results: RElement[] = [];
    for (let child = this.firstElementChild; child; child = child.nextElementSibling) {
      this._uiscene._getElementsByTagName(child, tagname, results);
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
  getElementById(id: string): RElement {
    return this._uiscene._getElementById(this, id);
  }
  createElement<T extends RElement = RElement>(tagname: string): T {
    return this._uiscene.createElement<T>(tagname);
  }
  createTextNode(): RText {
    return this._uiscene.createTextNode();
  }
  /** @internal */
  _getDefaultStyleSheet(): IStyleSheet {
    return {
      position: 'absolute',
      flexDirection: 'column',
      left: '0px',
      top: '0px',
      right: '0px',
      bottom: '0px',
      overflow: 'auto',
      backgroundColor: 'rgba(0,0,0,0)',
    };
  }
}
