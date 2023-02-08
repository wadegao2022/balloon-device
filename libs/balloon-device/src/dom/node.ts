/* eslint-disable @typescript-eslint/no-unused-vars */
import { REventTarget, REvent, REventListener, REventHandlerOptions, assert, Font } from '../shared';
import { RCoord, RColor, GUIEventPathBuilder } from './types';
import { RRectPrimitive, RPolygonPrimitive, RPrimitiveBatchList } from './primitive';
import { RNodeList, RLiveNodeList } from './nodelist';
import { UIRect, UILayout } from './layout';
import { unescapeCSSString, ElementStyle, IStyleSheet } from './style';
import { RValueChangeEvent, RElementLayoutEvent, RDOMTreeEvent, RElementDrawEvent, RElementBuildContentEvent, RTextContentChangeEvent, RMouseEvent } from './events';
import { NodeType } from './values';
import type { RText } from './components/text';
import type { RElement } from './element';
import type { RDocument } from './document';
import type { GUIRenderer } from './renderer';
import type { TextureAtlas } from './texture_atlas';
import type { GUI } from './gui';

export interface RNode extends REventTarget {
  addEventListener(
    type: 'mousedown' | 'mouseup' | 'mousemove' | 'mouseclick' | 'mousedblclick',
    listener: REventListener<RMouseEvent>,
    options?: REventHandlerOptions,
  ): void;
  addEventListener(type: string, listener: REventListener, options?: REventHandlerOptions): void;
}

const defaultCursor = 'default';
const tmpUV1 = { x: 0, y: 0 };
const tmpUV2 = { x: 0, y: 0 };

export interface INodeVisitor {
  beginTraverseNode(w: RNode);
  endTraverseNode(w: RNode);
  visitNode(w: RNode): void;
}

export class RNode extends REventTarget {
  /** @internal */
  protected static readonly PSEUDO_NONE = 0;
  /** @internal */
  protected static readonly PSEUDO_BEFORE = 1;
  /** @internal */
  protected static readonly PSEUDO_AFTER = 2;
  /** @internal */
  private static readonly _drawEvent = new RElementDrawEvent();
  static readonly UNKNOWN_NODE = NodeType.UNKNOWN_NODE;
  static readonly ELEMENT_NODE = NodeType.ELEMENT_NODE;
  static readonly TEXT_NODE = NodeType.TEXT_NODE;
  static readonly DOCUMENT_NODE = NodeType.DOCUMENT_NODE;
  /** @internal */
  private static _defaultFontSize = '12px';
  /** @internal */
  private static _defaultFontFamily = 'arial';
  /** @internal */
  protected _uiscene: GUI;
  /** @internal */
  protected _parent: RNode;
  /** @internal */
  protected _childNodes: RNode[];
  /** @internal */
  protected _children: RNodeList;
  /** @internal */
  protected _childrenElements: RNodeList;
  /** @internal */
  protected _renderOrder: number[];
  /** @internal */
  protected _renderOrderChanged: boolean;
  /** @internal */
  protected _hScroll: RElement;
  /** @internal */
  protected _vScroll: RElement;
  /** @internal */
  protected _layout: UILayout;
  /** @internal */
  protected _layoutChangeStamp: number;
  /** @internal */
  protected _disableCounter: number;
  /** @internal */
  protected _mouseIn: boolean;
  /** @internal */
  protected _mouseDown: boolean;
  /** @internal */
  protected _state: number;
  /** @internal */
  protected _batchList: RPrimitiveBatchList;
  /** @internal */
  protected _numQuads: number;
  /** @internal */
  protected _contentDirty: boolean;
  /** @internal */
  protected _loadingTextures: unknown[];
  /** @internal */
  protected _backgroundColor: RColor;
  /** @internal */
  protected _backgroundImage: TextureAtlas;
  /** @internal */
  protected _borderLeftColor: RColor;
  /** @internal */
  protected _borderTopColor: RColor;
  /** @internal */
  protected _borderRightColor: RColor;
  /** @internal */
  protected _borderBottomColor: RColor;
  /** @internal */
  protected _style: ElementStyle;
  /** @internal */
  protected _hide: boolean;
  /** @internal */
  protected _internal: boolean;
  /** @internal */
  protected _pseudo: number;
  /** @internal */
  protected _font: Font;
  /** @internal */
  protected _cachedFontSize: string;
  /** @internal */
  protected _cachedFontFamily: string;
  /** @internal */
  protected _fontColor: RColor;
  /** @internal */
  protected _customDraw: boolean;
  /** @internal */
  protected _preBuildContentEvent: RElementBuildContentEvent;
  /** @internal */
  protected _postBuildContentEvent: RElementBuildContentEvent;
  /** @internal */
  protected _insertEvent: RDOMTreeEvent;
  /** @internal */
  protected _removeEvent: RDOMTreeEvent;
  /** @internal */
  constructor(uiscene: GUI) {
    super(new GUIEventPathBuilder());
    this._uiscene = uiscene;
    this._parent = null;
    this._childNodes = [];
    this._children = new RLiveNodeList(this, RLiveNodeList.MODE_NON_INTERNAL);
    this._childrenElements = new RLiveNodeList(this, RLiveNodeList.MODE_ELEMENT_NON_INTERNAL);
    this._renderOrder = [];
    this._renderOrderChanged = false;
    this._hScroll = null;
    this._vScroll = null;
    this._loadingTextures = [];
    this._backgroundColor = ElementStyle.defaultBackgroundColor;
    this._backgroundImage = null;
    this._borderLeftColor = ElementStyle.defaultBorderColor;
    this._borderTopColor = ElementStyle.defaultBorderColor;
    this._borderRightColor = ElementStyle.defaultBorderColor;
    this._borderBottomColor = ElementStyle.defaultBorderColor;
    this._layout = new UILayout(this);
    this._style = new ElementStyle(this._layout);
    this._layoutChangeStamp = -1;
    this._disableCounter = 0;
    this._batchList = new RPrimitiveBatchList(0, 0);
    this._numQuads = 0;
    this._contentDirty = true;
    this._hide = false;
    this._internal = false;
    this._pseudo = RNode.PSEUDO_NONE;
    this._font = null;
    this._cachedFontSize = null;
    this._cachedFontFamily = null;
    this._fontColor = null;
    this._customDraw = false;
    this._preBuildContentEvent = new RElementBuildContentEvent(
      RElementBuildContentEvent.NAME_PREBUILD,
      this._batchList,
    );
    this._postBuildContentEvent = new RElementBuildContentEvent(
      RElementBuildContentEvent.NAME_POSTBUILD,
      this._batchList,
    );
    this._insertEvent = new RDOMTreeEvent(RDOMTreeEvent.NAME_INSERTED, null, this);
    this._removeEvent = new RDOMTreeEvent(RDOMTreeEvent.NAME_REMOVED, null, this);
    this._resetStyle();
  }
  get gui(): GUI {
    return this._uiscene;
  }
  get nodeType(): number {
    return RNode.UNKNOWN_NODE;
  }
  get nodeName(): string {
    switch (this.nodeType) {
      case RNode.ELEMENT_NODE:
        return (this as unknown as RElement).tagName;
      case RNode.TEXT_NODE:
        return '#text';
      case RNode.DOCUMENT_NODE:
        return '#document';
      default:
        return '#unknown';
    }
  }
  get nodeValue(): string {
    switch (this.nodeType) {
      case RNode.TEXT_NODE:
        return this.textContent;
      default:
        return null;
    }
  }
  get ownerDocument(): RDocument {
    return this === (this._uiscene.document as RNode) ? null : this._uiscene.document || null;
  }
  get isConnected(): boolean {
    return this._isSucceedingOf(this._uiscene.document);
  }
  get parentNode(): RNode {
    return this._parent;
  }
  get parentElement(): RElement {
    return this._parent && this._parent.nodeType === RNode.ELEMENT_NODE
      ? (this._parent as unknown as RElement)
      : null;
  }
  get childNodes(): RNodeList {
    return this._children;
  }
  get style(): ElementStyle {
    return this._style;
  }
  get textContent(): string {
    let content = '';
    for (let child = this.firstChild; child; child = child.nextSibling) {
      content += child.textContent;
    }
    return content;
  }
  set textContent(text: string) {
    text = String(text) || '';
    text = text.trim().replace(/\s+/, ' ');
    const childrenToBeRemoved: RNode[] = [];
    for (let child = this.firstChild; child; child = child.nextSibling) {
      if (!child._isInternal()) {
        childrenToBeRemoved.push(child);
      }
    }
    for (const child of childrenToBeRemoved) {
      child._remove();
    }
    if (
      this._pseudo === RNode.PSEUDO_BEFORE ||
      this._pseudo === RNode.PSEUDO_AFTER ||
      text !== ''
    ) {
      this._append(text);
    }
  }
  get batchList(): RPrimitiveBatchList {
    this.checkContents();
    return this._batchList;
  }
  get customDraw(): boolean {
    return this._customDraw;
  }
  set customDraw(val: boolean) {
    this._customDraw = val;
  }
  isElement(): this is RElement {
    return this.nodeType === RNode.ELEMENT_NODE;
  }
  isDocument(): this is RDocument {
    return this.nodeType === RNode.DOCUMENT_NODE;
  }
  normalize() {
    let finished = false;
    let child = this.firstChild;
    while (!finished) {
      finished = true;
      for (; child; child = child.nextSibling) {
        if (child._isText()) {
          (child as RText)._normalize();
          finished = false;
          break;
        }
      }
    }
    for (child = this.firstChild; child; child = child.nextSibling) {
      child.normalize();
    }
  }
  get scrollX(): number {
    return this._layout.desiredScrollX;
  }
  set scrollX(val: number) {
    this.setScrollX(val);
  }
  setScrollX(val: number) {
    if (this._layout.desiredScrollX !== val) {
      this._layout.desiredScrollX = val;
      this._syncLayout();
    }
  }
  get scrollY(): number {
    return this._layout.desiredScrollY;
  }
  set scrollY(val: number) {
    this.setScrollY(val);
  }
  setScrollY(val: number) {
    if (this._layout.desiredScrollY !== val) {
      this._layout.desiredScrollY = val;
      this._syncLayout();
    }
  }
  setScroll(x: number, y: number) {
    if (this._layout.desiredScrollX !== x || this._layout.desiredScrollY !== y) {
      this._layout.desiredScrollX = x;
      this._layout.desiredScrollY = y;
      this._syncLayout();
    }
  }
  getRect(): UIRect {
    this._uiscene.updateLayout();
    return this._layout.actualRect;
  }
  getClippedRect(): UIRect {
    this._uiscene.updateLayout();
    return this._layout.clippedRect;
  }
  getClientRect(): UIRect {
    this._uiscene.updateLayout();
    return this._layout.clientRect;
  }
  getBorderRect(): UIRect {
    this._uiscene.updateLayout();
    return this._layout.borderRect;
  }
  /*
  enable () {
      const parentCounter = this._parent ? this._parent._disableCounter : 0;
      if (this._disableCounter > parentCounter) {
          this._disable (-1);
          this._updateState ();
      }
  }
  disable () {
      const parentCounter = this._parent ? this._parent._disableCounter : 0;
      if (this._disableCounter === parentCounter) {
          this._disable (1);
          this._updateState ();
      }
  }
  get enabled (): boolean {
      return this._disableCounter === 0;
  }
  set enabled (enable: boolean) {
      enable ? this.enable () : this.disable ();
  }
  */
  get nextSibling(): RNode {
    return this._getNextSibling(false);
  }
  get previousSibling(): RNode {
    return this._getPreviousSibling(false);
  }
  /** @internal */
  protected _remove(): RNode {
    let parent: RNode = null;
    if (this._parent) {
      parent = this._parent;
      const index = this._parent._childNodes.indexOf(this);
      assert(index >= 0, 'remove: node is not child', true);
      const focus = this._uiscene.getFocus();
      if (focus && focus._isSucceedingOf(this)) {
        this._uiscene.setFocus(null);
      }
      const captured = this._uiscene.getCapture();
      if (captured && captured._isSucceedingOf(this)) {
        this._uiscene.setCapture(null);
      }
      this._parent._removeChild(index);
      this._parent = null;
      this._disable(-this._disableCounter);
    } else {
      return null;
    }
    this._removeEvent.parent = parent;
    this._uiscene.dispatchEvent(this._removeEvent);
    return this;
  }
  /** @internal */
  protected _before(...nodes: (RNode | string)[]): void {
    assert(!!this.parentNode, 'Failed to execute before: parent element must not be null', true);
    assert(nodes.indexOf(this) < 0, 'Failed to execute before: cannot insert self node', true);
    let first: RNode = this;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (typeof node === 'string') {
        const textNode = this._uiscene.createTextNode();
        textNode.textContent = node;
        textNode.style.width = 'auto';
        textNode.style.height = 'auto';
        textNode.style.flex = '0 0 auto';
        textNode.style.cursor = 'auto';
        this.parentNode.insertBefore(textNode, first);
        first = textNode;
      } else if (node instanceof RNode) {
        this.parentNode.insertBefore(node, first);
        first = node;
      }
    }
  }
  /** @internal */
  protected _after(...nodes: (RNode | string)[]): void {
    assert(!!this.parentNode, 'Failed to execute after: parent element must not be null', true);
    assert(nodes.indexOf(this) < 0, 'Failed to execute after: cannot insert self node', true);
    const next: RNode = this.nextSibling;
    if (next) {
      next._before(...nodes);
    } else {
      this.parentNode._append(...nodes);
    }
  }
  /** @internal */
  protected _append(...nodes: (RNode | string)[]): void {
    for (const node of nodes) {
      if (typeof node === 'string') {
        const textNode = this._uiscene.createTextNode();
        textNode.textContent = node;
        textNode.style.width = 'auto';
        textNode.style.height = 'auto';
        textNode.style.flex = '0 0 auto';
        textNode.style.cursor = 'auto';
        textNode.style.backgroundColor = 'rgba(0,0,0,0)';
        this.appendChild(textNode);
      } else if (node instanceof RNode) {
        this.appendChild(node);
      }
    }
  }
  /** @internal */
  protected _prepend(...nodes: (RNode | string)[]): void {
    const first = this.firstChild;
    if (!first) {
      this._append(...nodes);
    } else {
      first._before(...nodes);
    }
  }
  cloneNode(deep: boolean): RNode {
    throw new Error(`Failed to call cloneNode(${deep})`);
  }
  getRootNode(): RNode {
    let root: RNode = this;
    while (root.parentNode) {
      root = root.parentNode;
    }
    return root;
  }
  appendChild(child: RNode): RNode {
    assert(!!child, `Failed to appendChild: element to be append is ${child}`, true);
    assert(
      !this._isSucceedingOf(child),
      `Failed to appendChild: cannot append parent element`,
      true,
    );
    const ref = this.lastChild?._layout.nextSibling()?.element;
    child._reparent(this, ref);
    return child;
  }
  insertBefore(newElement: RNode, referenceElement: RNode) {
    assert(
      referenceElement && this === referenceElement.parentNode,
      'Failed to insertBefore: reference element is not a valid elememnt or is not a child of this node',
      true,
    );
    assert(!!newElement, `Failed to insertBefore: element to be insert is ${newElement}`, true);
    assert(
      !this._isSucceedingOf(newElement),
      `Failed to insertBefore: cannot insert parent element`,
      true,
    );
    newElement._reparent(this, referenceElement);
    return newElement;
  }
  removeChild(child: RNode) {
    assert(!!child, `Failed to removeChild: element to be remove is ${child}`, true);
    assert(
      this === child.parentNode,
      'Failed to removeChild: element to be remove is not a child of this node',
      true,
    );
    return child._remove();
  }
  replaceChild(newChild: RNode, oldChild: RNode) {
    assert(!!newChild, `Failed to replaceChild: element to be insert is ${newChild}`, true);
    assert(!!oldChild, `Failed to replaceChild: element to be replaced is ${oldChild}`, true);
    assert(
      this === oldChild.parentNode,
      'Failed to replaceChild: element to be replaced is not a child of this node',
      true,
    );
    if (newChild !== oldChild) {
      const next = oldChild.nextSibling;
      this.removeChild(oldChild);
      if (next) {
        this.insertBefore(newChild, next);
      } else {
        this.appendChild(newChild);
      }
    }
    return oldChild;
  }
  get firstChild(): RNode {
    return this._getFirstChild(false);
  }
  get lastChild(): RNode {
    return this._getLastChild(false);
  }
  contains(child: RNode): boolean {
    return child && child._isSucceedingOf(this);
  }
  hasChildNodes(): boolean {
    return this.childNodes.length > 0;
  }
  setCapture() {
    if (this._isSucceedingOf(this._uiscene.document)) {
      this._uiscene.setCapture(this);
    }
  }
  releaseCapture() {
    if (this._uiscene.getCapture() === this) {
      this._uiscene.setCapture(null);
    }
  }
  traverse(v: INodeVisitor, inverse?: boolean, render?: boolean) {
    v.beginTraverseNode(this);
    if (!this._isVisible()) {
      return;
    }
    if (render) {
      if (this._renderOrderChanged) {
        this._renderOrderChanged = false;
        this._updateRenderOrders();
      }
      if (inverse) {
        for (let i = this._renderOrder.length - 1; i >= 0; i--) {
          this._childNodes[this._renderOrder[i]].traverse(v, inverse, render);
        }
        v.visitNode(this);
      } else {
        v.visitNode(this);
        for (let i = 0; i < this._renderOrder.length; i++) {
          this._childNodes[this._renderOrder[i]].traverse(v, inverse, render);
        }
      }
    } else {
      if (inverse) {
        for (let i = this._childNodes.length - 1; i >= 0; i--) {
          this._childNodes[i].traverse(v, inverse, render);
        }
        v.visitNode(this);
      } else {
        v.visitNode(this);
        for (const child of this._childNodes) {
          child.traverse(v, inverse, render);
        }
      }
    }
    v.endTraverseNode(this);
  }
  checkContents() {
    const img = this.style.backgroundImage
      ? this._uiscene.imageManager.getImage(this.style.backgroundImage)
      : null;
    if (img !== this._backgroundImage) {
      this._backgroundImage = img;
      this._contentDirty = true;
    }
    if (this._contentDirty) {
      this._contentDirty = false;
      this._batchList.clear();
      const w = this._layout.actualRect.width;
      const h = this._layout.actualRect.height;
      if (w > 0 && h > 0) {
        const v = this.toAbsolute({ x: 0, y: 0 });
        this._batchList.x = v.x;
        this._batchList.y = v.y;
        this._buildVertexData();
      }
    }
  }
  draw(renderer: GUIRenderer) {
    let drawDefault = true;
    if (this._customDraw) {
      this.gui.renderer.beginCustomDraw(this);
      RNode._drawEvent.reset();
      this.dispatchEvent(RNode._drawEvent);
      this.gui.renderer.endCustomDraw(this);
      if (RNode._drawEvent.defaultPrevented) {
        drawDefault = false;
      }
    }
    if (drawDefault) {
      this.checkContents();
      this._draw(renderer);
    }
  }
  toAbsolute(v?: RCoord): RCoord {
    return this._layout.toAbsolute(v);
  }
  /** @internal */
  _getCachedFontSize(): string {
    return this._cachedFontSize || this.parentNode?._getCachedFontSize() || RNode._defaultFontSize;
  }
  /** @internal */
  _getCachedFontFamily(): string {
    return (
      this._cachedFontFamily || this.parentNode?._getCachedFontFamily() || RNode._defaultFontFamily
    );
  }
  /** @internal */
  _getCachedFont(): Font {
    if (!this._font) {
      this._font = Font.fetchFont(`${this._getCachedFontSize()} ${this._getCachedFontFamily()}`, this._uiscene.renderer.screenToDevice(1));
      // this._font = new Font(`${this._getCachedFontSize()} ${this._getCachedFontFamily()}`);
    }
    return this._font;
  }
  /** @internal */
  _getCachedFontColor(): RColor {
    return (
      this._fontColor || this.parentNode?._getCachedFontColor() || ElementStyle.defaultFontColor
    );
  }
  /** @internal */
  _updatePseudoElementStyles(types: Map<string, { stylesheet: IStyleSheet; extra: unknown }[]>) {
    for (const name of ['before', 'after']) {
      const info = types?.get(name);
      let pseudo: number;
      let node: RNode;
      if (name === 'before') {
        pseudo = RNode.PSEUDO_BEFORE;
        node =
          this._childNodes.length > 0 && this._childNodes[0]._getPseudo() === pseudo
            ? this._childNodes[0]
            : null;
      } else {
        pseudo = RNode.PSEUDO_AFTER;
        node =
          this._childNodes.length > 0 &&
            this._childNodes[this._childNodes.length - 1]._getPseudo() === pseudo
            ? this._childNodes[this._childNodes.length - 1]
            : null;
      }
      if (info && !node) {
        node = this.ownerDocument.createElement('div');
        node._setInternal();
        node._setPseudo(pseudo);
        node.style.flex = '0 0 auto';
        node._reparent(
          this,
          name === 'before' && this._childNodes.length > 0 ? this._childNodes[0] : null,
        );
        for (const s of info) {
          node.style.applyStyleSheet(s.stylesheet, true);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const content = (info[info.length - 1].extra as any).content;
        if (info.length > 0 && typeof content === 'string') {
          const s = content.trim();
          let match = s.match(/^'([^']*)'$/);
          if (!match) {
            match = s.match(/^"([^"]*)"$/);
          }
          if (match) {
            node.textContent = unescapeCSSString(match[1]);
          }
        }
      } else if (node && !info) {
        node._remove();
      }
    }
  }
  /** @internal */
  _updateStyle(val: string) {
    this._uiscene._markStyleRefreshForElement(this);
  }
  /** @internal */
  _updateBorder() {
    this._invalidateContent();
  }
  /** @internal */
  _updateZIndex() {
    if (this._parent) {
      this._parent._markRenderOrderChanged();
    }
    return this;
  }
  /** @internal */
  _updateCursor(val: string): void { }
  /** @internal */
  _updateDisplay(val: string): void {
    this._hide = val === 'none';
  }
  /** @internal */
  _updateBorderLeftColor(val: RColor): void {
    this._borderLeftColor.r = val.r;
    this._borderLeftColor.g = val.g;
    this._borderLeftColor.b = val.b;
    this._borderLeftColor.a = val.a;
    this._invalidateContent();
  }
  /** @internal */
  _updateBorderTopColor(val: RColor): void {
    this._borderTopColor.r = val.r;
    this._borderTopColor.g = val.g;
    this._borderTopColor.b = val.b;
    this._borderTopColor.a = val.a;
    this._invalidateContent();
  }
  /** @internal */
  _updateBorderRightColor(val: RColor): void {
    this._borderRightColor.r = val.r;
    this._borderRightColor.g = val.g;
    this._borderRightColor.b = val.b;
    this._borderRightColor.a = val.a;
    this._invalidateContent();
  }
  /** @internal */
  _updateBorderBottomColor(val: RColor): void {
    this._borderBottomColor.r = val.r;
    this._borderBottomColor.g = val.g;
    this._borderBottomColor.b = val.b;
    this._borderBottomColor.a = val.a;
    this._invalidateContent();
  }
  /** @internal */
  _updateBackgroundColor(val: RColor): void {
    this._backgroundColor.r = val.r;
    this._backgroundColor.g = val.g;
    this._backgroundColor.b = val.b;
    this._backgroundColor.a = val.a;
    this._invalidateContent();
  }
  /** @internal */
  _updateFont(val: string): void {
    if (this.style.font === val) {
      this._font = val ? Font.fetchFont(val, this._uiscene.renderer.screenToDevice(1)) : null;
    }
    this._invalidateContent();
    this._invalidateLayout();
    for (const child of this._childNodes) {
      child._updateFont(val);
    }
  }
  /** @internal */
  _updateFontSize(val: string): void {
    val = val || null;
    if (this._cachedFontSize !== val) {
      this._cachedFontSize = val;
      this._font = null;
      this._invalidateContent();
      this._invalidateLayout();
      for (const child of this._childNodes) {
        child._invalidateFont(true, false);
      }
    }
  }
  /** @internal */
  _updateFontFamily(val: string): void {
    val = val || null;
    if (this._cachedFontFamily !== val) {
      this._cachedFontFamily = val;
      this._font = null;
      this._invalidateContent();
      this._invalidateLayout();
      for (const child of this._childNodes) {
        child._invalidateFont(false, true);
      }
    }
  }
  /** @internal */
  _updateFontColor(val: string): void {
    if (this.style.color === val) {
      this._fontColor = val ? this.style.parseColor(val) : null;
    }
    this._invalidateContent();
    for (const child of this._childNodes) {
      child._updateFontColor(val);
    }
  }
  /** @internal */
  _isSucceedingOf(w: RNode): boolean {
    let p: RNode = this;
    while (p && p !== w) {
      p = p.parentNode;
    }
    return !!p;
  }
  /** @internal */
  _isValid(): boolean {
    return this._uiscene && this._isSucceedingOf(this._uiscene.document);
  }
  /** @internal */
  _invalidateLayout() {
    if (this._isSucceedingOf(this._uiscene.document)) {
      this._layout.markDirty();
      this._uiscene.invalidateLayout();
    }
  }
  /** @internal */
  _invalidateContent() {
    this._contentDirty = true;
  }
  /** @internal */
  _invalidateFont(sizeChange: boolean, familyChange: boolean) {
    if (
      (sizeChange && this._cachedFontSize === null) ||
      (familyChange && this._cachedFontFamily === null)
    ) {
      this._font = null;
      this._invalidateContent();
      for (const child of this._childNodes) {
        child._invalidateFont(sizeChange, familyChange);
      }
    }
  }
  /** @internal */
  _reparent(p: RNode, at?: RNode): RNode {
    if (this._parent !== p) {
      this._remove();
      this._parent = p;
      if (p) {
        p._insertChild(this, at ? p._childNodes.indexOf(at) : -1);
        this._disable(p._disableCounter);
        this._insertEvent.parent = p;
        this._uiscene.dispatchEvent(this._insertEvent);
      }
    }
    return this;
  }
  /** @internal */
  _calcLayout() {
    this._layout.calcLayout();
    this._syncLayout();
  }
  /** @internal */
  _getClipper(clipToClient: boolean): UIRect {
    const clipper: UIRect =
      this._layout.clippedRect ||
      (clipToClient
        ? this._layout.clientRect
        : {
          x: 0,
          y: 0,
          width: this._layout.actualRect.width,
          height: this._layout.actualRect.height,
        });
    return clipper.width > 0 && clipper.height > 0 ? clipper : null;
  }
  /** @internal */
  _measureContentSize(rc: UIRect): UIRect {
    rc.width = 0;
    rc.height = 0;
    return rc;
  }
  /** @internal */
  _onMouseIn(x: number, y: number) {
    const cursor = this.style.cursor || defaultCursor;
    if (cursor !== 'auto') {
      this._uiscene.renderer.setCursorStyle(cursor);
    }
  }
  /** @internal */
  _onMouseOut(x: number, y: number) { }
  /** @internal */
  _onMouseEnter(x: number, y: number) {
    this._mouseIn = true;
    this._updateState();
  }
  /** @internal */
  _onMouseLeave(x: number, y: number) {
    this._mouseIn = false;
    this._updateState();
  }
  /** @internal */
  _onMouseDown(x: number, y: number) {
    this._mouseDown = true;
    this._updateState();
  }
  /** @internal */
  _onMouseUp(x: number, y: number) {
    this._mouseDown = false;
    this._updateState();
  }
  /** @internal */
  _getDefaultStyleSheet(): IStyleSheet {
    const style = {} as IStyleSheet;
    style.flex = '0 1 auto';
    style.flexDirection = 'row';
    style.width = 'auto';
    style.height = 'auto';
    return style;
  }
  /** @internal */
  _resetStyle() {
    this._font = null;
    this._fontColor = null;
    this.style.reset();
    this.style.applyStyleSheet(this._getDefaultStyleSheet(), false);
  }
  /** @internal */
  _applyInlineStyles() { }
  /** @internal */
  _isVisible(): boolean {
    return !this._hide && (!this._parent || this._parent._isVisible());
  }
  /** @internal */
  _getLayout(): UILayout {
    return this._layout;
  }
  /** @internal */
  _syncLayout() {
    this._layout.calcLayoutScroll();
    this._layout.calcLayoutClip();
    this._notifyLayoutEvents();
  }
  /** @internal */
  protected _updateState() {
    if (this._pseudo === RNode.PSEUDO_NONE) {
      this._uiscene._markStyleRefreshForElement(this);
    }
  }
  /** @internal */
  protected _draw(renderer: GUIRenderer) {
    if (this._batchList.length > 0) {
      this._uiscene._drawBatchList(this._batchList);
    }
  }
  /** @internal */
  protected _buildVertexData() {
    const w = this._layout.actualRect.width;
    const h = this._layout.actualRect.height;
    const img = this._backgroundImage;
    let drawPatch9 = !!(img?.topLeftPatch9 && img?.bottomRightPatch9);
    if (drawPatch9) {
      if (
        img.topLeftPatch9.x + img.bottomRightPatch9.x > this._layout.actualRect.height ||
        img.topLeftPatch9.y + img.bottomRightPatch9.y > this._layout.actualRect.width
      ) {
        drawPatch9 = false;
      }
    }
    const color = this._backgroundColor;
    const clipper = this._getClipper(false);
    if (clipper) {
      if (color.a > 0) {
        if (!drawPatch9) {
          const u1 = img?.uvMin.x || 0;
          const v1 = img?.uvMin.y || 0;
          const u2 = img?.uvMax.x || 0;
          const v2 = img?.uvMax.y || 0;
          this._batchList.addPrimitive(
            new RRectPrimitive(0, 0, w, h, u1, v1, u2, v2),
            clipper,
            this._backgroundImage?.texture || null,
            color,
          );
        } else {
          let t = img.topLeftPatch9.x;
          let l = img.topLeftPatch9.y;
          let b = img.bottomRightPatch9.x;
          let r = img.bottomRightPatch9.y;
          const u1 = img.uvMin.x;
          const v1 = img.uvMin.y;
          const u2 = img.uvMax.x;
          const v2 = img.uvMax.y;
          const aw = (this._uiscene.renderer.getTextureWidth(img.texture) * (u2 - u1) + 0.5) | 0;
          const ah = (this._uiscene.renderer.getTextureHeight(img.texture) * (v2 - v1) + 0.5) | 0;
          const ul = u1 + (u2 - u1) * l;
          const ur = u1 + (u2 - u1) * r;
          const vt = v1 + (v2 - v1) * t;
          const vb = v1 + (v2 - v1) * b;
          t = (t * ah) | 0;
          l = (l * aw) | 0;
          b = ah - ((b * ah) | 0);
          r = aw - ((r * aw) | 0);
          const quads = [
            t === 0 || l === 0 ? null : [0, 0, l, t, u1, v1, ul, vt],
            t === 0 ? null : [t, 0, w - l - r, t, ul, v1, ur, vt],
            t === 0 || r === 0 ? null : [w - r, 0, r, t, ur, v1, u2, vt],
            t + b === h ? null : [0, t, l, h - t - b, u1, vt, ul, vb],
            t + b === h ? null : [l, t, w - l - r, h - t - b, ul, vt, ur, vb],
            t + b === h ? null : [w - r, t, r, h - t - b, ur, vt, u2, vb],
            b === 0 || l === 0 ? null : [0, h - b, l, b, u1, vb, ul, v2],
            b === 0 ? null : [l, h - b, w - l - r, b, ul, vb, ur, v2],
            b === 0 || r === 0 ? null : [w - r, h - b, r, b, ur, vb, u2, v2],
          ];
          for (const q of quads) {
            if (q) {
              tmpUV1.x = q[4];
              tmpUV1.y = q[5];
              tmpUV2.x = q[6];
              tmpUV2.y = q[7];
              this._batchList.addPrimitive(
                new RRectPrimitive(q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7]),
                clipper,
                this._backgroundImage?.texture || null,
                color,
              );
            }
          }
        }
      }

      const borderLeft = this.style.borderLeftWidth
        ? parseInt(this.style.borderLeftWidth as string)
        : 0;
      const borderTop = this.style.borderTopWidth
        ? parseInt(this.style.borderTopWidth as string)
        : 0;
      const borderRight = this.style.borderRightWidth
        ? parseInt(this.style.borderRightWidth as string)
        : 0;
      const borderBottom = this.style.borderBottomWidth
        ? parseInt(this.style.borderBottomWidth as string)
        : 0;
      const borderColorLeft = this._borderLeftColor;
      const borderColorTop = this._borderTopColor;
      const borderColorRight = this._borderRightColor;
      const borderColorBottom = this._borderBottomColor;
      if (borderLeft && borderColorLeft.a > 0) {
        this._batchList.addPrimitive(
          new RPolygonPrimitive([
            { x: 0, y: 0 },
            { x: borderLeft, y: borderTop },
            { x: borderLeft, y: h - borderBottom },
            { x: 0, y: h },
          ]),
          clipper,
          null,
          borderColorLeft,
        );
      }
      if (borderTop && borderColorTop.a > 0) {
        this._batchList.addPrimitive(
          new RPolygonPrimitive([
            { x: 0, y: 0 },
            { x: w, y: 0 },
            { x: w - borderRight, y: borderTop },
            { x: borderLeft, y: borderTop },
          ]),
          clipper,
          null,
          borderColorTop,
        );
      }
      if (borderRight && borderColorRight.a > 0) {
        this._batchList.addPrimitive(
          new RPolygonPrimitive([
            { x: w - borderRight, y: borderTop },
            { x: w, y: 0 },
            { x: w, y: h },
            { x: w - borderRight, y: h - borderBottom },
          ]),
          clipper,
          null,
          borderColorRight,
        );
      }
      if (borderBottom && borderColorBottom.a > 0) {
        this._batchList.addPrimitive(
          new RPolygonPrimitive([
            { x: 0, y: h },
            { x: borderLeft, y: h - borderBottom },
            { x: w - borderRight, y: h - borderBottom },
            { x: w, y: h },
          ]),
          clipper,
          null,
          borderColorBottom,
        );
      }
    }
  }
  /** @internal */
  _isText(): boolean {
    return false;
  }
  /** @internal */
  _isInternal(): boolean {
    return this._internal;
  }
  /** @internal */
  _setInternal(): void {
    this._internal = true;
  }
  /** @internal */
  _getPseudo(): number {
    return this._pseudo;
  }
  /** @internal */
  _setPseudo(val: number) {
    this._pseudo = val;
  }
  /** @internal */
  _isHover(): boolean {
    return this._mouseIn;
  }
  /** @internal */
  _isActive(): boolean {
    return this._mouseDown;
  }
  /** @internal */
  _disable(count: number) {
    this._disableCounter += count;
    for (const child of this._childNodes) {
      child._disable(count);
    }
  }
  /** @internal */
  _markRenderOrderChanged() {
    this._renderOrderChanged = true;
  }
  /** @internal */
  _updateRenderOrders() {
    this._renderOrder = this._childNodes.map((val, index) => index);
    // do stable sort
    this._renderOrder.sort(
      (a, b) => this._childNodes[a]._getZIndex() - this._childNodes[b]._getZIndex() || a - b,
    );
  }
  /** @internal */
  _notifyLayoutEvents() {
    if (this._layout.changeStamp !== this._layoutChangeStamp) {
      this._layoutChangeStamp = this._layout.changeStamp;
      this._invalidateContent();
      this.dispatchEvent(new RElementLayoutEvent());
    }
    this._updateScrollState();
    for (const child of this._childNodes) {
      child._notifyLayoutEvents();
    }
  }
  /** @internal */
  _notifyTextContentEvents() {
    this.dispatchEvent(new RTextContentChangeEvent());
  }
  /** @internal */
  _getZIndex(): number {
    let val = Number(this.style.zIndex);
    if (Number.isNaN(val)) {
      val = 0;
    }
    return val;
  }
  /** @internal */
  _removeChild(index: number) {
    this._layout.removeChild(this._childNodes[index]._getLayout());
    this._childNodes.splice(index, 1);
    this._invalidateLayout();
    this._markRenderOrderChanged();
  }
  /** @internal */
  _insertChild(child: RNode, index = -1) {
    if (index >= 0) {
      let p = this._childNodes[index];
      this._layout.insertChild(child._getLayout(), p._getLayout());
      this._childNodes.splice(index, 0, child);
      if (child.nodeType === RNode.ELEMENT_NODE) {
        for (; p; p = p.nextSibling) {
          if (p.nodeType === RNode.ELEMENT_NODE) {
            break;
          }
        }
      }
    } else {
      this._layout.appendChild(child._getLayout());
      this._childNodes.push(child);
    }
    this._invalidateLayout();
    this._markRenderOrderChanged();
  }
  /** @internal */
  _getChildren(): RNode[] {
    return this._childNodes;
  }
  /** @internal */
  protected _getFirstChild(element: boolean): RNode {
    for (
      let child = this._layout.firstChild()?.element;
      child;
      child = child._layout.nextSibling()?.element
    ) {
      if (!child._isInternal() && (!element || child.nodeType === RNode.ELEMENT_NODE)) {
        return child;
      }
    }
    return null;
  }
  /** @internal */
  _getLastChild(element: boolean): RNode {
    for (
      let child = this._layout.lastChild()?.element;
      child;
      child = child._layout.previousSibling()?.element
    ) {
      if (!child._isInternal() && (!element || child.nodeType === RNode.ELEMENT_NODE)) {
        return child;
      }
    }
    return null;
  }
  /** @internal */
  _getNextSibling(element: boolean): RNode {
    let result: RNode = this;
    do {
      result = result._layout.nextSibling()?.element || null;
    } while (
      result &&
      (result._isInternal() || (!!element && result.nodeType !== RNode.ELEMENT_NODE))
    );
    return result;
  }
  /** @internal */
  _getPreviousSibling(element: boolean): RNode {
    let result: RNode = this;
    do {
      result = result._layout.previousSibling()?.element || null;
    } while (
      result &&
      (result._isInternal() || (!!element && result.nodeType !== RNode.ELEMENT_NODE))
    );
    return result;
  }
  /** @internal */
  _init(): void {
  }
  /** @internal */
  protected _updateScrollState(): void {
    const overflowX = this.style.overflowX || 'auto';
    const overflowY = this.style.overflowY || 'auto';
    let xOverflow =
      overflowX === 'scroll' ||
      (overflowX === 'auto' &&
        this._layout.scrollRect !== null &&
        this._layout.scrollRect.width > this._layout.actualRect.width);
    let yOverflow =
      overflowY === 'scroll' ||
      (overflowY === 'auto' &&
        this._layout.scrollRect !== null &&
        this._layout.scrollRect.height > this._layout.actualRect.height);
    const scrollBarSize = 12;
    const blockSize = 8;
    const buttonSize = 12;
    if (xOverflow) {
      const width = yOverflow
        ? this._layout.clientRect.width - scrollBarSize
        : this._layout.clientRect.width;
      if (this._layout.clientRect.height < scrollBarSize || width < 2 * buttonSize + blockSize) {
        xOverflow = false;
      } else {
        if (!this._hScroll) {
          this._hScroll = this._uiscene.createElement('scrollbar');
          this._hScroll.style.position = 'fixed';
          this._hScroll.style.zIndex = 999999;
          this._hScroll.style.height = scrollBarSize;
          this._hScroll.setAttribute('orientation', 'horizonal');
          this._hScroll.setAttribute('blockSize', String(blockSize));
          this._hScroll.setAttribute('buttonSize', String(buttonSize));
          this._hScroll._setInternal();
          this._hScroll.addDefaultEventListener(RValueChangeEvent.NAME, (e: REvent) => {
            const data: RValueChangeEvent = e as RValueChangeEvent;
            this.scrollX = data.value;
          });
          this.appendChild(this._hScroll);
        }
        this._hScroll.setAttribute('rangeStart', String(this._layout.minScrollX));
        this._hScroll.setAttribute('rangeEnd', String(this._layout.maxScrollX));
        this._hScroll.setAttribute('value', String(this.scrollX));
        this._hScroll.style.left = this._layout.clientRect.x - this._layout.borderRect.x;
        this._hScroll.style.width = width;
        this._hScroll.style.bottom =
          this._layout.borderRect.height -
          this._layout.clientRect.height -
          this._layout.clientRect.y +
          this._layout.borderRect.y;
      }
    }
    if (!xOverflow && this._hScroll) {
      this.removeChild(this._hScroll);
      this._hScroll = null;
    }
    if (yOverflow) {
      const height = xOverflow
        ? this._layout.clientRect.height - scrollBarSize
        : this._layout.clientRect.height;
      if (this._layout.clientRect.width < scrollBarSize || height < 2 * buttonSize + blockSize) {
        yOverflow = false;
      } else {
        if (!this._vScroll) {
          this._vScroll = this._uiscene.createElement('scrollbar');
          this._vScroll.style.position = 'fixed';
          this._vScroll.style.zIndex = 999999;
          this._vScroll.style.width = scrollBarSize;
          this._vScroll.setAttribute('orientation', 'vertical');
          this._vScroll.setAttribute('blockSize', String(blockSize));
          this._vScroll.setAttribute('buttonSize', String(buttonSize));
          this._vScroll._setInternal();
          this._vScroll.addDefaultEventListener(RValueChangeEvent.NAME, (e: REvent) => {
            const data: RValueChangeEvent = e as RValueChangeEvent;
            this.scrollY = data.value;
          });
          this.appendChild(this._vScroll);
        }
        this._vScroll.setAttribute('rangeStart', String(this._layout.minScrollY));
        this._vScroll.setAttribute('rangeEnd', String(this._layout.maxScrollY));
        this._vScroll.setAttribute('value', String(this.scrollY));
        this._vScroll.style.top = this._layout.clientRect.y - this._layout.borderRect.y;
        this._vScroll.style.height = height;
        this._vScroll.style.right =
          this._layout.borderRect.width -
          this._layout.clientRect.width -
          this._layout.clientRect.x +
          this._layout.borderRect.x;
      }
    }
    if (!yOverflow && this._vScroll) {
      this.removeChild(this._vScroll);
      this._vScroll = null;
    }
  }
}
