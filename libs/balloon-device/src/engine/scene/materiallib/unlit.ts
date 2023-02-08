import { StandardMaterial } from "./standard";
import { UnlitLightModel } from "./lightmodel";
import type { Device } from "../../device";

export class UnlitMaterial extends StandardMaterial<UnlitLightModel> {
  constructor(device: Device) {
    super(device);
    this.lightModel = new UnlitLightModel();
  }
}
