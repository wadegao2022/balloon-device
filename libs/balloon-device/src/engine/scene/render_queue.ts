import type { Device } from '../device';
import type { Matrix4x4 } from '../math';
import type { Camera } from './camera';
import type { Drawable } from './drawable';
import type { RenderPass } from './renderers';

export interface InstanceData {
  worldMatrices: Matrix4x4[];
  hash: string,
}

export interface IRenderQueueItem {
  drawable: Drawable,
  sortDistance: number,
  instanceData: InstanceData,
}

interface RenderItemList {
  opaqueList: IRenderQueueItem[];
  opaqueInstanceList: { [hash: string]: number };
  transList: IRenderQueueItem[];
  transInstanceList: { [hash: string]: number };
}

export class RenderQueue {
  /** @internal */
  private _itemLists: { [order: number]: RenderItemList };
  /** @internal */
  private _renderPass: RenderPass;
  constructor(renderPass: RenderPass) {
    this._itemLists = {};
    this._renderPass = renderPass;
  }
  get renderPass(): RenderPass {
    return this._renderPass;
  }
  get items() {
    return this._itemLists;
  }
  getMaxBatchSize(device: Device) {
    return device.getShaderCaps().maxUniformBufferSize / 64;
  }
  push(camera: Camera, drawable: Drawable, renderOrder: number) {
    if (drawable) {
      let itemList = this._itemLists[renderOrder];
      if (!itemList) {
        itemList = {
          opaqueList: [],
          opaqueInstanceList: {},
          transList: [],
          transInstanceList: {},
        };
        this._itemLists[renderOrder] = itemList;
      }
      const trans = drawable.isTransparency();
      const list = trans ? itemList.transList : itemList.opaqueList;
      if (drawable.isBatchable()) {
        const instanceList = trans ? itemList.transInstanceList : itemList.opaqueInstanceList;
        const hash = drawable.getInstanceId(this._renderPass);
        const index = instanceList[hash];
        if (index === undefined || list[index].instanceData.worldMatrices.length === this.getMaxBatchSize(camera.scene.device)) {
          instanceList[hash] = list.length;
          list.push({
            drawable,
            sortDistance: drawable.getSortDistance(camera),
            instanceData: {
              worldMatrices: [drawable.getXForm().worldMatrix],
              hash: hash,
            }
          });
        } else {
          list[index].instanceData.worldMatrices.push(drawable.getXForm().worldMatrix);
        }
      } else {
        list.push({
          drawable,
          sortDistance: drawable.getSortDistance(camera),
          instanceData: null,
        });
      }
    }
  }
  clear() {
    this._itemLists = {};
  }
  sortItems() {
    for (const list of Object.values(this._itemLists)) {
      list.opaqueList.sort((a, b) => a.sortDistance - b.sortDistance);
      list.transList.sort((a, b) => b.sortDistance - a.sortDistance);
    }
  }
}
