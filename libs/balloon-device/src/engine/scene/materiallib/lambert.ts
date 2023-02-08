import { StandardMaterial } from "./standard";
import { LambertLightModel } from "./lightmodel";
import type { Device } from "../../device";

export class LambertMaterial extends StandardMaterial<LambertLightModel> {
  constructor(device: Device) {
    super(device);
    this.lightModel = new LambertLightModel();
  }
}
