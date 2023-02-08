import type {PBShaderExp, PBGlobalScope, ProgramBuilder} from './programbuilder';

export type PBReflectionTagGetter = (scope: PBGlobalScope)=>PBShaderExp;

export class PBReflection {
  /** @internal */
  private _builder: ProgramBuilder;
  /** @internal */
  private _tagList: Record<string, PBReflectionTagGetter>;
  /** @internal */
  private _attribList: Record<number, PBShaderExp>;
  constructor(builder: ProgramBuilder) {
    this._builder = builder;
    this._tagList = {};
    this._attribList = {};
  }
  get vertexAttributes(): number[] {
    return this._builder.getVertexAttributes();
  }
  hasVertexAttribute(attrib: number): boolean {
    return this.vertexAttributes.indexOf(attrib) >= 0;
  }
  clear(): void {
    this._tagList = {};
    this._attribList = {};
  }
  tag(name: string): PBShaderExp;
  tag(name: string, getter: PBReflectionTagGetter): void;
  tag(values: Record<string, PBReflectionTagGetter>): void;
  tag(arg0: string|Record<string, PBReflectionTagGetter>, arg1?: PBReflectionTagGetter): PBShaderExp|void {
    if (typeof arg0 === 'string') {
      if (arg1 === undefined) {
        return this.getTag(arg0);
      } else {
        this.addTag(arg0, arg1);
      }
    } else {
      for (const k of Object.keys(arg0)) {
        this.addTag(k, arg0[k]);
      }
    }
  }
  attribute(attrib: number): PBShaderExp {
    return this._attribList[attrib] || null;
  }
  /** @internal */
  setAttrib(attrib: number, exp: PBShaderExp) {
    this._attribList[attrib] = exp;
  }
  /** @internal */
  private addTag(name: string, exp: PBReflectionTagGetter): void {
    this._tagList[name] = exp;
  }
  /** @internal */
  private getTag(name: string): PBShaderExp {
    const getter = this._tagList[name];
    return getter ? getter(this._builder.globalScope) : null;
  }
}
