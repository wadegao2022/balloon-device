import {RElement} from './element';
import {tagname} from './gui';
import type {GUI} from './gui';
import type {IStyleSheet} from './style';

@tagname('html')
@tagname('body')
export class RFlowElement extends RElement {
  constructor(uiscene: GUI) {
    super(uiscene);
  }
  /** @internal */
  _getDefaultStyleSheet(): IStyleSheet {
    const style = {} as IStyleSheet;
    style.width = '100%';
    style.height = 'auto';
    style.flexDirection = 'column';
    style.justifyContent = 'flex-start';
    style.alignItems = 'stretch';
    style.flex = '0 0 auto';
    style.overflow = 'auto';
    return style;
  }
}
