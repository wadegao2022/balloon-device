import type { ListIterator } from "../../shared";
import { Texture2D } from "../device";
import type { Matrix4x4, XForm } from "../math";
import type { BoundingVolume } from "./bounding_volume";
import type { Camera } from "./camera";
import type { EnvironmentLighting } from "./materiallib";
import type { RenderPass } from "./renderers";
import type { InstanceData } from "./render_queue";
import type { ShadowMapper } from "./shadow";

export interface DrawContext {
  camera: Camera,
  target: Drawable,
  renderPass: RenderPass,
  renderPassHash: string;
  materialFunc: number,
  environment?: EnvironmentLighting,
  envStrength?: number,
  shadowMapper?: ShadowMapper;
  instanceData?: InstanceData
}

export interface Drawable {
  getXForm(): XForm;
  getBoneMatrices(): Texture2D;
  getInvBindMatrix(): Matrix4x4;
  getSortDistance(camera: Camera): number;
  isTransparency(): boolean;
  isUnlit(): boolean;
  getBoundingVolume(): BoundingVolume;
  draw(ctx: DrawContext);
  setLastRenderTimestamp(ts: number): void;
  getLastRenderTimeStamp(): number;
  setLRUIterator(iter: ListIterator<Drawable>);
  getLRUIterator(): ListIterator<Drawable>;
  isBatchable(): this is BatchDrawable;
}

export interface BatchDrawable extends Drawable {
  getInstanceId(renderPass: RenderPass): string;
}
