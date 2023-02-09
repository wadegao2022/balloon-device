import * as chaos from 'balloon-device';
import { projectCubemapCPU } from './sh';

export abstract class TextureTestCase {
  protected device: chaos.Device;
  protected assetManager: chaos.AssetManager;
  protected program: chaos.GPUProgram;
  protected texture: chaos.BaseTexture;
  protected bindgroup: chaos.BindGroup;
  protected renderStates: chaos.RenderStateSet;
  protected box: chaos.BoxShape;
  protected animate: boolean;
  constructor(device: chaos.Device, assetManager: chaos.AssetManager) {
    this.device = device;
    this.assetManager = assetManager;
    this.program = null;
    this.texture = null;
    this.bindgroup = null;
    this.animate = true;
  }
  async init() {
    this.program = this.createProgram();
    this.texture = await this.createTexture();
    this.bindgroup = this.createBindGroup();
    this.box = new chaos.BoxShape(this.device, { size: 2, pivotX: 0.5, pivotY: 0.5, pivotZ: 0.5 })
    this.renderStates = this.device.createRenderStateSet();
    this.renderStates.useDepthState().enableTest(true);
  }
  draw(w: number, h: number) {
    this.updateBindGroup(Date.now(), w, h);
    this.device.setProgram(this.program);
    this.device.setRenderStates(this.renderStates);
    this.device.setBindGroup(0, this.bindgroup);
    this.box.draw()
  }
  protected abstract createProgram(): chaos.GPUProgram;
  protected abstract createTexture(): Promise<chaos.BaseTexture|chaos.TextureVideo>;
  protected abstract createBindGroup(): chaos.BindGroup;
  protected abstract updateBindGroup(t: number, width: number, height: number);
}

export class TestTexture2D extends TextureTestCase {
  private viewMatrix: chaos.Matrix4x4;
  constructor(device: chaos.Device, assetManager: chaos.AssetManager) {
    super(device, assetManager);
    this.viewMatrix = chaos.Matrix4x4.lookAt(new chaos.Vector3(3, 3, 3), chaos.Vector3.zero(), chaos.Vector3.axisPY()).inplaceInverseAffine();
  }
  protected createProgram(): chaos.GPUProgram {
    const pb = new chaos.ProgramBuilder(this.device);
    return pb.buildRenderProgram({
      label: '2d',
      vertex() {
        this.$inputs.pos = pb.vec3().attrib('position');
        this.$inputs.uv = pb.vec2().attrib('texCoord0');
        this.$outputs.texcoord = pb.vec2();
        this.mvpMatrix = pb.mat4().uniform(0);
        this.$mainFunc(function () {
          this.$builtins.position = pb.mul(this.mvpMatrix, pb.vec4(this.$inputs.pos, 1));
          this.$outputs.texcoord = this.$inputs.uv;
        });
      },
      fragment() {
        this.tex = pb.tex2D().uniform(0);
        this.$outputs.color = pb.vec4();
        this.$mainFunc(function () {
          this.$l.color = pb.textureSample(this.tex, this.$inputs.texcoord);
          this.$outputs.color = pb.vec4(pb.pow(this.color.rgb, pb.vec3(1 / 2.2)), this.color.a);
        });
      }
    });
  }
  protected async createTexture(): Promise<chaos.BaseTexture> {
    return await this.assetManager.fetchTexture(`./assets/images/Di-3d.png`, null, true) as chaos.Texture2D;
  }
  protected createBindGroup(): chaos.BindGroup {
    const bindGroup = this.device.createBindGroup(this.program.bindGroupLayouts[0]);
    bindGroup.setTexture('tex', this.texture);
    return bindGroup;
  }
  protected updateBindGroup(t: number, w: number, h: number) {
    const vpMatrix = chaos.Matrix4x4.multiply(chaos.Matrix4x4.perspective(Math.PI / 3, w / h, 1, 10), this.viewMatrix);
    const matrix = this.animate ? chaos.Matrix4x4.multiply(vpMatrix, chaos.Matrix4x4.rotationY((t * 0.001) % (2 * Math.PI))) : vpMatrix;
    this.bindgroup.setValue('mvpMatrix', matrix);
  }
}

export class TestTextureVideo extends TextureTestCase {
  private viewMatrix: chaos.Matrix4x4;
  private el: HTMLVideoElement;
  constructor(device: chaos.Device, assetManager: chaos.AssetManager, video: string) {
    super(device, assetManager);
    this.viewMatrix = chaos.Matrix4x4.lookAt(new chaos.Vector3(3, 3, 3), chaos.Vector3.zero(), chaos.Vector3.axisPY()).inplaceInverseAffine();
    this.el = document.createElement('video');
    this.el.src = video;
    this.el.loop = true;
    this.el.muted = true;
    this.el.play();
  }
  protected createProgram(): chaos.GPUProgram {
    const pb = new chaos.ProgramBuilder(this.device);
    return pb.buildRenderProgram({
      label: '2d',
      vertex() {
        this.$inputs.pos = pb.vec3().attrib('position');
        this.$inputs.uv = pb.vec2().attrib('texCoord0');
        this.$outputs.texcoord = pb.vec2();
        this.mvpMatrix = pb.mat4().uniform(0);
        this.$mainFunc(function () {
          this.$builtins.position = pb.mul(this.mvpMatrix, pb.vec4(this.$inputs.pos, 1));
          this.$outputs.texcoord = this.$inputs.uv;
        });
      },
      fragment() {
        this.tex = pb.texExternal().uniform(0);
        this.$outputs.color = pb.vec4();
        this.$mainFunc(function () {
          this.$outputs.color = pb.textureSample(this.tex, this.$inputs.texcoord);
          // this.$outputs.color = pb.vec4(pb.pow(this.$outputs.color.xyz, pb.vec3(1 / 2.2)), this.$outputs.color.w);
        });
      }
    });
  }
  protected async createTexture(): Promise<chaos.BaseTexture|chaos.TextureVideo> {
    return this.device.createTextureVideo(this.el);
  }
  protected createBindGroup(): chaos.BindGroup {
    const bindGroup = this.device.createBindGroup(this.program.bindGroupLayouts[0]);
    bindGroup.setTexture('tex', this.texture);
    return bindGroup;
  }
  protected updateBindGroup(t: number, w: number, h: number) {
    const vpMatrix = chaos.Matrix4x4.multiply(chaos.Matrix4x4.perspective(Math.PI / 3, w / h, 1, 10), this.viewMatrix);
    const matrix = this.animate ? chaos.Matrix4x4.multiply(vpMatrix, chaos.Matrix4x4.rotationY((t * 0.001) % (2 * Math.PI))) : vpMatrix;
    this.bindgroup.setValue('mvpMatrix', matrix);
  }
}

export class TestTexture2DArray extends TextureTestCase {
  private viewMatrix: chaos.Matrix4x4;
  constructor(device: chaos.Device, assetManager: chaos.AssetManager) {
    super(device, assetManager);
    this.viewMatrix = chaos.Matrix4x4.lookAt(new chaos.Vector3(3, 3, 3), chaos.Vector3.zero(), chaos.Vector3.axisPY()).inplaceInverseAffine();
  }
  protected createProgram(): chaos.GPUProgram {
    const pb = new chaos.ProgramBuilder(this.device);
    return pb.buildRenderProgram({
      label: '2d-array',
      vertex() {
        this.$inputs.pos = pb.vec3().attrib('position');
        this.$outputs.texcoord = pb.vec3();
        this.mvpMatrix = pb.mat4().uniform(0);
        this.$mainFunc(function () {
          this.$builtins.position = pb.mul(this.mvpMatrix, pb.vec4(this.$inputs.pos, 1));
          this.$outputs.texcoord = pb.add(pb.mul(this.$inputs.pos, 0.5), pb.vec3(0.5));
        });
      },
      fragment() {
        this.tex = pb.tex2DArray().uniform(0);
        this.$outputs.color = pb.vec4();
        this.$mainFunc(function () {
          this.$outputs.color = pb.textureArraySample(this.tex, this.$inputs.texcoord.xy, pb.int(pb.mul(this.$inputs.texcoord.z, 4)));
          this.$outputs.color = pb.vec4(pb.pow(this.$outputs.color.xyz, pb.vec3(1 / 2.2)), this.$outputs.color.w);
        });
      }
    });
  }
  protected async createTexture(): Promise<chaos.BaseTexture> {
    const red = [255, 0, 0, 255];
    const green = [0, 255, 0, 255];
    const blue = [0, 0, 255, 255];
    const yellow = [255, 255, 0, 255];
    const purple = [255, 0, 255, 255];
    const black = [0, 0, 0, 255];
    const white = [255, 255, 255, 255];
    const pixels = new Uint8Array([
      ...red, ...green, ...blue, ...yellow,
      ...purple, ...black, ...white, ...red,
      ...green, ...blue, ...yellow, ...purple,
      ...black, ...white, ...red, ...green,

      ...green, ...blue, ...yellow, ...purple,
      ...black, ...white, ...red, ...green,
      ...blue, ...yellow, ...purple, ...black,
      ...white, ...red, ...green, ...blue,

      ...blue, ...yellow, ...purple, ...black,
      ...white, ...red, ...green, ...blue,
      ...yellow, ...purple, ...black, ...white,
      ...red, ...green, ...blue, ...yellow,

      ...yellow, ...purple, ...black, ...white,
      ...red, ...green, ...blue, ...yellow,
      ...purple, ...black, ...white, ...red,
      ...green, ...blue, ...yellow, ...purple
    ]);
    const tex = this.device.createTexture2DArray(chaos.TextureFormat.RGBA8UNORM, 4, 4, 4, chaos.GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE);
    tex.update(pixels, 0, 0, 0, 4, 4, 4);
    return tex;
  }
  protected createBindGroup(): chaos.BindGroup {
    const bindGroup = this.device.createBindGroup(this.program.bindGroupLayouts[0]);
    bindGroup.setTexture('tex', this.texture);
    return bindGroup;
  }
  protected updateBindGroup(t: number, w: number, h: number) {
    const vpMatrix = chaos.Matrix4x4.multiply(chaos.Matrix4x4.perspective(Math.PI / 3, w / h, 1, 10), this.viewMatrix);
    const matrix = this.animate ? chaos.Matrix4x4.multiply(vpMatrix, chaos.Matrix4x4.rotationY((t * 0.001) % (2 * Math.PI))) : vpMatrix;
    this.bindgroup.setValue('mvpMatrix', matrix);
  }
}


export class TestTexture3D extends TextureTestCase {
  private viewMatrix: chaos.Matrix4x4;
  constructor(device: chaos.Device, assetManager: chaos.AssetManager) {
    super(device, assetManager);
    this.viewMatrix = chaos.Matrix4x4.lookAt(new chaos.Vector3(3, 3, 3), chaos.Vector3.zero(), chaos.Vector3.axisPY()).inplaceInverseAffine();
  }
  protected createProgram(): chaos.GPUProgram {
    const pb = new chaos.ProgramBuilder(this.device);
    return pb.buildRenderProgram({
      label: '3d',
      vertex() {
        this.$inputs.pos = pb.vec3().attrib('position');
        this.$outputs.texcoord = pb.vec3();
        this.mvpMatrix = pb.mat4().uniform(0);
        this.$mainFunc(function () {
          this.$builtins.position = pb.mul(this.mvpMatrix, pb.vec4(this.$inputs.pos, 1));
          this.$outputs.texcoord = pb.add(pb.mul(this.$inputs.pos, 0.5), pb.vec3(0.5));
        });
      },
      fragment() {
        this.tex = pb.tex3D().uniform(0);
        this.$outputs.color = pb.vec4();
        this.$mainFunc(function () {
          this.$outputs.color = pb.textureSample(this.tex, this.$inputs.texcoord);
          this.$outputs.color = pb.vec4(pb.pow(this.$outputs.color.xyz, pb.vec3(1 / 2.2)), this.$outputs.color.w);
        });
      }
    });
  }
  protected async createTexture(): Promise<chaos.BaseTexture> {
    const red = [255, 0, 0, 255];
    const green = [0, 255, 0, 255];
    const blue = [0, 0, 255, 255];
    const yellow = [255, 255, 0, 255];
    const purple = [255, 0, 255, 255];
    const black = [0, 0, 0, 255];
    const white = [255, 255, 255, 255];
    const pixels = new Uint8Array([
      ...red, ...green, ...blue, ...yellow,
      ...purple, ...black, ...white, ...red,
      ...green, ...blue, ...yellow, ...purple,
      ...black, ...white, ...red, ...green,

      ...green, ...blue, ...yellow, ...purple,
      ...black, ...white, ...red, ...green,
      ...blue, ...yellow, ...purple, ...black,
      ...white, ...red, ...green, ...blue,

      ...blue, ...yellow, ...purple, ...black,
      ...white, ...red, ...green, ...blue,
      ...yellow, ...purple, ...black, ...white,
      ...red, ...green, ...blue, ...yellow,

      ...yellow, ...purple, ...black, ...white,
      ...red, ...green, ...blue, ...yellow,
      ...purple, ...black, ...white, ...red,
      ...green, ...blue, ...yellow, ...purple
    ]);
    const tex = this.device.createTexture3D(chaos.TextureFormat.RGBA8UNORM, 4, 4, 4, chaos.GPUResourceUsageFlags.TF_NO_MIPMAP | chaos.GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE);
    tex.update(pixels, 0, 0, 0, 4, 4, 4);
    return tex;
  }
  protected createBindGroup(): chaos.BindGroup {
    const bindGroup = this.device.createBindGroup(this.program.bindGroupLayouts[0]);
    bindGroup.setTexture('tex', this.texture);
    return bindGroup;
  }
  protected updateBindGroup(t: number, w: number, h: number) {
    const vpMatrix = chaos.Matrix4x4.multiply(chaos.Matrix4x4.perspective(Math.PI / 3, w / h, 1, 10), this.viewMatrix);
    const matrix = this.animate ? chaos.Matrix4x4.multiply(vpMatrix, chaos.Matrix4x4.rotationY((t * 0.001) % (2 * Math.PI))) : vpMatrix;
    this.bindgroup.setValue('mvpMatrix', matrix);
  }
}

export class TestTextureCube extends TextureTestCase {
  private viewMatrix: chaos.Matrix4x4;
  constructor(device: chaos.Device, assetManager: chaos.AssetManager) {
    super(device, assetManager);
    this.viewMatrix = chaos.Matrix4x4.lookAt(new chaos.Vector3(3, 3, 3), chaos.Vector3.zero(), chaos.Vector3.axisPY()).inplaceInverseAffine();
  }
  protected createProgram(): chaos.GPUProgram {
    const pb = new chaos.ProgramBuilder(this.device);
    return pb.buildRenderProgram({
      label: 'cube',
      vertex() {
        this.$inputs.pos = pb.vec3().attrib('position');
        this.$outputs.texcoord = pb.vec3();
        this.mvpMatrix = pb.mat4().uniform(0);
        this.$mainFunc(function () {
          this.$builtins.position = pb.mul(this.mvpMatrix, pb.vec4(this.$inputs.pos, 1));
          this.$outputs.texcoord = this.$inputs.pos;
        });
      },
      fragment() {
        this.tex = pb.texCube().uniform(0);
        this.$outputs.color = pb.vec4();
        this.$mainFunc(function () {
          this.$outputs.color = pb.textureSample(this.tex, pb.normalize(this.$inputs.texcoord));
          this.$outputs.color = pb.vec4(pb.pow(this.$outputs.color.xyz, pb.vec3(1 / 2.2)), this.$outputs.color.w);
        });
      }
    });
  }
  protected async createTexture(): Promise<chaos.BaseTexture> {
    return await this.assetManager.fetchTexture('./assets/images/sky2.dds', null, true) as chaos.TextureCube;
  }
  protected createBindGroup(): chaos.BindGroup {
    const bindGroup = this.device.createBindGroup(this.program.bindGroupLayouts[0]);
    bindGroup.setTexture('tex', this.texture);
    return bindGroup;
  }
  protected updateBindGroup(t: number, w: number, h: number) {
    const vpMatrix = chaos.Matrix4x4.multiply(chaos.Matrix4x4.perspective(Math.PI / 3, w / h, 1, 10), this.viewMatrix);
    const matrix = this.animate ? chaos.Matrix4x4.multiply(vpMatrix, chaos.Matrix4x4.rotationY((t * 0.001) % (2 * Math.PI))) : vpMatrix;
    this.bindgroup.setValue('mvpMatrix', matrix);
  }
}

export class TestTextureCubeSH extends TextureTestCase {
  private viewMatrix: chaos.Matrix4x4;
  private shCoeff: chaos.Vector3[];
  constructor(device: chaos.Device, assetManager: chaos.AssetManager) {
    super(device, assetManager);
    this.viewMatrix = chaos.Matrix4x4.lookAt(new chaos.Vector3(3, 3, 3), chaos.Vector3.zero(), chaos.Vector3.axisPY()).inplaceInverseAffine();
    this.shCoeff = Array.from({ length: 9 }).map(() => chaos.Vector3.zero());
  }
  protected createProgram(): chaos.GPUProgram {
    const pb = new chaos.ProgramBuilder(this.device);
    return pb.buildRenderProgram({
      label: 'cube',
      vertex() {
        this.$inputs.pos = pb.vec3().attrib('position');
        this.$outputs.texcoord = pb.vec3();
        this.mvpMatrix = pb.mat4().uniform(0);
        this.$mainFunc(function () {
          this.$builtins.position = pb.mul(this.mvpMatrix, pb.vec4(this.$inputs.pos, 1));
          this.$outputs.texcoord = this.$inputs.pos;
        });
      },
      fragment() {
        const structSH = pb.defineStruct('SH', 'std140', pb.vec3('c0'), pb.vec3('c1'), pb.vec3('c2'), pb.vec3('c3'), pb.vec3('c4'), pb.vec3('c5'), pb.vec3('c6'), pb.vec3('c7'), pb.vec3('c8'));
        this.sh = structSH().uniform(0);
        this.$outputs.color = pb.vec4();
        this.$function('Y0', [pb.vec3('v')], function () {
          this.$return(0.2820947917);
        });
        this.$function('Y1', [pb.vec3('v')], function () {
          this.$return(pb.mul(this.v.y, 0.4886025119));
        });
        this.$function('Y2', [pb.vec3('v')], function () {
          this.$return(pb.mul(this.v.z, 0.4886025119));
        });
        this.$function('Y3', [pb.vec3('v')], function () {
          this.$return(pb.mul(this.v.x, 0.4886025119));
        });
        this.$function('Y4', [pb.vec3('v')], function () {
          this.$return(pb.mul(pb.mul(this.v.x, this.v.y), 1.0925484306));
        });
        this.$function('Y5', [pb.vec3('v')], function () {
          this.$return(pb.mul(pb.mul(this.v.y, this.v.z), 1.0925484306));
        });
        this.$function('Y6', [pb.vec3('v')], function () {
          this.$return(pb.mul(pb.sub(pb.mul(pb.mul(this.v.z, this.v.z), 3), 1), 0.3153915652));
        });
        this.$function('Y7', [pb.vec3('v')], function () {
          this.$return(pb.mul(pb.mul(this.v.x, this.v.z), 1.0925484306));
        });
        this.$function('Y8', [pb.vec3('v')], function () {
          this.$return(pb.mul(pb.sub(pb.mul(this.v.x, this.v.x), pb.mul(this.v.y, this.v.y)), 0.5462742153));
        });
        this.$mainFunc(function () {
          this.v = pb.normalize(this.$inputs.texcoord);
          this.c = pb.mul(this.sh.c0, this.Y0(this.v));
          this.c = pb.add(this.c, pb.mul(this.sh.c1, this.Y1(this.v)));
          this.c = pb.add(this.c, pb.mul(this.sh.c2, this.Y2(this.v)));
          this.c = pb.add(this.c, pb.mul(this.sh.c3, this.Y3(this.v)));
          this.c = pb.add(this.c, pb.mul(this.sh.c4, this.Y4(this.v)));
          this.c = pb.add(this.c, pb.mul(this.sh.c5, this.Y5(this.v)));
          this.c = pb.add(this.c, pb.mul(this.sh.c6, this.Y6(this.v)));
          this.c = pb.add(this.c, pb.mul(this.sh.c7, this.Y7(this.v)));
          this.c = pb.add(this.c, pb.mul(this.sh.c8, this.Y8(this.v)));
          this.$outputs.color = pb.vec4(this.c, 1);
          this.$outputs.color = pb.vec4(pb.pow(this.$outputs.color.xyz, pb.vec3(1 / 2.2)), this.$outputs.color.w);
        });
      }
    });
  }
  protected async createTexture(): Promise<chaos.BaseTexture> {
    const tex = await this.assetManager.fetchTexture('./assets/images/sky2.dds') as chaos.TextureCube;
    this.shCoeff = await projectCubemapCPU(tex);
    console.log(this.shCoeff);
    return tex;
  }
  protected createBindGroup(): chaos.BindGroup {
    const bindGroup = this.device.createBindGroup(this.program.bindGroupLayouts[0]);
    bindGroup.setValue('sh', {
      c0: this.shCoeff[0],
      c1: this.shCoeff[1],
      c2: this.shCoeff[2],
      c3: this.shCoeff[3],
      c4: this.shCoeff[4],
      c5: this.shCoeff[5],
      c6: this.shCoeff[6],
      c7: this.shCoeff[7],
      c8: this.shCoeff[8],
    });
    return bindGroup;
  }
  protected updateBindGroup(t: number, w: number, h: number) {
    const vpMatrix = chaos.Matrix4x4.multiply(chaos.Matrix4x4.perspective(Math.PI / 3, w / h, 1, 10), this.viewMatrix);
    const matrix = this.animate ? chaos.Matrix4x4.multiply(vpMatrix, chaos.Matrix4x4.rotationY((t * 0.001) % (2 * Math.PI))) : vpMatrix;
    this.bindgroup.setValue('mvpMatrix', matrix);
  }
}
