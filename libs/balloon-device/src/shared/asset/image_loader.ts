import {LoadManager} from './load_manager';
import {AbstractLoader} from './loader';

export class ImageLoader extends AbstractLoader<HTMLImageElement> {
  constructor(manager?: LoadManager, object?: HTMLImageElement) {
    super(manager, object);
  }
  async load(url: string) {
    this._manager && this._manager.beginLoad(url);
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const onImageLoaded = function (this: ImageLoader) {
        this._manager && this._manager.endLoad(url, true);
        this._object.removeEventListener('load', onImageLoaded);
        this._object.removeEventListener('error', onImageLoadError);
        resolve(this._object);
      };
      const onImageLoadError = function (this: ImageLoader, ev: Event) {
        this._manager && this._manager.endLoad(url, false);
        this._object.removeEventListener('load', onImageLoaded);
        this._object.removeEventListener('error', onImageLoadError);
        reject(ev);
      };
      if (!this._object) {
        this._object = new Image();
      }
      this._object.src = url;
      this._object.addEventListener('load', onImageLoaded.bind(this));
      this._object.addEventListener('error', onImageLoadError.bind(this));
    });
  }
}
