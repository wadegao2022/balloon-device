import { WebGLContext, CompareFunc } from '../base_types';
import { WebGLEnum } from './webgl_enum';
import { ColorState, BlendEquation, BlendFunc, BlendingState, FaceMode, FaceWinding, RasterizerState, DepthState, StencilOp, StencilState, RenderStateSet } from '../render_states';
import { blendEquationMap, blendEquationInvMap, blendFuncMap, blendFuncInvMap, faceModeMap, faceModeInvMap, stencilOpMap, stencilOpInvMap, compareFuncMap, compareFuncInvMap } from './constants_webgl';

export abstract class WebGLRenderState {
  protected static _defaultState: WebGLRenderState;
  protected static _currentState: WebGLRenderState;
  apply(gl: WebGLContext, force?: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = this.constructor;
    if (force || c._currentState !== this) {
      this._apply(gl);
    }
    c._currentState = this;
  }
  static get defaultState() {
    return WebGLRenderState._defaultState;
  }
  static applyDefaults(gl: WebGLContext, force?: boolean) {
    if (force || this._currentState !== this._defaultState) {
      this._defaultState.apply(gl, force);
    }
  }
  protected abstract _apply(gl: WebGLContext): void;
}

export class WebGLColorState extends WebGLRenderState implements ColorState {
  protected static _defaultState: WebGLColorState = new WebGLColorState();
  protected static _currentState: WebGLColorState = null;
  redMask: boolean;
  greenMask: boolean;
  blueMask: boolean;
  alphaMask: boolean;
  constructor() {
    super();
    this.redMask = this.greenMask = this.blueMask = this.alphaMask = true;
  }
  setColorMask(r: boolean, g: boolean, b: boolean, a: boolean): this {
    this.redMask = r;
    this.greenMask = g;
    this.blueMask = b;
    this.alphaMask = a;
    return this;
  }
  protected _apply(gl: WebGLContext) {
    gl.colorMask(this.redMask, this.greenMask, this.blueMask, this.alphaMask);
  }
}

export class WebGLBlendingState extends WebGLRenderState implements BlendingState {
  protected static _defaultState: WebGLBlendingState = new WebGLBlendingState();
  protected static _currentState: WebGLBlendingState = null;
  private _srcBlendRGB: number;
  private _dstBlendRGB: number;
  private _srcBlendAlpha: number;
  private _dstBlendAlpha: number;
  private _rgbEquation: number;
  private _alphaEquation: number;
  enabled: boolean;
  constructor() {
    super();
    this.enabled = false;
    this.srcBlendRGB = BlendFunc.ONE;
    this.dstBlendRGB = BlendFunc.ZERO;
    this.srcBlendAlpha = BlendFunc.ONE;
    this.dstBlendAlpha = BlendFunc.ZERO;
    this.rgbEquation = BlendEquation.ADD;
    this.alphaEquation = BlendEquation.ADD;
  }
  get srcBlendRGB(): BlendFunc {
    return blendFuncInvMap[this._srcBlendRGB];
  }
  set srcBlendRGB(val: BlendFunc) {
    this._srcBlendRGB = blendFuncMap[val];
  }
  get dstBlendRGB(): BlendFunc {
    return blendFuncInvMap[this._dstBlendRGB];
  }
  set dstBlendRGB(val: BlendFunc) {
    this._dstBlendRGB = blendFuncMap[val];
  }
  get srcBlendAlpha(): BlendFunc {
    return blendFuncInvMap[this._srcBlendAlpha];
  }
  set srcBlendAlpha(val: BlendFunc) {
    this._srcBlendAlpha = blendFuncMap[val];
  }
  get dstBlendAlpha(): BlendFunc {
    return blendFuncInvMap[this._dstBlendAlpha];
  }
  set dstBlendAlpha(val: BlendFunc) {
    this._dstBlendAlpha = blendFuncMap[val];
  }
  get rgbEquation(): BlendEquation {
    return blendEquationInvMap[this._rgbEquation];
  }
  set rgbEquation(val: BlendEquation) {
    this._rgbEquation = blendEquationMap[val];
  }
  get alphaEquation(): BlendEquation {
    return blendEquationInvMap[this._alphaEquation];
  }
  set alphaEquation(val: BlendEquation) {
    this._alphaEquation = blendEquationMap[val];
  }
  enable(b: boolean): this {
    this.enabled = b;
    return this;
  }
  setBlendFunc(src: BlendFunc, dest: BlendFunc): this {
    this.srcBlendRGB = src;
    this.dstBlendRGB = dest;
    this.srcBlendAlpha = src;
    this.dstBlendAlpha = dest;
    return this;
  }
  setBlendFuncRGB(src: BlendFunc, dest: BlendFunc): this {
    this.srcBlendRGB = src;
    this.dstBlendRGB = dest;
    return this;
  }
  setBlendFuncAlpha(src: BlendFunc, dest: BlendFunc): this {
    this.srcBlendAlpha = src;
    this.dstBlendAlpha = dest;
    return this;
  }
  setBlendEquation(rgb: BlendEquation, alpha: BlendEquation): this {
    this.rgbEquation = rgb;
    this.alphaEquation = alpha;
    return this;
  }
  protected _apply(gl: WebGLContext) {
    if (this.enabled) {
      gl.enable(WebGLEnum.BLEND);
      gl.blendEquationSeparate(this._rgbEquation, this._alphaEquation);
      if (this._srcBlendRGB === this._srcBlendAlpha && this._dstBlendRGB === this._dstBlendAlpha) {
        gl.blendFunc(this._srcBlendRGB, this._dstBlendRGB);
      } else {
        gl.blendFuncSeparate(
          this._srcBlendRGB,
          this._dstBlendRGB,
          this._srcBlendAlpha,
          this._dstBlendAlpha,
        );
      }
    } else {
      gl.disable(WebGLEnum.BLEND);
    }
  }
}

export class WebGLRasterizerState extends WebGLRenderState implements RasterizerState {
  protected static _defaultState: WebGLRasterizerState = new WebGLRasterizerState();
  protected static _currentState: WebGLRasterizerState = null;
  private _cullMode: number;
  constructor() {
    super();
    this.cullMode = FaceMode.BACK;
  }
  get cullMode(): FaceMode {
    return faceModeInvMap[this._cullMode];
  }
  set cullMode(val: FaceMode) {
    this._cullMode = faceModeMap[val];
  }
  setCullMode(mode: FaceMode): this {
    this.cullMode = mode;
    return this;
  }
  protected _apply(gl: WebGLContext) {
    if (this.cullMode == FaceMode.NONE) {
      gl.disable(WebGLEnum.CULL_FACE);
    } else {
      gl.enable(WebGLEnum.CULL_FACE);
      gl.cullFace(this._cullMode);
    }
  }
}

export class WebGLDepthState extends WebGLRenderState implements DepthState {
  protected static _defaultState: WebGLDepthState = new WebGLDepthState();
  protected static _currentState: WebGLDepthState = null;
  testEnabled: boolean;
  writeEnabled: boolean;
  private _compareFunc: number;
  constructor() {
    super();
    this.testEnabled = true;
    this.writeEnabled = true;
    this.compareFunc = CompareFunc.LessEqual;
  }
  get compareFunc(): CompareFunc {
    return compareFuncInvMap[this._compareFunc];
  }
  set compareFunc(val: CompareFunc) {
    this._compareFunc = compareFuncMap[val];
  }
  enableTest(b: boolean): this {
    this.testEnabled = b;
    return this;
  }
  enableWrite(b: boolean): this {
    this.writeEnabled = b;
    return this;
  }
  setCompareFunc(func: CompareFunc): this {
    this.compareFunc = func;
    return this;
  }
  protected _apply(gl: WebGLContext) {
    if (this.testEnabled) {
      gl.enable(WebGLEnum.DEPTH_TEST);
      gl.depthFunc(this._compareFunc);
    } else {
      gl.disable(WebGLEnum.DEPTH_TEST);
    }
    gl.depthMask(this.writeEnabled);
  }
}

export class WebGLStencilState extends WebGLRenderState implements StencilState {
  protected static _defaultState: WebGLStencilState = new WebGLStencilState();
  protected static _currentState: WebGLStencilState = null;
  enabled: boolean;
  enableTwoSided: boolean;
  writeMask: number;
  writeMaskBack: number;
  ref: number;
  valueMask: number;
  valueMaskBack: number;
  private _failOp: number;
  private _failOpBack: number;
  private _zFailOp: number;
  private _zFailOpBack: number;
  private _passOp: number;
  private _passOpBack: number;
  private _func: number;
  private _funcBack: number;
  constructor() {
    super();
    this.enabled = false;
    this.enableTwoSided = false;
    this.writeMask = this.writeMaskBack = 0xffffffff;
    this.failOp = this.failOpBack = StencilOp.KEEP;
    this.zFailOp = this.zFailOpBack = StencilOp.KEEP;
    this.passOp = this.passOpBack = StencilOp.KEEP;
    this.func = this.funcBack = CompareFunc.Always;
    this.ref = 0;
    this.valueMask = this.valueMaskBack = 0xffffffff;
  }
  get failOp(): StencilOp {
    return stencilOpInvMap[this._failOp];
  }
  set failOp(val: StencilOp) {
    this._failOp = stencilOpMap[val];
  }
  get failOpBack(): StencilOp {
    return stencilOpInvMap[this._failOpBack];
  }
  set failOpBack(val: StencilOp) {
    this._failOpBack = stencilOpMap[val];
  }
  get zFailOp(): StencilOp {
    return stencilOpInvMap[this._zFailOp];
  }
  set zFailOp(val: StencilOp) {
    this._zFailOp = stencilOpMap[val];
  }
  get zFailOpBack(): StencilOp {
    return stencilOpInvMap[this._zFailOpBack];
  }
  set zFailOpBack(val: StencilOp) {
    this._zFailOpBack = stencilOpMap[val];
  }
  get passOp(): StencilOp {
    return stencilOpInvMap[this._passOp];
  }
  set passOp(val: StencilOp) {
    this._passOp = stencilOpMap[val];
  }
  get passOpBack(): StencilOp {
    return stencilOpInvMap[this._passOpBack];
  }
  set passOpBack(val: StencilOp) {
    this._passOpBack = stencilOpMap[val];
  }
  get func(): CompareFunc {
    return compareFuncInvMap[this._func];
  }
  set func(val: CompareFunc) {
    this._func = compareFuncMap[val];
  }
  get funcBack(): CompareFunc {
    return compareFuncInvMap[this._funcBack];
  }
  set funcBack(val: CompareFunc) {
    this._funcBack = compareFuncMap[val];
  }
  enable(b: boolean): this {
    this.enabled = b;
    return this;
  }
  enableStencilTwoside(b: boolean): this {
    this.enableTwoSided = b;
    return this;
  }
  setFrontWriteMask(mask: number): this {
    this.writeMask = mask;
    return this;
  }
  setBackWriteMask(mask: number): this {
    this.writeMaskBack = mask;
    return this;
  }
  setFrontOp(fail: StencilOp, zfail: StencilOp, zpass: StencilOp): this {
    this.failOp = fail;
    this.zFailOp = zfail;
    this.passOp = zpass;
    return this;
  }
  setBackOp(fail: StencilOp, zfail: StencilOp, zpass: StencilOp): this {
    this.failOpBack = fail;
    this.zFailOpBack = zfail;
    this.passOpBack = zpass;
    return this;
  }
  setFrontCompareFunc(func: CompareFunc): this {
    this.func = func;
    return this;
  }
  setBackCompareFunc(func: CompareFunc): this {
    this.funcBack = func;
    return this;
  }
  setReference(ref: number): this {
    this.ref = ref;
    return this;
  }
  setFrontValueMask(mask: number): this {
    this.valueMask = mask;
    return this;
  }
  setBackValueMask(mask: number): this {
    this.valueMaskBack = mask;
    return this;
  }
  protected _apply(gl: WebGLContext) {
    if (this.enabled) {
      gl.enable(WebGLEnum.STENCIL_TEST);
      if (this.enableTwoSided) {
        gl.stencilMaskSeparate(WebGLEnum.FRONT, this.writeMask);
        gl.stencilMaskSeparate(WebGLEnum.BACK, this.writeMaskBack);
        gl.stencilFuncSeparate(WebGLEnum.FRONT, this._func, this.ref, this.valueMask);
        gl.stencilFuncSeparate(WebGLEnum.BACK, this._funcBack, this.ref, this.valueMaskBack);
        gl.stencilOpSeparate(WebGLEnum.FRONT, this._failOp, this._zFailOp, this._passOp);
        gl.stencilOpSeparate(WebGLEnum.BACK, this._failOpBack, this._zFailOpBack, this._passOpBack);
      } else {
        gl.stencilMask(this.writeMask);
        gl.stencilFunc(this._func, this.ref, this.valueMask);
        gl.stencilOp(this._failOp, this._zFailOp, this._passOp);
      }
    } else {
      gl.disable(WebGLEnum.STENCIL_TEST);
    }
  }
}

export class WebGLRenderStateSet implements RenderStateSet {
  private _gl: WebGLContext;
  private _colorState: WebGLColorState;
  private _blendingState: WebGLBlendingState;
  private _rasterizerState: WebGLRasterizerState;
  private _depthState: WebGLDepthState;
  private _stencilState: WebGLStencilState;
  constructor(gl: WebGLContext) {
    this._gl = gl;
    this.defaultColorState();
    this.defaultBlendingState();
    this.defaultRasterizerState();
    this.defaultDepthState();
    this.defaultStencilState();
  }
  get colorState() {
    return this._colorState;
  }
  get blendingState() {
    return this._blendingState;
  }
  get rasterizerState() {
    return this._rasterizerState;
  }
  get depthState() {
    return this._depthState;
  }
  get stencilState() {
    return this._stencilState;
  }
  apply(overridden: WebGLRenderStateSet, force?: boolean) {
    const gl = this._gl;
    if (overridden?._colorState) {
      overridden._colorState.apply(gl, force);
    } else if (this._colorState) {
      this._colorState.apply(gl, force);
    } else {
      WebGLColorState.applyDefaults(gl, force);
    }
    if (overridden?._blendingState) {
      overridden._blendingState.apply(gl, force);
    } else if (this._blendingState) {
      this._blendingState.apply(gl, force);
    } else {
      WebGLBlendingState.applyDefaults(gl, force);
    }
    if (overridden?._rasterizerState) {
      overridden._rasterizerState.apply(gl, force);
    } else if (this._rasterizerState) {
      this._rasterizerState.apply(gl, force);
    } else {
      WebGLRasterizerState.applyDefaults(gl, force);
    }
    if (overridden?._depthState) {
      overridden._depthState.apply(gl, force);
    } else if (this._depthState) {
      this._depthState.apply(gl, force);
    } else {
      WebGLDepthState.applyDefaults(gl, force);
    }
    if (overridden?._stencilState) {
      overridden._stencilState.apply(gl, force);
    } else if (this._stencilState) {
      this._stencilState.apply(gl, force);
    } else {
      WebGLStencilState.applyDefaults(gl, force);
    }
  }
  useColorState(): ColorState {
    if (!this._colorState) {
      this._colorState = new WebGLColorState();
    }
    return this._colorState;
  }
  defaultColorState() {
    this._colorState = null;
  }
  useBlendingState(): BlendingState {
    if (!this._blendingState) {
      this._blendingState = new WebGLBlendingState();
    }
    return this._blendingState;
  }
  defaultBlendingState() {
    this._blendingState = null;
  }
  useRasterizerState(): RasterizerState {
    if (!this._rasterizerState) {
      this._rasterizerState = new WebGLRasterizerState();
    }
    return this._rasterizerState;
  }
  defaultRasterizerState() {
    this._rasterizerState = null;
  }
  useDepthState(): DepthState {
    if (!this._depthState) {
      this._depthState = new WebGLDepthState();
    }
    return this._depthState;
  }
  defaultDepthState() {
    this._depthState = null;
  }
  useStencilState(): StencilState {
    if (!this._stencilState) {
      this._stencilState = new WebGLStencilState();
    }
    return this._stencilState;
  }
  defaultStencilState() {
    this._stencilState = null;
  }
  static applyDefaults(gl: WebGLContext, force?: boolean) {
    WebGLColorState.applyDefaults(gl, force);
    WebGLBlendingState.applyDefaults(gl, force);
    WebGLRasterizerState.applyDefaults(gl, force);
    WebGLDepthState.applyDefaults(gl, force);
    WebGLStencilState.applyDefaults(gl, force);
  }
}
