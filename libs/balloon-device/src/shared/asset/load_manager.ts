export class LoadManager {
  /** @internal */
  private _numItems: number;
  /** @internal */
  private _numLoadedItems: number;
  /** @internal */
  private static _tempElement: HTMLAnchorElement = null;
  constructor() {
    this._numItems = 0;
    this._numLoadedItems = 0;
  }
  get numItems() {
    return this._numItems;
  }
  get numLoadedItems() {
    return this._numLoadedItems;
  }
  beginLoad(url: string): string {
    url = LoadManager.resolveURL(url);
    this._numItems++;
    return url;
  }
  endLoad(url: string, succ: boolean) {
    if (succ) {
      this._numLoadedItems++;
    }
    url = LoadManager.resolveURL(url);
  }
  static resolveURL(url: string): string {
    if (!this._tempElement) {
      this._tempElement = document.createElement('a');
    }
    this._tempElement.href = url;
    return this._tempElement.href;
  }
}
