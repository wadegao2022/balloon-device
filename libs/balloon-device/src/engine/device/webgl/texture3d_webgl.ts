import { TextureTarget, TextureFormat, linearTextureFormatToSRGB } from '../base_types';
import { textureTargetMap } from './constants_webgl';
import { WebGLBaseTexture } from './basetexture_webgl';
import { GPUResourceUsageFlags, TextureImageElement, Texture3D, GPUDataBuffer } from '../gpuobject';
import type { TypedArray } from '../../defs';
import type { WebGLDevice } from './device_webgl';
import type { WebGLTextureCap } from './capabilities_webgl';

export class WebGLTexture3D extends WebGLBaseTexture implements Texture3D<WebGLTexture> {
  constructor(device: WebGLDevice) {
    if (!device.isWebGL2) {
      throw new Error('device does not support 3D texture');
    }
    super(device, TextureTarget.Texture3D);
  }
  get depth(): number {
    return this._depth;
  }
  isTexture3D(): this is Texture3D {
    return true;
  }
  init(): void {
    this.loadEmpty(this._format, this._width, this._height, this._depth, this._mipLevelCount);
  }
  update(
    data: TypedArray,
    xOffset: number,
    yOffset: number,
    zOffset: number,
    width: number,
    height: number,
    depth: number
  ): void {
    if (this._device.isContextLost()) {
      return;
    }
    if (!this._object) {
      this.allocInternal(this._format, this._width, this._height, this._depth, this._mipLevelCount);
    }
    const params = (this.getTextureCaps() as WebGLTextureCap).getTextureFormatInfo(this._format);
    const gl = this._device.context as WebGL2RenderingContext;
    gl.bindTexture(textureTargetMap[this._target], this._object);
    gl.pixelStorei(this._device.context.UNPACK_ALIGNMENT, 1);
    gl.texSubImage3D(
      textureTargetMap[this._target],
      0,
      xOffset,
      yOffset,
      zOffset,
      width,
      height,
      depth,
      params.glFormat,
      params.glType[0],
      data
    );
  }
  createEmpty(format: TextureFormat, width: number, height: number, depth: number, creationFlags?: number): void {
    this._flags = Number(creationFlags) || 0;
    if (this._flags & GPUResourceUsageFlags.TF_WRITABLE) {
      console.error(new Error('webgl device does not support storage texture'));
    } else {
      format = (this._flags & GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE) ? format : linearTextureFormatToSRGB(format);
      this.loadEmpty(format, width, height, depth, 0);
    }
  }
  generateMipmaps() {
    // No mipmap support for 3d texture
  }
  readPixels(layer: number, x: number, y: number, w: number, h: number, buffer: TypedArray): Promise<void> {
    return new Promise<void>(resolve => {
      const fb = this._device.createFrameBuffer({
        colorAttachments: [{ texture: this, layer }]
      });
      const savedViewport = this._device.getViewport() as [number, number, number, number];
      const savedScissor = this._device.getScissor() as [number, number, number, number];
      const savedFB = this._device.getFramebuffer();
      this._device.setFramebuffer(fb);
      this._device.readPixels(x, y, w, h, buffer).then(() => {
        fb.dispose();
        resolve();
      });
      this._device.setFramebuffer(savedFB);
      this._device.setViewport(...savedViewport);
      this._device.setScissor(...savedScissor);
    });
  }
  readPixelsToBuffer(layer: number, x: number, y: number, w: number, h: number, buffer: GPUDataBuffer): void {
    const fb = this._device.createFrameBuffer({
      colorAttachments: [{ texture: this, layer }]
    });
    const savedViewport = this._device.getViewport() as [number, number, number, number];
    const savedScissor = this._device.getScissor() as [number, number, number, number];
    const savedFB = this._device.getFramebuffer();
    this._device.setFramebuffer(fb);
    this._device.readPixelsToBuffer(x, y, w, h, buffer);
    this._device.setFramebuffer(savedFB);
    this._device.setViewport(...savedViewport);
    this._device.setScissor(...savedScissor);
    fb.dispose();
  }
  /** @internal */
  private loadEmpty(format: TextureFormat, width: number, height: number, depth: number, numMipLevels: number): void {
    this.allocInternal(format, width, height, depth, numMipLevels);
    if (this._mipLevelCount > 1 && !this._device.isContextLost()) {
      this.generateMipmaps();
    }
  }
}
