import { StandardMaterial } from "./standard";
import { PBRLightModelMR, PBRLightModelSG } from "./lightmodel";
import type { Device } from "../../device";

export class PBRMetallicRoughnessMaterial extends StandardMaterial<PBRLightModelMR> {
  constructor(device: Device) {
    super(device);
    this.lightModel = new PBRLightModelMR();
  }
}

export class PBRSpecularGlossinessMaterial extends StandardMaterial<PBRLightModelSG> {
  constructor(device: Device) {
    super(device);
    this.lightModel = new PBRLightModelSG();
  }
}
