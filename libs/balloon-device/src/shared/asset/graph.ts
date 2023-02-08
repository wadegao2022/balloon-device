interface ForwardStarEdge {
  to: number;
  next: number;
  weight: number;
}

export class ForwardStarGraph {
  /** @internal */
  private _edges: ForwardStarEdge[];
  /** @internal */
  private _heads: Map<number, number>;
  constructor() {
    this._edges = [];
    this._heads = new Map();
  }
  hasEdge(u: number, v: number): boolean {
    let t = this._heads.get(u);
    while (typeof t === 'number') {
      if (this._edges[t].to === v) {
        return true;
      }
      t = this._edges[t].next;
    }
    return false;
  }
  addEdge(u: number, v: number, weight?: number) {
    if (u === v) {
      throw new Error(`ForwardStarGraph.addEdge(): no support for degenerated edge (${u}, ${v})`);
    }
    const n = this._edges.length;
    this._edges.push({
      to: v,
      next: this._heads.get(u),
      weight: weight || 0,
    });
    this._heads.set(u, n);
  }
  dfsOne(p: number, callback?: (p: number) => void): boolean {
    return this._doDFS(p, new Set(), callback);
  }
  dfsAll(callback?: (p: number) => void): boolean {
    let r = false;
    const vis: Set<number> = new Set();
    this._heads.forEach((val, key) => {
      if (!vis.has(key)) {
        r ||= this._doDFS(key, vis, callback);
      }
    });
    return r;
  }
  /** @internal */
  private _doDFS(x: number, vis: Set<number>, callback?: (p: number) => void): boolean {
    callback && callback(x);
    let r = false;
    let t = this._heads.get(x);
    while (typeof t === 'number') {
      const k = this._edges[t].to;
      if (!vis.has(k)) {
        vis.add(k);
        r ||= this._doDFS(k, vis, callback);
      } else {
        r = true;
      }
      t = this._edges[t].next;
    }
    return r;
  }
}
