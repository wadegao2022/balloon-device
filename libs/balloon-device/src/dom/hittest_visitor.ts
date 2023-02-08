import type {RNode} from './node';

export class GUIHitTestVisitor {
  /** @internal */
  private _x: number;
  /** @internal */
  private _y: number;
  /** @internal */
  private _hits: {element: RNode; x: number; y: number}[];
  constructor(x: number, y: number) {
    this._x = x;
    this._y = y;
    this._hits = [];
  }
  getHits(): {element: RNode; x: number; y: number}[] {
    return this._hits;
  }
  beginTraverseNode() {}
  endTraverseNode() {}
  visitNode(w: RNode) {
    if (w.isDocument()) {
      this._hits.push({
        element: w,
        x: this._x,
        y: this._y,
      });
    } else if (w._isVisible() && !w._isText()) {
      const v = w.toAbsolute({x: 0, y: 0});
      const x = this._x - v.x;
      const y = this._y - v.y;
      const rc = w.getClippedRect();
      const cx1 = rc ? rc.x : 0;
      const cy1 = rc ? rc.y : 0;
      const cx2 = rc ? rc.x + rc.width : w.getRect().width;
      const cy2 = rc ? rc.y + rc.height : w.getRect().height;
      if (x >= cx1 && x < cx2 && y >= cy1 && y < cy2) {
        this._hits.push({
          element: w,
          x: x,
          y: y,
        });
      }
    }
  }
}
