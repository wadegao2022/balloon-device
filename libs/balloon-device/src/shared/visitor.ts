import {Constructor, superClassOf} from './utils';

type VisitFuncMap = Map<Constructor<object>, (t: unknown) => unknown>;

export function visitor(ctor: Constructor) {
  return function (target: Visitor, propertyKey: string) {
    Visitor.setVisitFunc(target.constructor as Constructor<Visitor>, ctor, target[propertyKey]);
  };
}

export class Visitor {
  /** @internal */
  private static readonly visitorFuncMap: Map<Constructor, VisitFuncMap> = new Map();
  /** @internal */
  private _filters: ((target: unknown)=>boolean)[];
  constructor() {
    this._filters = null;
  }
  addFilter(filter: (target: unknown) => boolean): void {
    if (filter) {
      if (!this._filters) {
        this._filters = [];
      }
      this._filters.push(filter);
    }
  }
  removeFilter(filter: (target: unknown) => boolean): void {
    const index = this._filters ? this._filters.indexOf(filter) : -1;
    if (index >= 0) {
      this._filters.splice(index, 1);
      if (this._filters.length === 0) {
        this._filters = null;
      }
    }
  }
  removeAllFilters(): void {
    this._filters = null;
  }
  visit(target: unknown, ...args: any[]): unknown {
    if (this._filters) {
      for (const filter of this._filters) {
        if (!filter(target)) {
          return;
        }
      }
    }
    return this.visitWithType(target, target.constructor as Constructor, ...args);
  }
  visitWithType(target: unknown, type: Constructor, ...args: any[]) {
    if (target) {
      let func: (t: unknown, ...args: any[]) => unknown = null;
      let visitorCls = this.constructor as Constructor;
      while (visitorCls !== Object && !func) {
        let objCls = type;
        while (objCls !== Object && !func) {
          const funcMap = Visitor.visitorFuncMap.get(visitorCls);
          func = funcMap?.get(objCls);
          if (!func) {
            objCls = superClassOf(objCls);
          }
        }
        if (!func) {
          visitorCls = superClassOf(visitorCls);
        }
      }
      return func && func.call(this, target, ...args);
    }
  }
  static getVisitFunc<T = Visitor, U = unknown>(
    visitorType: Constructor<T>,
    targetType: Constructor<U>,
  ): (this: T, target: U) => unknown {
    const funcMap = Visitor._getFuncMap(visitorType);
    return funcMap ? funcMap.get(targetType as Constructor) : null;
  }
  static setVisitFunc<T = Visitor>(
    visitorType: Constructor<T>,
    targetType: Constructor,
    func: (this: T, target: unknown) => unknown,
  ) {
    const funcMap = Visitor._getFuncMap(visitorType);
    funcMap && funcMap.set(targetType, func);
  }
  static removeVisitFunc<T = Visitor>(
    visitorType: Constructor<T>,
    targetType: Constructor,
  ) {
    const funcMap = Visitor._getFuncMap(visitorType);
    funcMap && funcMap.delete(targetType);
  }
  /** @internal */
  private static _getFuncMap(visitorType: Constructor) {
    let funcMap = Visitor.visitorFuncMap.get(visitorType);
    if (!funcMap) {
      funcMap = new Map();
      Visitor.visitorFuncMap.set(visitorType, funcMap);
    }
    return funcMap;
  }
}
