import {LoadManager} from './load_manager';
import {AbstractLoader} from './loader';
import {AssetURL} from './asseturl';
import {stringToU8, u8ToString} from '../utils';

type FileContentType = ArrayBuffer | Blob | Document | object | string;
export class FileLoader extends AbstractLoader<FileContentType> {
  /** @internal */
  private _responseType: XMLHttpRequestResponseType;
  /** @internal */
  private _mimeType: string;
  /** @internal */
  private _headers: {[name: string]: string};
  constructor(
    manager?: LoadManager,
    responseType?: XMLHttpRequestResponseType,
    mimeType?: string,
    headers?: {[name: string]: string},
  ) {
    super(manager);
    this._responseType = responseType || null;
    this._mimeType = mimeType || null;
    this._headers = headers || {};
  }
  get responseType() {
    return this._responseType;
  }
  set responseType(val: XMLHttpRequestResponseType) {
    this._responseType = val;
  }
  get mimeType() {
    return this._mimeType;
  }
  set mimeType(val: string) {
    this._mimeType = val;
  }
  get headers() {
    return this._headers;
  }
  set headers(val) {
    this._headers = val;
  }
  async load(url: string) {
    this._manager && this._manager.beginLoad(url);
    return new Promise<FileContentType>((resolve, reject) => {
      const assetURL = new AssetURL(url);
      if (assetURL.isDataURI()) {
        // adapt from THREE.js
        const mimeType = assetURL.mimeType;
        const decodedBody = assetURL.decodedBody;
        try {
          const responseType = (this._responseType || '').toLowerCase();
          switch (responseType) {
          case 'arraybuffer':
          case 'blob': {
            let view: Uint8Array = null;
            if (typeof decodedBody === 'string') {
              view = stringToU8(decodedBody);
            } else {
              view = decodedBody;
            }
            if (responseType === 'blob') {
              this._object = new Blob([view.buffer], {type: mimeType});
            } else {
              this._object = view.buffer;
            }
            break;
          }
          case 'document': {
            const doc = typeof decodedBody === 'string' ? decodedBody : u8ToString(decodedBody);
            const parser = new DOMParser();
            this._object = parser.parseFromString(doc, mimeType as DOMParserSupportedType);
            break;
          }
          case 'json': {
            const doc = typeof decodedBody === 'string' ? decodedBody : u8ToString(decodedBody);
            this._object = JSON.parse(doc);
            break;
          }
          case 'text': {
            this._object =
                typeof decodedBody === 'string' ? decodedBody : u8ToString(decodedBody);
            break;
          }
          default:
            this._object = assetURL.decodedBody;
            break;
          }
          this._manager && this._manager.endLoad(url, true);
          resolve(this._object);
        } catch (error) {
          this._manager && this._manager.endLoad(url, false);
          reject(error);
        }
      } else {
        const that = this;
        const request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.addEventListener('load', function (event) {
          that._object = this.response;
          if (this.status === 200 || this.status === 0) {
            that._manager && that._manager.endLoad(url, true);
            resolve(that._object);
          } else {
            that._manager && that._manager.endLoad(url, false);
            reject(event);
          }
        });
        request.addEventListener('error', function (event) {
          that._manager && that._manager.endLoad(url, false);
          reject(event);
        });
        request.addEventListener('abort', function (event) {
          that._manager && that._manager.endLoad(url, false);
          reject(event);
        });
        if (that._responseType !== null) {
          request.responseType = that._responseType;
        }
        if (request.overrideMimeType && this._mimeType) {
          request.overrideMimeType(this._mimeType);
        }
        for (const k in that._headers) {
          request.setRequestHeader(k, that._headers[k]);
        }
        request.send(null);
      }
    });
  }
}
