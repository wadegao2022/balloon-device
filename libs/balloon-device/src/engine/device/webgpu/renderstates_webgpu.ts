import {CompareFunc} from '../base_types';
import {ColorState, BlendEquation, BlendFunc, BlendingState, FaceMode, FaceWinding, RasterizerState, DepthState, StencilOp, StencilState, RenderStateSet} from '../render_states';
import type {WebGPUDevice} from './device';

export abstract class WebGPURenderState {
  protected static _defaultState: WebGPURenderState;
  protected _hash: string;
  static get defaultState() {
    return this._defaultState;
  }
  constructor() {
    this._hash = null;
  }
  get hash(): string {
    return this._getHash(this.constructor);
  }
  invalidateHash() {
    this._hash = null;
  }
  protected _getHash(ctor: any) {
    if (this === ctor.defaultState) {
      return '';
    } else {
      if (this._hash === null) {
        this._hash = this.computeHash();
      }
      return this._hash;
    }
  }
  protected abstract computeHash(): string;
}

export class WebGPUColorState extends WebGPURenderState implements ColorState {
  protected static _defaultState: WebGPURenderState = new WebGPUColorState();
  private _redMask: boolean;
  private _greenMask: boolean;
  private _blueMask: boolean;
  private _alphaMask: boolean;
  constructor() {
    super();
    this._redMask = this._greenMask = this._blueMask = this._alphaMask = true;
  }
  get redMask(): boolean {
    return this._redMask;
  }
  set redMask(val: boolean) {
    if (this._redMask !== !!val) {
      this._redMask = !!val;
      this.invalidateHash();
    }
  }
  get greenMask(): boolean {
    return this._greenMask;
  }
  set greenMask(val: boolean) {
    if (this._greenMask !== !!val) {
      this._greenMask = !!val;
      this.invalidateHash();
    }
  }
  get blueMask(): boolean {
    return this._blueMask;
  }
  set blueMask(val: boolean) {
    if (this._blueMask !== !!val) {
      this._blueMask = !!val;
      this.invalidateHash();
    }
  }
  get alphaMask(): boolean {
    return this._alphaMask;
  }
  set alphaMask(val: boolean) {
    if (this._alphaMask !== !!val) {
      this._alphaMask = !!val;
      this.invalidateHash();
    }
  }
  setColorMask(r: boolean, g: boolean, b: boolean, a: boolean): this {
    this.redMask = r;
    this.greenMask = g;
    this.blueMask = b;
    this.alphaMask = a;
    return this;
  }
  protected computeHash(): string {
    let val = 0;
    if (this.redMask) {
      val += (1 << 0);
    }
    if (this.greenMask) {
      val += (1 << 1);
    }
    if (this.blueMask) {
      val += (1 << 2);
    }
    if (this.alphaMask) {
      val += (1 << 3);
    }
    return String(val);
  }
}

export class WebGPUBlendingState extends WebGPURenderState implements BlendingState {
  protected static _defaultState: WebGPURenderState = new WebGPUBlendingState();
  private _enabled: boolean;
  private _srcBlendRGB: BlendFunc;
  private _dstBlendRGB: BlendFunc;
  private _srcBlendAlpha: BlendFunc;
  private _dstBlendAlpha: BlendFunc;
  private _rgbEquation: BlendEquation;
  private _alphaEquation: BlendEquation;
  constructor() {
    super();
    this._enabled = false;
    this._srcBlendRGB = BlendFunc.ONE;
    this._dstBlendRGB = BlendFunc.ZERO;
    this._srcBlendAlpha = BlendFunc.ONE;
    this._dstBlendAlpha = BlendFunc.ZERO;
    this._rgbEquation = BlendEquation.ADD;
    this._alphaEquation = BlendEquation.ADD;
  }
  get enabled(): boolean {
    return this._enabled;
  }
  set enabled(val: boolean) {
    if (this._enabled !== !!val) {
      this._enabled = !!val;
      this.invalidateHash();
    }
  }
  get srcBlendRGB(): BlendFunc {
    return this._srcBlendRGB;
  }
  set srcBlendRGB(val: BlendFunc) {
    if (this._srcBlendRGB !== val) {
      this._srcBlendRGB = val;
      this.invalidateHash();
    }
  }
  get srcBlendAlpha(): BlendFunc {
    return this._srcBlendAlpha;
  }
  set srcBlendAlpha(val: BlendFunc) {
    if (this._srcBlendAlpha !== val) {
      this._srcBlendAlpha = val;
      this.invalidateHash();
    }
  }
  get dstBlendRGB(): BlendFunc {
    return this._dstBlendRGB;
  }
  set dstBlendRGB(val: BlendFunc) {
    if (this._dstBlendRGB !== val) {
      this._dstBlendRGB = val;
      this.invalidateHash();
    }
  }
  get dstBlendAlpha(): BlendFunc {
    return this._dstBlendAlpha;
  }
  set dstBlendAlpha(val: BlendFunc) {
    if (this._dstBlendAlpha !== val) {
      this._dstBlendAlpha = val;
      this.invalidateHash();
    }
  }
  get rgbEquation(): BlendEquation {
    return this._rgbEquation;
  }
  set rgbEquation(val: BlendEquation) {
    if (this._rgbEquation !== val) {
      this._rgbEquation = val;
      this.invalidateHash();
    }
  }
  get alphaEquation(): BlendEquation {
    return this._alphaEquation;
  }
  set alphaEquation(val: BlendEquation) {
    if (this._alphaEquation !== val) {
      this._alphaEquation = val;
      this.invalidateHash();
    }
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
  protected computeHash(): string {
    return this._enabled
      ? `${this._srcBlendRGB}-${this._srcBlendAlpha}-${this._dstBlendRGB}-${this._dstBlendAlpha}-${this._rgbEquation}-${this._alphaEquation}`
      : '';
  }
}

export class WebGPURasterizerState extends WebGPURenderState implements RasterizerState {
  protected static _defaultState: WebGPURenderState = new WebGPURasterizerState();
  private _cullMode: FaceMode;
  constructor() {
    super();
    this._cullMode = FaceMode.BACK;
  }
  get cullMode(): FaceMode {
    return this._cullMode;
  }
  set cullMode(val: FaceMode) {
    if (this._cullMode !== val) {
      this._cullMode = val;
      this.invalidateHash();
    }
  }
  setCullMode(mode: FaceMode): this {
    this.cullMode = mode;
    return this;
  }
  protected computeHash(): string {
    return `${this._cullMode}`;
  }
}

export class WebGPUDepthState extends WebGPURenderState implements DepthState {
  protected static _defaultState: WebGPURenderState = new WebGPUDepthState();
  private _testEnabled: boolean;
  private _writeEnabled: boolean;
  private _compareFunc: CompareFunc;
  constructor() {
    super();
    this._testEnabled = true;
    this._writeEnabled = true;
    this._compareFunc = CompareFunc.LessEqual;
  }
  get testEnabled(): boolean {
    return this._testEnabled;
  }
  set testEnabled(val: boolean) {
    if (this._testEnabled !== !!val) {
      this._testEnabled = val;
      this.invalidateHash();
    }
  }
  get writeEnabled(): boolean {
    return this._writeEnabled;
  }
  set writeEnabled(val: boolean) {
    if (this._writeEnabled !== !!val) {
      this._writeEnabled = val;
      this.invalidateHash();
    }
  }
  get compareFunc(): CompareFunc {
    return this._compareFunc;
  }
  set compareFunc(val: CompareFunc) {
    if (this._compareFunc !== val) {
      this._compareFunc = val;
      this.invalidateHash();
    }
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
  protected computeHash(): string {
    return `${Number(this._testEnabled)}-${Number(this._writeEnabled)}-${this.compareFunc}}`;
  }
}

export class WebGPUStencilState extends WebGPURenderState implements StencilState {
  protected static _defaultState: WebGPURenderState = new WebGPUStencilState();
  private _enabled: boolean;
  private _enableTwoSided: boolean;
  private _writeMask: number;
  private _writeMaskBack: number;
  private _failOp: StencilOp;
  private _failOpBack: StencilOp;
  private _zFailOp: StencilOp;
  private _zFailOpBack: StencilOp;
  private _passOp: StencilOp;
  private _passOpBack: StencilOp;
  private _func: CompareFunc;
  private _funcBack: CompareFunc;
  private _ref: number;
  private _valueMask: number;
  private _valueMaskBack: number;
  constructor() {
    super();
    this._enabled = false;
    this._enableTwoSided = false;
    this._writeMask = this.writeMaskBack = 0xffffffff;
    this._failOp = this.failOpBack = StencilOp.KEEP;
    this._zFailOp = this.zFailOpBack = StencilOp.KEEP;
    this._passOp = this.passOpBack = StencilOp.KEEP;
    this._func = this.funcBack = CompareFunc.Always;
    this._ref = 0;
    this._valueMask = this.valueMaskBack = 0xffffffff;
  }
  get enabled(): boolean {
    return this._enabled;
  }
  set enabled(val: boolean) {
    if (this._enabled !== !!val) {
      this._enabled = !!val;
      this.invalidateHash();
    }
  }
  get enableTwoSided(): boolean {
    return this._enableTwoSided;
  }
  set enableTwoSided(val: boolean) {
    if (this._enableTwoSided !== !!val) {
      this._enableTwoSided = !!val;
      this.invalidateHash();
    }
  }
  get writeMask(): number {
    return this._writeMask;
  }
  set writeMask(val: number) {
    if (this._writeMask !== val) {
      this._writeMask = val;
      this.invalidateHash();
    }
  }
  get writeMaskBack(): number {
    return this._writeMaskBack;
  }
  set writeMaskBack(val: number) {
    if (this._writeMaskBack !== val) {
      this._writeMaskBack = val;
      this.invalidateHash();
    }
  }
  get failOp(): StencilOp {
    return this._failOp;
  }
  set failOp(val: StencilOp) {
    if (this._failOp !== val) {
      this._failOp = val;
      this.invalidateHash();
    }
  }
  get failOpBack(): StencilOp {
    return this._failOpBack;
  }
  set failOpBack(val: StencilOp) {
    if (this._failOpBack !== val) {
      this._failOpBack = val;
      this.invalidateHash();
    }
  }
  get zFailOp(): StencilOp {
    return this._zFailOp;
  }
  set zFailOp(val: StencilOp) {
    if (this._zFailOp !== val) {
      this._zFailOp = val;
      this.invalidateHash();
    }
  }
  get zFailOpBack(): StencilOp {
    return this._zFailOpBack;
  }
  set zFailOpBack(val: StencilOp) {
    if (this._zFailOpBack !== val) {
      this._zFailOpBack = val;
      this.invalidateHash();
    }
  }
  get passOp(): StencilOp {
    return this._passOp;
  }
  set passOp(val: StencilOp) {
    if (this._passOp !== val) {
      this._passOp = val;
      this.invalidateHash();
    }
  }
  get passOpBack(): StencilOp {
    return this._passOpBack;
  }
  set passOpBack(val: StencilOp) {
    if (this._passOpBack !== val) {
      this._passOpBack = val;
      this.invalidateHash();
    }
  }
  get func(): CompareFunc {
    return this._func;
  }
  set func(val: CompareFunc) {
    if (this._func !== val) {
      this._func = val;
      this.invalidateHash();
    }
  }
  get funcBack(): CompareFunc {
    return this._funcBack;
  }
  set funcBack(val: CompareFunc) {
    if (this._funcBack !== val) {
      this._funcBack = val;
      this.invalidateHash();
    }
  }
  get ref(): number {
    return this._ref;
  }
  set ref(val: number) {
    if (this._ref !== val) {
      this._ref = val;
      this.invalidateHash();
    }
  }
  get valueMask(): number {
    return this._valueMask;
  }
  set valueMask(val: number) {
    if (this._valueMask !== val) {
      this._valueMask = val;
      this.invalidateHash();
    }
  }
  get valueMaskBack(): number {
    return this._valueMaskBack;
  }
  set valueMaskBack(val: number) {
    if (this._valueMaskBack !== val) {
      this._valueMaskBack = val;
      this.invalidateHash();
    }
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
  setFrontOp(fail: StencilOp, zfail: StencilOp, pass: StencilOp): this {
    this.failOp = fail;
    this.zFailOp = zfail;
    this.passOp = pass;
    return this;
  }
  setBackOp(fail: StencilOp, zfail: StencilOp, pass: StencilOp): this {
    this.failOpBack = fail;
    this.zFailOpBack = zfail;
    this.passOpBack = pass;
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
  protected computeHash(): string {
    return this._enabled ?
      this._enableTwoSided
        ? `${this.sideHash(false)}-${this.sideHash(true)}`
        : `${this.sideHash(false)}`
      : '';
  }
  private sideHash(back: boolean): string {
    return back
      ? `${this._failOpBack}-${this._zFailOpBack}-${this._passOpBack}-${this._funcBack}-${this._valueMaskBack}-${this._writeMaskBack}`
      : `${this._failOp}-${this._zFailOp}-${this._passOp}-${this._func}-${this._valueMask}-${this._writeMask}`;
  }
}

export class WebGPURenderStateSet implements RenderStateSet {
  private _device: WebGPUDevice;
  private _colorState?: WebGPUColorState;
  private _blendingState?: WebGPUBlendingState;
  private _rasterizerState?: WebGPURasterizerState;
  private _depthState?: WebGPUDepthState;
  private _stencilState?: WebGPUStencilState;
  constructor(device: WebGPUDevice) {
    this._device = device;
    this.defaultColorState();
    this.defaultBlendingState();
    this.defaultRasterizerState();
    this.defaultDepthState();
    this.defaultStencilState();
  }
  get hash(): string {
    return `${this._colorState?.hash || ''}:${this._blendingState?.hash || ''}:${this._rasterizerState?.hash || ''}:${this.depthState?.hash || ''}:${this._stencilState?.hash || ''}`;
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
  useColorState(): ColorState {
    if (!this._colorState) {
      this._colorState = new WebGPUColorState();
    }
    return this._colorState;
  }
  defaultColorState() {
    this._colorState = null;
  }
  useBlendingState(): BlendingState {
    if (!this._blendingState) {
      this._blendingState = new WebGPUBlendingState();
    }
    return this._blendingState;
  }
  defaultBlendingState() {
    this._blendingState = null;
  }
  useRasterizerState(): RasterizerState {
    if (!this._rasterizerState) {
      this._rasterizerState = new WebGPURasterizerState();
    }
    return this._rasterizerState;
  }
  defaultRasterizerState() {
    this._rasterizerState = null;
  }
  useDepthState(): DepthState {
    if (!this._depthState) {
      this._depthState = new WebGPUDepthState();
    }
    return this._depthState;
  }
  defaultDepthState() {
    this._depthState = null;
  }
  useStencilState(): StencilState {
    if (!this._stencilState) {
      this._stencilState = new WebGPUStencilState();
    }
    return this._stencilState;
  }
  defaultStencilState() {
    this._stencilState = null;
  }
  apply(overridden: RenderStateSet, force?: boolean): void {
    this._device.setRenderStates(this);
    this._device.setRenderStatesOverridden(overridden);
  }
}
