import { REvent } from '../shared';
import type { RNode } from './node';
import type { RPrimitiveBatchList } from './primitive';

export class RResizeEvent extends REvent {
  static readonly NAME = 'resize';
  constructor() {
    super(RResizeEvent.NAME, false, false);
  }
}

export class RMouseEvent extends REvent {
  static readonly NAME_RENDERER_MOUSEDOWN = 'renderermousedown';
  static readonly NAME_RENDERER_MOUSEUP = 'renderermouseup';
  static readonly NAME_RENDERER_MOUSEMOVE = 'renderermousemove';
  static readonly NAME_RENDERER_MOUSECLICK = 'rendererclick';
  static readonly NAME_RENDERER_MOUSEDBLCLICK = 'rendererdblclick';
  static readonly NAME_RENDERER_MOUSEWHEEL = 'renderermousewheel';
  static readonly NAME_RENDERER_DRAGENTER = 'rendererdragenter';
  static readonly NAME_RENDERER_DRAGOVER = 'rendererdragover';
  static readonly NAME_RENDERER_DRAGDROP = 'rendererdragdrop';
  static readonly NAME_MOUSEDOWN = 'mousedown';
  static readonly NAME_MOUSEUP = 'mouseup';
  static readonly NAME_MOUSEMOVE = 'mousemove';
  static readonly NAME_MOUSECLICK = 'click';
  static readonly NAME_MOUSEDBLCLICK = 'dblclick';
  static readonly NAME_MOUSEWHEEL = 'wheel';
  static readonly NAME_MOUSEENTER = 'mouseenter';
  static readonly NAME_MOUSELEAVE = 'mouseleave';
  static readonly NAME_MOUSEOVER = 'mouseover';
  static readonly NAME_MOUSEOUT = 'mouseout';
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  button: number;
  buttons: number;
  wheelDeltaX: number;
  wheelDeltaY: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  relatedTarget: unknown;
  constructor(
    type: string,
    x: number,
    y: number,
    offsetX: number,
    offsetY: number,
    button: number,
    buttons: number,
    wheelDeltaX: number,
    wheelDeltaY: number,
    ctrlKey: boolean,
    shiftKey: boolean,
    altKey: boolean,
    metaKey: boolean,
  ) {
    super(type, type !== RMouseEvent.NAME_MOUSEENTER && type !== RMouseEvent.NAME_MOUSELEAVE, true);
    this.relatedTarget = null;
    this.init(x, y, offsetX, offsetY, button, buttons, wheelDeltaX, wheelDeltaY, ctrlKey, shiftKey, altKey, metaKey);
  }
  init(
    x: number,
    y: number,
    offsetX: number,
    offsetY: number,
    button: number,
    buttons: number,
    wheelDeltaX: number,
    wheelDeltaY: number,
    ctrlKey: boolean,
    shiftKey: boolean,
    altKey: boolean,
    metaKey: boolean,
  ) {
    this.x = x;
    this.y = y;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.button = button;
    this.buttons = buttons;
    this.wheelDeltaX = wheelDeltaX;
    this.wheelDeltaY = wheelDeltaY;
    this.ctrlKey = ctrlKey;
    this.shiftKey = shiftKey;
    this.altKey = altKey;
    this.metaKey = metaKey;
  }
}

export class RDragEvent extends RMouseEvent {
  static readonly NAME_DRAG = 'drag';
  static readonly NAME_DRAGSTART = 'dragstart';
  static readonly NAME_DRAGEND = 'dragend';
  static readonly NAME_DRAGOVER = 'dragover';
  static readonly NAME_DRAGENTER = 'dragenter';
  static readonly NAME_DRAGLEAVE = 'dragleave';
  static readonly NAME_DRAGDROP = 'drop';
  dataTransfer: DataTransfer;
  constructor(
    type: string,
    x: number,
    y: number,
    offsetX: number,
    offsetY: number,
    button: number,
    buttons: number,
    ctrlKey: boolean,
    shiftKey: boolean,
    altKey: boolean,
    metaKey: boolean,
    dataTransfer: DataTransfer,
  ) {
    super(type, x, y, offsetX, offsetY, button, buttons, 0, 0, ctrlKey, shiftKey, altKey, metaKey);
    this.dataTransfer = dataTransfer;
  }
}

export class RKeyEvent extends REvent {
  static readonly NAME_RENDERER_KEYDOWN = 'rendererkeydown';
  static readonly NAME_RENDERER_KEYUP = 'rendererkeyup';
  static readonly NAME_RENDERER_KEYPRESS = 'rendererkeypress';
  static readonly NAME_KEYDOWN = 'keydown';
  static readonly NAME_KEYUP = 'keyup';
  static readonly NAME_KEYPRESS = 'keypress';
  code: string;
  key: string;
  repeat: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  constructor(
    type: string,
    code: string,
    key: string,
    repeat: boolean,
    ctrlKey: boolean,
    shiftKey: boolean,
    altKey: boolean,
    metaKey: boolean,
  ) {
    super(type, true, true);
    this.code = code;
    this.key = key;
    this.repeat = repeat;
    this.ctrlKey = ctrlKey;
    this.shiftKey = shiftKey;
    this.altKey = altKey;
    this.metaKey = metaKey;
  }
}

export class RFocusEvent extends REvent {
  static readonly NAME_FOCUS = 'focus';
  static readonly NAME_BLUR = 'blur';
  constructor(type: string) {
    super(type, false, false);
  }
}

export class RElementLayoutEvent extends REvent {
  static readonly NAME = 'layout';
  constructor() {
    super(RElementLayoutEvent.NAME, false, false);
  }
}

export class RElementDrawEvent extends REvent {
  static readonly NAME = 'draw';
  constructor() {
    super(RElementDrawEvent.NAME, false, false);
  }
}

export class RElementBuildContentEvent extends REvent {
  static readonly NAME_PREBUILD = 'prebuildcontent';
  static readonly NAME_POSTBUILD = 'postbuildcontent';
  batchList: RPrimitiveBatchList;
  constructor(type: string, batchList: RPrimitiveBatchList) {
    super(type, false, false);
    this.batchList = batchList;
  }
}

export class RTextEvent extends REvent {
  static readonly NAME_CONTENT_CHANGE = 'textcontentchange';
  static readonly NAME_FONT_CHANGE = 'textfontchange';
  constructor(type: string) {
    super(type, false, false);
  }
}

export class RValueChangeEvent extends REvent {
  static readonly NAME = 'valuechange';
  value: number;
  constructor(value: number) {
    super(RValueChangeEvent.NAME, false, false);
    this.value = value;
  }
}

export class RAttributeChangeEvent extends REvent {
  static readonly NAME = 'attributechange';
  name: string;
  removed: boolean;
  constructor(name: string, removed: boolean) {
    super(RAttributeChangeEvent.NAME, false, false);
    this.name = name;
    this.removed = removed;
  }
}

export class RTextContentChangeEvent extends REvent {
  static readonly NAME = 'elementtextcontentchange';
  constructor() {
    super(RTextContentChangeEvent.NAME, true, true);
  }
}

export class RChangeEvent extends REvent {
  static readonly NAME = 'change';
  constructor() {
    super(RChangeEvent.NAME, true, false);
  }
}

export class RDOMTreeEvent extends REvent {
  static readonly NAME_INSERTED = 'elementinserted';
  static readonly NAME_REMOVED = 'elementremoved';
  static readonly NAME_FOCUSED = 'elementfocused';
  parent: RNode;
  node: RNode;
  constructor(type: string, parent: RNode, node: RNode) {
    super(type, type !== RDOMTreeEvent.NAME_FOCUSED, type !== RDOMTreeEvent.NAME_FOCUSED);
    this.parent = parent;
    this.node = node;
  }
}
