import {base64ToU8} from '../utils';
import {LoadManager} from './load_manager';

export class AssetURL {
  /** @internal */
  private static readonly DATAURI_REGEX = /^data:([^;,]+)?((?:;(?:[^;,]+))*?)(;base64)?,(.*)$/;
  /** @internal */
  private _url: string;
  /** @internal */
  private _urlObject: URL;
  /** @internal */
  private _media: string;
  /** @internal */
  private _mimeType: string;
  /** @internal */
  private _charset: string;
  /** @internal */
  private _decodedBody: string | Uint8Array;
  /** @internal */
  private _body: string;
  /** @internal */
  private _base64: boolean;
  constructor(url: string) {
    this._url = url ? LoadManager.resolveURL(url) : null;
    this._urlObject = this._url ? new URL(this._url) : null;
    this._parseDataURI();
  }
  get scheme(): string {
    return this._urlObject ? this._urlObject.protocol : null;
  }
  get port(): number {
    return this._urlObject ? Number(this._urlObject.port) : null;
  }
  get host(): string {
    return this._urlObject ? this._urlObject.hostname : null;
  }
  get path(): string {
    return this._urlObject ? this._urlObject.pathname : null;
  }
  get hash(): string {
    return this._urlObject ? this._urlObject.hash : null;
  }
  get origin(): string {
    return this._urlObject ? this._urlObject.origin : null;
  }
  get href(): string {
    return this._urlObject ? this._urlObject.href : null;
  }
  get media(): string {
    return this._media;
  }
  get mimeType(): string {
    return this._mimeType;
  }
  get charset(): string {
    return this._charset;
  }
  get body(): string {
    return this._body;
  }
  get decodedBody(): string | Uint8Array {
    if (this.isDataURI() && !this._decodedBody) {
      this._decodedBody = this._base64 ? base64ToU8(this._body) : decodeURIComponent(this._body);
    }
    return this._decodedBody;
  }
  isDataURI(): boolean {
    return !!this._mimeType;
  }
  /** @internal */
  private _parseDataURI() {
    this._media = null;
    this._mimeType = null;
    this._charset = null;
    this._decodedBody = null;
    this._body = null;
    this._base64 = false;
    const m = (this._url && AssetURL.DATAURI_REGEX.exec(this._url)) || null;
    if (m) {
      this._base64 = !!m[3];
      this._body = m[4];
      if (m[1]) {
        this._mimeType = m[1];
        this._media = `${this._mimeType}${m[2] || ''}`;
      } else {
        this._mimeType = 'text/plain';
        if (m[2]) {
          this._media = `${this._mimeType}${m[2]}`;
        } else {
          this._charset = 'US-ASCII';
          this._media = `${this._mimeType};charset=${this._charset}`;
        }
      }
      if (!this._charset && m[2]) {
        const cm = /;charset=([^;,]+)/.exec(m[2]);
        if (cm) {
          this._charset = cm[1];
        }
      }
    }
  }
}
