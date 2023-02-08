import {RElement} from './element';
import {tagname} from './gui';
import {RTextContentChangeEvent} from './events';
import type {GUI} from './gui';
import type {RSelector} from './selector';
import type {IStyleSheet} from './style';

/** @internal */
export interface IStyleDefiniation {
  selector: RSelector;
  stylesheet: IStyleSheet;
  extra: unknown;
}

@tagname('style')
export class StyleElement extends RElement {
  /** @internal */
  private _definitions: IStyleDefiniation[];
  constructor(uiscene: GUI) {
    super(uiscene);
    this._definitions = [];
    this.addDefaultEventListener(RTextContentChangeEvent.NAME, () => {
      this._update();
    });
  }
  /** @internal */
  get definitions(): IStyleDefiniation[] {
    return this._definitions;
  }
  /** @internal */
  private _update() {
    this._definitions = this._uiscene._parseStyleContent(this.textContent);
    if (this._isSucceedingOf(this._uiscene.document)) {
      this._uiscene.requireFullStyleRefresh();
    }
  }
  /** @internal */
  _getDefaultStyleSheet(): IStyleSheet {
    const style = {} as IStyleSheet;
    style.display = 'none';
    return style;
  }
}
