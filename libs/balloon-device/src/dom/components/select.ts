import {RText} from './text';
import {tagname} from '../gui';
import {RElementLayoutEvent, RTextEvent, RChangeEvent} from '../events';
import {RNode} from '../node';
import {RElement} from '../element';
import type {GUI} from '../gui';
import type {IStyleSheet} from '../style';

@tagname('option')
export class Option extends RElement {
  /** @internal */
  private _hiddenOption: HTMLOptionElement;
  constructor(uiscene: GUI) {
    super(uiscene);
    this._hiddenOption = document.createElement('option');
  }
  /** @internal */
  _getHiddenOption(): HTMLOptionElement {
    return this._hiddenOption;
  }
  /** @internal */
  _getDefaultStyleSheet(): IStyleSheet {
    const style = super._getDefaultStyleSheet();
    style.width = '0px';
    style.height = '0px';
    style.backgroundColor = 'transparent';
    style.display = 'none';
    return style;
  }
  setAttribute(k: string, v?: string) {
    this._hiddenOption.setAttribute(k, v || '');
    super.setAttribute(k, v);
  }
  /** @internal */
  _reparent(p: RNode, at?: RNode): RNode {
    if (p.nodeType === RNode.ELEMENT_NODE && (p as RElement).tagName === 'select') {
      let nextOption: RNode;
      for (
        nextOption = this._getNextSibling(true);
        nextOption && (nextOption as RElement).tagName !== 'option';
        nextOption = nextOption._getNextSibling(true)
      );
      if (nextOption) {
        (p as Select)
          ._getHiddenInput()
          .insertBefore(this._hiddenOption, (nextOption as Option)._getHiddenOption());
      } else {
        (p as Select)._getHiddenInput().appendChild(this._hiddenOption);
      }
    }
    return super._reparent(p, at);
  }
  /** @internal */
  protected _remove(): RNode {
    if (
      this._parent &&
      this._parent.nodeType === RNode.ELEMENT_NODE &&
      (this._parent as RElement).tagName === 'select'
    ) {
      (this._parent as Select)._getHiddenInput().removeChild(this._hiddenOption);
    }
    return super._remove();
  }
  /** @internal */
  _insertChild(child: RNode, index: number) {
    super._insertChild(child, index);
    this._hiddenOption.textContent = this.textContent;
  }
  /** @internal */
  _removeChild(index: number) {
    super._removeChild(index);
    this._hiddenOption.textContent = this.textContent;
  }
}

@tagname('select')
export class Select extends RElement {
  /** @internal */
  private _hiddenInput: HTMLSelectElement;
  /** @internal */
  private _text: RText;
  constructor(uiscene: GUI) {
    super(uiscene);
    this._text = new RText(this._uiscene);
    this._text._setInternal();
    this._text.style.backgroundColor = 'transparent';
    this._text.style.flex = '1 0 auto';
    this.appendChild(this._text);
    this._hiddenInput = document.createElement('select');
    this._hiddenInput.style.position = 'absolute';
    this._hiddenInput.style.boxSizing = 'border-box';
    this._hiddenInput.style.opacity = '0';
    this._hiddenInput.style.outline = 'none';
    this._hiddenInput.style.pointerEvents = 'none';
    this._hiddenInput.style.zIndex = '0';
    this._hiddenInput.style.transform = 'scaleY(0)';
    this._hiddenInput.style.transformOrigin = 'top';
    this._updateHiddenInput();
    document.body.appendChild(this._hiddenInput);
    this.addDefaultEventListener(RElementLayoutEvent.NAME, function (this: Select) {
      this._updateHiddenInput();
    });
    this.addDefaultEventListener(RTextEvent.NAME_FONT_CHANGE, function (this: Select) {
      that._updateHiddenInput();
    });
    const that = this;
    this._hiddenInput.addEventListener('input', function () {
      that._oninput();
    });
    this._hiddenInput.addEventListener('change', function () {
      console.log(`select change: ${that._hiddenInput.value}`);
      that.dispatchEvent(new RChangeEvent());
    });
  }
  get value() {
    return this._hiddenInput.value;
  }
  /** @internal */
  private _oninput() {
    this._text.textContent = this._hiddenInput.options[this._hiddenInput.selectedIndex].textContent;
  }
  /** @internal */
  _init(): void {
  }
  /** @internal */
  _getDefaultStyleSheet(): IStyleSheet {
    const style = super._getDefaultStyleSheet();
    style.width = 'auto';
    style.height = 'auto';
    style.color = '#000000';
    style.padding = '5';
    style.justifyContent = 'flex-start';
    style.backgroundColor = '#fff';
    style.borderWidth = '1px';
    style.borderColor = '#000';
    style.overflow = 'hidden';
    return style;
  }
  /** @internal */
  _getHiddenInput(): HTMLSelectElement {
    return this._hiddenInput;
  }
  /** @internal */
  _updateHiddenInput() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let el: any = this._uiscene.renderer.getCanvas();
    const v = this.toAbsolute({x: 0, y: 0});
    let t = v.y;
    let l = v.x;
    if (el instanceof HTMLCanvasElement) {
      t += el.offsetTop;
      l += el.offsetLeft;
      while ((el = el.offsetParent)) {
        t += el.offsetTop;
        l += el.offsetLeft;
      }
    }
    this._hiddenInput.style.transform = '';
    this._hiddenInput.style.pointerEvents = 'auto';
    this._hiddenInput.style.left = `${l}px`;
    this._hiddenInput.style.top = `${t}px`;
    this._hiddenInput.style.width = `${this.getRect().width}px`;
    this._hiddenInput.style.height = `${this.getRect().height}px`;
    this._hiddenInput.style.font = `${this._getCachedFont().size}px ${
      this._getCachedFont().family
    }`;
  }
  /** @internal */
  _insertChild(child: RNode, index: number) {
    super._insertChild(child, index);
    this._text.textContent = this._hiddenInput?.options
      ? this._hiddenInput.options[this._hiddenInput.selectedIndex]?.textContent
      : '';
  }
  /** @internal */
  _removeChild(index: number) {
    super._removeChild(index);
    this._text.textContent = this._hiddenInput?.options
      ? this._hiddenInput.options[this._hiddenInput.selectedIndex]?.textContent
      : '';
  }
}
