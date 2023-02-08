/* eslint-disable @typescript-eslint/no-explicit-any */
import { Visitor, REventPath, REventPathBuilder, REventTarget, REvent } from '../../shared';
import { XForm, Vector3, Quaternion } from '../math';
import type { Scene } from './scene';
import type { GraphNode } from './graph_node';
import type { Mesh } from './mesh';
import type { Camera } from './camera';
import type { Terrain } from './terrain';
import type { PunctualLight, BaseLight } from './light';

class SceneNodeEventPath implements REventPath {
  path: REventTarget[];
  constructor() {
    this.path = [];
  }
  toArray(): REventTarget[] {
    return this.path;
  }
}

export class SceneNodeEventPathBuilder implements REventPathBuilder {
  build(node: REventTarget): REventPath {
    const path = new SceneNodeEventPath();
    let sceneNode = node as SceneNode;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    while (sceneNode) {
      path.path.push(sceneNode);
      if (sceneNode.parent) {
        sceneNode = sceneNode.parent;
      } else {
        path.path.push(sceneNode.scene);
        sceneNode = null;
      }
    }
    return path;
  }
}

export class SceneNodeAttachEvent extends REvent {
  static readonly ATTACHED_NAME = 'attached';
  static readonly DETACHED_NAME = 'detached';
  node: SceneNode;
  constructor(name: string, node: SceneNode) {
    super(name, true, false);
    this.node = node;
  }
}

const sceneNodeEventPathBuilder = new SceneNodeEventPathBuilder();

export class SceneNode extends XForm<SceneNode> {
  /** @internal */
  protected _name: string;
  /** @internal */
  protected _attachEvent: SceneNodeAttachEvent;
  /** @internal */
  protected _detachEvent: SceneNodeAttachEvent;
  constructor(scene: Scene, parent?: SceneNode) {
    super(scene, null, sceneNodeEventPathBuilder);
    this._name = '';
    this._attachEvent = new SceneNodeAttachEvent(SceneNodeAttachEvent.ATTACHED_NAME, this);
    this._detachEvent = new SceneNodeAttachEvent(SceneNodeAttachEvent.DETACHED_NAME, this);
    if (parent !== null) {
      this.reparent(parent || scene.rootNode);
    }
  }
  get name() {
    return this._name;
  }
  set name(val: string) {
    this._name = val || '';
  }
  get attached(): boolean {
    return !!this._scene?.rootNode.isParentOf(this);
  }
  setPosition(value: Vector3): this {
    this.position = value;
    return this;
  }
  setScale(value: Vector3): this {
    this.scaling = value;
    return this;
  }
  setRotation(value: Quaternion): this {
    this.rotation = value;
    return this;
  }
  hasChild(child: SceneNode): boolean {
    return this._children.indexOf(child) >= 0;
  }
  removeChildren() {
    while (this._children.length) {
      this._children[0].remove();
    }
  }
  iterateChildren(func: (child: SceneNode) => void) {
    for (const child of this._children) {
      func(child);
      child.iterateChildren(func);
    }
  }
  isParentOf(child: SceneNode): boolean {
    while (child && child !== this) {
      child = child.parent;
    }
    return child === this;
  }
  remove() {
    this.parent = null;
    return this;
  }
  reparent(p?: SceneNode) {
    this.parent = p;
    return this;
  }
  accept(v: Visitor) {
    v.visit(this);
  }
  traverse(v: Visitor, inverse?: boolean) {
    if (inverse) {
      for (let i = this._children.length - 1; i >= 0; i--) {
        this._children[i].traverse(v, inverse);
      }
      v.visit(this);
    } else {
      v.visit(this);
      for (const child of this._children) {
        child.traverse(v);
      }
    }
  }
  isGraphNode(): this is GraphNode {
    return false;
  }
  isLight(): this is BaseLight {
    return false;
  }
  isMesh(): this is Mesh {
    return false;
  }
  isTerrain(): this is Terrain {
    return false;
  }
  isCamera(): this is Camera {
    return false;
  }
  isPunctualLight(): this is PunctualLight {
    return false;
  }
  dispose() {
    this.remove();
    this.removeChildren();
  }
  invalidateWorldBoundingVolume() {
    super.invalidateWorldBoundingVolume();
    this._scene && this._scene._bvChanged(this);
  }
  /** @internal */
  protected _setParent(p: SceneNode): void {
    const lastAttached = this.attached;
    super._setParent(p);
    if (lastAttached) {
      this._fireAttachEvent(this._detachEvent);
    }
    if (this.attached) {
      this._fireAttachEvent(this._attachEvent);
    }
  }
  /** @internal */
  private _fireAttachEvent(evt: SceneNodeAttachEvent) {
    evt.reset();
    this.dispatchEvent(evt);
    for (const child of this.children) {
      child._fireAttachEvent(evt);
    }
  }
}
