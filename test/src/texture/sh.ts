import * as chaos from 'balloon-device';

class SphericalHarmonicsBasis {
  static Y0(v: chaos.Vector3): number {
    return 0.2820947917;
  }
  static Y1(v: chaos.Vector3): number {
    return 0.4886025119 * v.y;
  }
  static Y2(v: chaos.Vector3): number {
    return 0.4886025119 * v.z;
  }
  static Y3(v: chaos.Vector3): number {
    return 0.4886025119 * v.x;
  }
  static Y4(v: chaos.Vector3): number {
    return 1.0925484306 * v.x * v.y;
  }
  static Y5(v: chaos.Vector3): number {
    return 1.0925484306 * v.y * v.z;
  }
  static Y6(v: chaos.Vector3): number {
    return 0.3153915652 * (3 * v.z * v.z - 1);
  }
  static Y7(v: chaos.Vector3): number {
    return 1.0925484306 * v.x * v.z;
  }
  static Y8(v: chaos.Vector3): number {
    return 0.5462742153 * (v.x * v.x - v.y * v.y);
  }
  static eval(c: number, v: chaos.Vector3): number {
    switch (c) {
    case 0: return this.Y0(v);
    case 1: return this.Y1(v);
    case 2: return this.Y2(v);
    case 3: return this.Y3(v);
    case 4: return this.Y4(v);
    case 5: return this.Y5(v);
    case 6: return this.Y6(v);
    case 7: return this.Y7(v);
    case 8: return this.Y8(v);
    default: return 0;
    }
  }
}

function areaElement(x: number, y: number): number {
  return Math.atan2(x * y, Math.sqrt(x * x + y * y + 1));
}

function differentialSolidAngle(textureSize: number, U: number, V: number): number {
  const inv = 1 / textureSize;
  const u = 2 * (U + 0.5 * inv) - 1;
  const v = 2 * (V + 0.5 * inv) - 1;
  const x0 = u - inv;
  const y0 = v - inv;
  const x1 = u + inv;
  const y1 = v + inv;
  return areaElement(x0, y0) - areaElement(x0, y1) - areaElement(x1, y0) + areaElement(x1, y1);
}

function directionFromCubemapTexel(face: number, u: number, v: number): chaos.Vector3 {
  const dir = chaos.Vector3.zero();
  switch (face) {
  case 0: //+X
    dir.x = 1;
    dir.y = v * -2 + 1;
    dir.z = u * -2 + 1;
    break;
  case 1: //-X
    dir.x = -1;
    dir.y = v * -2 + 1;
    dir.z = u * 2 - 1;
    break;
  case 2: //+Y
    dir.x = u * 2 - 1;
    dir.y = 1;
    dir.z = v * 2 - 1;
    break;
  case 3: //-Y
    dir.x = u * 2 - 1;
    dir.y = -1;
    dir.z = v * -2 + 1;
    break;
  case 4: //+Z
    dir.x = u * 2 - 1;
    dir.y = v * -2 + 1;
    dir.z = 1;
    break;
  case 5: //-Z
    dir.x = u * -2 + 1;
    dir.y = v * -2 + 1;
    dir.z = -1;
    break;
  }
  return dir.inplaceNormalize();
}

export async function projectCubemapCPU(input: chaos.TextureCube): Promise<chaos.Vector3[]> {
  if (!input || (input.format !== chaos.TextureFormat.RGBA8UNORM && input.format !== chaos.TextureFormat.RGBA8UNORM_SRGB)) {
    throw new Error(`cubemap must be rgba8unorm format`);
  }
  const size = input.width;
  const output: chaos.Vector3[] = Array.from({length: 9}).map(() => chaos.Vector3.zero());
  for (let face = 0; face < 6; face++) {
    const input_face = new Uint8Array(size * size * 4);
    await input.readPixels(face, 0, 0, size, size, input_face);
    for (let texel = 0; texel < size * size; texel++) {
      const u = (texel % size) / size;
      const v = Math.floor(texel / size) / size;
      //get the direction vector
      const dir = directionFromCubemapTexel(face, u, v);
      let radianceR = input_face[texel * 4 + 0] / 255;
      let radianceG = input_face[texel * 4 + 1] / 255;
      let radianceB = input_face[texel * 4 + 2] / 255;
      if (input.format === chaos.TextureFormat.RGBA8UNORM_SRGB) {
        radianceR = Math.pow(radianceR, 2.2);
        radianceG = Math.pow(radianceG, 2.2);
        radianceB = Math.pow(radianceB, 2.2);
      }
      //compute the differential solid angle
      const d_omega = differentialSolidAngle(size, u, v);
      //cycle for 9 coefficients
      for (let c = 0; c < 9; ++c) {
        //compute shperical harmonic
        const sh = SphericalHarmonicsBasis.eval(c, dir);
        output[c].x += radianceR * d_omega * sh;
        output[c].y += radianceG * d_omega * sh;
        output[c].z += radianceB * d_omega * sh;
      }
    }
  }
  return output;
}
