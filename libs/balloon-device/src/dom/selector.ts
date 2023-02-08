import {List, ListIterator} from '../shared';
import {RNode} from './node';
import type {RElement} from './element';

const rIdentifier = /^([^\s.*[\]|()$^+#><~!=:]+)/;
const rOp = /^\s*(=|~=|\|=|\^=|\$=|\*=)?\s*/;
const rCombine = /^\s*([>|~|+]?)\s*/;
const rLiteral = /^"(.*)"|'(.*)'/;
const rCloseBracket = /^\s*\]/;
const rWS = /^\s*$/;

const enum Combine {
  NONE,
  DESCEND,
  CHILD,
  SIBLING,
  ADJACENT,
}

const enum Op {
  ANY,
  EQUAL,
  CONTAINS,
  START,
  END,
}

const enum Filter {
  NONE,
  TAGNAME,
  CLASS,
  ID,
  COMBINE,
  ATTRIBUTE,
  PSEUDO_CLASS,
  PSEUDO_ELEMENT,
}

interface FilterInfo {
  type: Filter;
  name?: string; // tag|class|id|pseudo
  combineType?: Combine;
  attribOp?: Op;
  attribKey?: string;
  attribValue?: string;
  numIds?: number;
  numClasses?: number;
  numTypes?: number;
}

interface IPseudoElementCallback {
  (node: RNode, pseudoType: string): void;
}

export class Rule {
  /** @internal */
  filters: List<FilterInfo>;
  /** @internal */
  targets: Set<RNode>;
  /** @internal */
  specificity: number;
  constructor() {
    this.filters = new List<FilterInfo>();
    this.targets = new Set();
    this.specificity = 0;
  }
  resolve(
    roots: RNode[],
    up: boolean,
    allowInternal: boolean,
    pseudoElementCallback?: IPseudoElementCallback,
  ) {
    const allElements: Set<RNode> = new Set();
    roots.forEach((root) => {
      this._traverseElement(root, allowInternal, (el) => {
        allElements.add(el);
      });
      if (up) {
        let p = root.parentNode;
        while (p) {
          if (allowInternal || p.nodeType === RNode.ELEMENT_NODE) {
            allElements.add(p as RElement);
          }
          p = p.parentNode;
        }
      }
    });
    this.targets = new Set(allElements);
    for (const it = this.filters.begin(); it.valid(); it.next()) {
      let tmp: Set<RNode> = new Set();
      if (it.data.type != Filter.COMBINE) {
        this.targets.forEach((el) => {
          this._walkWithFilter(it, el, tmp, allowInternal, allElements, pseudoElementCallback);
        });
        const t = this.targets;
        this.targets = tmp;
        tmp = t;
        tmp.clear();
      }
    }
  }
  /** @internal */
  private _traverseElement(
    element: RNode,
    allowInternal: boolean,
    cb: (element: RNode) => void,
  ): void {
    if (allowInternal || !element._isInternal()) {
      if (allowInternal || element.nodeType === RNode.ELEMENT_NODE) {
        cb(element as RElement);
      }
      const children = element._getChildren();
      children.forEach((child) => this._traverseElement(child, allowInternal, cb));
    }
  }
  /** @internal */
  private _check(filter: FilterInfo, element: RNode): boolean {
    switch (filter.type) {
    case Filter.TAGNAME:
      return (
        element.nodeType === RNode.ELEMENT_NODE && (element as RElement).tagName === filter.name
      );
    case Filter.CLASS:
      return (
        element.nodeType === RNode.ELEMENT_NODE &&
          (element as RElement).classList.contains(filter.name)
      );
    case Filter.ID:
      return element.nodeType === RNode.ELEMENT_NODE && (element as RElement).id === filter.name;
    case Filter.ATTRIBUTE: {
      if (element.nodeType === RNode.ELEMENT_NODE) {
        const val = (element as RElement).getAttribute(filter.attribKey);
        switch (filter.attribOp) {
        case Op.ANY:
          return val !== undefined;
        case Op.CONTAINS:
          return typeof val === 'string' && val.indexOf(filter.attribValue) >= 0;
        case Op.EQUAL:
          return val === filter.attribValue;
        case Op.START:
          return typeof val === 'string' && val.indexOf(filter.attribValue) === 0;
        case Op.END:
          return (
            typeof val === 'string' &&
                val.length >= filter.attribValue.length &&
                val.substr(-filter.attribValue.length) === filter.attribValue
          );
        default:
          return false;
        }
      } else {
        return false;
      }
    }
    case Filter.PSEUDO_CLASS: {
      switch (filter.name) {
      case 'hover':
        return element._isHover();
      case 'active':
        return element._isActive();
      case 'disabled':
        return false;
      case 'empty':
        return element.childNodes.length === 0;
      case 'enabled':
        return true;
      case 'first-child':
        return !element.previousSibling;
      case 'last-child':
        return !element.nextSibling;
      case 'only-child':
        return !element.previousSibling && !element.nextSibling;
      case 'focus':
        return element.gui.getFocus() === element;
      case 'focus-within':
        return !!element.gui.getFocus()?._isSucceedingOf(element);
      default:
        return false;
      }
    }
    case Filter.NONE:
      return true;
    default:
      return false;
    }
  }
  /** @internal */
  private _walkWithFilter(
    filter: ListIterator<FilterInfo>,
    last: RNode,
    targets: Set<RNode>,
    allowInternal: boolean,
    elementSet?: Set<RNode>,
    pseudoElementCallback?: IPseudoElementCallback,
  ) {
    const prevIt = filter.getPrev();
    const lastFilter = prevIt.valid() ? prevIt.data : null;
    switch (filter.data.type) {
    case Filter.NONE:
    case Filter.TAGNAME:
    case Filter.CLASS:
    case Filter.ID:
    case Filter.PSEUDO_CLASS:
    case Filter.ATTRIBUTE: {
      if (lastFilter === null || lastFilter.type !== Filter.COMBINE) {
        if (this._check(filter.data, last)) {
          targets.add(last);
        }
      } else if (lastFilter) {
        switch (lastFilter.combineType) {
        case Combine.CHILD: {
          last._getChildren().forEach((child) => {
            if (
              child.nodeType === RNode.ELEMENT_NODE &&
                  elementSet.has(child) &&
                  this._check(filter.data, child as RElement)
            ) {
              targets.add(child as RElement);
            }
          });
          break;
        }
        case Combine.DESCEND: {
          last._getChildren().forEach((child) => {
            if (child.nodeType === RNode.ELEMENT_NODE) {
              this._traverseElement(child as RElement, allowInternal, (el) => {
                if (elementSet.has(el) && this._check(filter.data, el)) {
                  targets.add(el);
                }
              });
            }
          });
          break;
        }
        case Combine.SIBLING: {
          let next = last.nextSibling;
          while (next) {
            if (
              next.nodeType === RNode.ELEMENT_NODE &&
                  elementSet.has(next) &&
                  this._check(filter.data, next as RElement)
            ) {
              targets.add(next as RElement);
            }
            next = next.nextSibling;
          }
          break;
        }
        case Combine.ADJACENT: {
          const next = last.nextSibling;
          if (
            next &&
                next.nodeType === RNode.ELEMENT_NODE &&
                elementSet.has(next) &&
                this._check(filter.data, next as RElement)
          ) {
            targets.add(next as RElement);
          }
          break;
        }
        }
      }
      break;
    }
    case Filter.PSEUDO_ELEMENT: {
      if (
        pseudoElementCallback &&
          lastFilter &&
          lastFilter.type !== Filter.COMBINE &&
          !filter.getNext().valid()
      ) {
        pseudoElementCallback(last, filter.data.name);
      }
      break;
    }
    }
  }
}

export class RSelector {
  /** @internal */
  protected _rules: Rule[];
  constructor(s: string) {
    this._rules = s ? this._createRules(s) : [];
    if (this._rules.some((rule) => !this._validateRule(rule))) {
      this._rules = [];
    }
  }
  resolve(root: RNode, excludeRoot: boolean, allowInternal): RNode[] {
    if (this._rules.length === 0) {
      return [];
    }
    const matched: Set<RNode> = new Set();
    this._rules.forEach((rule) => {
      rule.resolve([root], false, allowInternal);
      rule.targets.forEach((t) => {
        matched.add(t);
      });
    });
    if (excludeRoot) {
      matched.delete(root);
    }
    return Array.from(matched);
  }
  multiResolve(roots: RNode[], allowInternal): RNode[] {
    if (this._rules.length === 0) {
      return [];
    }
    const matched: Set<RNode> = new Set();
    this._rules.forEach((rule) => {
      rule.resolve(roots, true, allowInternal);
      rule.targets.forEach((t) => {
        matched.add(t);
      });
    });
    return Array.from(matched);
  }
  rules(): Rule[] {
    return this._rules;
  }
  /** @internal */
  private _validateRule(rule: Rule): boolean {
    for (const it = rule.filters.begin(); it.valid(); it.next()) {
      const prev = it.getPrev();
      if (it.data.type === Filter.COMBINE && prev.valid() && prev.data.type === Filter.COMBINE) {
        return false;
      }
    }
    return true;
  }
  /** @internal */
  private _createRules(s: string): Rule[] {
    return s
      .trim()
      .split(',')
      .map((val) => val.trim())
      .filter((val) => val !== '')
      .map((val) => this._createRule(val))
      .filter((val) => !!val)
      .sort((a, b) => a.specificity - b.specificity);
  }
  /** @internal */
  private _createRule(s: string): Rule {
    const rule = new Rule();
    let numIds = 0;
    let numClasses = 0;
    let numTypes = 0;
    for (;;) {
      const filter = this._createFilter(s);
      if (filter === null) {
        return null;
      } else if (filter[0] === null) {
        break;
      } else {
        rule.filters.append(filter[0]);
        s = filter[1];
        numIds += filter[0].numIds;
        numClasses += filter[0].numClasses;
        numTypes += filter[0].numTypes;
      }
    }
    const base = 100;
    rule.specificity = numIds * base * base + numClasses * base + numTypes;
    return rule;
  }
  /** @internal */
  private _createFilter(s: string): [FilterInfo, string] {
    if (rWS.exec(s)) {
      return [null, ''];
    }
    const info = {numIds: 0, numClasses: 0, numTypes: 0} as FilterInfo;
    let combine = rCombine.exec(s);
    if (combine && combine[0] === '') {
      combine = null;
    }
    if (!combine) {
      info.combineType = Combine.NONE;
      s = s.trim();
      switch (s[0]) {
      case '*': {
        info.type = Filter.NONE;
        s = s.substr(1);
        break;
      }
      case '.': {
        info.numClasses++;
        info.type = Filter.CLASS;
        s = s.substr(1);
        const match = rIdentifier.exec(s);
        if (!match) {
          return null;
        }
        info.name = match[1];
        s = s.substr(match[0].length);
        break;
      }
      case '#': {
        info.numIds++;
        info.type = Filter.ID;
        s = s.substr(1);
        const match = rIdentifier.exec(s);
        if (!match) {
          return null;
        }
        info.name = match[1];
        s = s.substr(match[0].length);
        break;
      }
      case ':': {
        info.numClasses++;
        if (s[1] !== ':') {
          info.type = Filter.PSEUDO_CLASS;
          s = s.substr(1);
          const match = rIdentifier.exec(s);
          if (!match) {
            return null;
          }
          info.name = match[1];
          s = s.substr(match[0].length);
        } else {
          info.type = Filter.PSEUDO_ELEMENT;
          s = s.substr(2);
          const match = rIdentifier.exec(s);
          if (!match) {
            return null;
          }
          info.name = match[1];
          s = s.substr(match[0].length);
        }
        break;
      }
      case '[': {
        info.numClasses++;
        info.type = Filter.ATTRIBUTE;
        s = s.substr(1);
        const matchKey = rIdentifier.exec(s);
        if (!matchKey) {
          return null;
        }
        info.attribKey = matchKey[1];
        s = s.substr(matchKey[0].length);
        const matchOp = rOp.exec(s);
        if (!matchOp) {
          return null;
        }
        switch (matchOp[1]) {
        case '=':
          info.attribOp = Op.EQUAL;
          break;
        case '~=':
        case '*=':
          info.attribOp = Op.CONTAINS;
          break;
        case '|=':
        case '^=':
          info.attribOp = Op.START;
          break;
        case '$=':
          info.attribOp = Op.END;
          break;
        default:
          info.attribOp = Op.ANY;
          break;
        }
        s = s.substr(matchOp[0].length);
        if (info.attribOp !== Op.ANY) {
          const matchValue = (s[0] === "'" || s[0] === '"' ? rLiteral : rIdentifier).exec(s);
          if (!matchValue) {
            return null;
          }
          info.attribValue = matchValue[1] || matchValue[2];
          s = s.substr(matchValue[0].length);
        }
        const matchCloseBracket = rCloseBracket.exec(s);
        if (!matchCloseBracket) {
          return null;
        }
        s = s.substr(matchCloseBracket[0].length);
        break;
      }
      default: {
        info.numTypes++;
        info.type = Filter.TAGNAME;
        const match = rIdentifier.exec(s);
        if (!match) {
          return null;
        }
        info.name = match[1];
        s = s.substr(match[0].length);
        break;
      }
      }
    } else {
      s = s.substr(combine[0].length);
      info.type = Filter.COMBINE;
      if (combine[1] === '') {
        info.combineType = Combine.DESCEND;
      } else if (combine[1] === '>') {
        info.combineType = Combine.CHILD;
      } else if (combine[1] === '~') {
        info.combineType = Combine.SIBLING;
      } /* if (combine[1] === '+') */ else {
        info.combineType = Combine.ADJACENT;
      }
    }
    return [info, s];
  }
}
