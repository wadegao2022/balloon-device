import {RElement} from './element';
import {tagname} from './gui';
import type {GUI} from './gui';
import type {IStyleSheet} from './style';

@tagname('link')
@tagname('head')
@tagname('meta')
export class DummyElement extends RElement {
  constructor(uiscene: GUI) {
    super(uiscene);
  }
  /** @internal */
  _getDefaultStyleSheet(): IStyleSheet {
    return {display: 'none'};
  }
}
