import { Vector2, Vector3, Device, Texture2D, TextureFormat, GPUResourceUsageFlags, Vector4, Matrix3x3 } from "balloon-device";

interface MicrofacetDistributionSample {
  pdf?: number;
  cosTheta?: number;
  sinTheta?: number;
  phi?: number;
}

function hammersley(i: number, iN: number, out: Vector2) {
  const tof = 0.5 / 0x80000000;
  let bits = i;
  bits = (bits << 16) | (bits >>> 16);
  bits = ((bits & 0x55555555) << 1) | ((bits & 0xAAAAAAAA) >>> 1);
  bits = ((bits & 0x33333333) << 2) | ((bits & 0xCCCCCCCC) >>> 2);
  bits = ((bits & 0x0F0F0F0F) << 4) | ((bits & 0xF0F0F0F0) >>> 4);
  bits = ((bits & 0x00FF00FF) << 8) | ((bits & 0xFF00FF00) >>> 8);
  out.set(i * iN, (bits >>> 0) * tof);
}

function hemisphereUniformSample(u: Vector2, out: Vector3) {
  const phi = 2 * Math.PI * u.x;
  const cosTheta = 1 - u.y;
  const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
  out.set(sinTheta * Math.cos(phi), sinTheta * Math.sin(phi), cosTheta);
}

function hemisphereImportanceSampleDggx(u: Vector2, a: number, out: Vector3) {
  const phi = 2 * Math.PI * u.x;
  const cosTheta2 = (1 - u.y) / (1 + (a + 1) * ((a - 1) * u.y));
  const cosTheta = Math.sqrt(cosTheta2);
  const sinTheta = Math.sqrt(1 - cosTheta2);
  out.set(sinTheta * Math.cos(phi), sinTheta * Math.sin(phi), cosTheta);
}

function visibility(NdotV: number, NdotL: number, a: number): number {
  const a2 = a * a;
  const GGXL = NdotV * Math.sqrt((NdotL - NdotL * a2) * NdotL + a2);
  const GGXV = NdotL * Math.sqrt((NdotV - NdotV * a2) * NdotV + a2);
  return 0.5 / (GGXL + GGXV);
}

function DFV_Multiscatter(NoV: number, linearRoughness: number, numSamples: number, out: Vector2) {
  out.set(0, 0);
  const V = new Vector3(Math.sqrt(1 - NoV * NoV), 0, NoV);
  const u = new Vector2();
  const H = new Vector3();
  const L = new Vector3();
  for (let i = 0; i < numSamples; i++) {
    hammersley(i, 1 / numSamples, u);
    hemisphereImportanceSampleDggx(u, linearRoughness, H);
    Vector3.scale(H, 2 * Vector3.dot(V, H), L).subBy(V);
    const VoH = Math.min(Math.max(Vector3.dot(V, H), 0), 1);
    const NoL = Math.min(Math.max(L.z, 0), 1);
    const NoH = Math.min(Math.max(H.z, 0), 1);
    if (NoL > 0) {
      const v = visibility(NoV, NoL, linearRoughness) * NoL * (VoH / NoH);
      const Fc = Math.pow(1 - VoH, 5);
      /*
       * Assuming f90 = 1
       *   Fc = (1 - V•H)^5
       *   F(h) = f0*(1 - Fc) + Fc
       *
       * f0 and f90 are known at runtime, but thankfully can be factored out, allowing us
       * to split the integral in two terms and store both terms separately in a LUT.
       *
       * At runtime, we can reconstruct Er() exactly as below:
       *
       *            4                <v•h>
       *   DFV.x = --- ∑ Fc V(v, l) ------- <n•l>
       *            N  h             <n•h>
       *
       *
       *            4                <v•h>
       *   DFV.y = --- ∑    V(v, l) ------- <n•l>
       *            N  h             <n•h>
       *
       *
       *   Er() = (1 - f0) * DFV.x + f0 * DFV.y
       *
       *        = mix(DFV.xxx, DFV.yyy, f0)
       *
       */
      out.x += v * Fc;
      out.y += v;
    }
  }
  out.x *= 4 / numSamples;
  out.y *= 4 / numSamples;
}

function visibilityAshikhmin(NdotV: number, NdotL: number): number {
  return Math.min(Math.max(1 / (4 * (NdotL + NdotV - NdotL * NdotV)), 0), 1);
}

function mix(x: number, y: number, a: number): number {
  return x * (1 - a) + y * a;
}

function l(x: number, alphaG: number): number {
  const oneMinusAlphaSq = (1 - alphaG) * (1 - alphaG);
  const a = mix(21.5473, 25.3245, oneMinusAlphaSq);
  const b = mix(3.82987, 3.32435, oneMinusAlphaSq);
  const c = mix(0.19823, 0.16801, oneMinusAlphaSq);
  const d = mix(-1.97760, -1.27393, oneMinusAlphaSq);
  const e = mix(-4.32054, -4.85967, oneMinusAlphaSq);
  return a / (1 + b * Math.pow(x, c)) + d * x + e;
}

function lambdaSheen(cosTheta: number, alphaG: number): number {
  return Math.abs(cosTheta) < 0.5 ? Math.exp(l(Math.abs(cosTheta), alphaG)) : Math.exp(2 * l(0.5, alphaG) - l(1 - Math.abs(cosTheta), alphaG));
}

function visibilityCharlie(NdotV: number, NdotL: number, a: number): number {
  const alphaG = a;
  return 1 / ((1 + lambdaSheen(NdotV, alphaG) + lambdaSheen(NdotL, alphaG)) * (4 * NdotV * NdotL));
}

function distributionCharlie(NdotH: number, roughness: number) {
  roughness = Math.max(roughness, 0.000001);
  const invAlpha = 1 / roughness;
  const cos2h = NdotH * NdotH;
  const sin2h = 1 - cos2h;
  return (2 + invAlpha) * Math.pow(sin2h, invAlpha * 0.5) / (2 * Math.PI);
}

function charlie(xi: Vector2, roughness: number, sample: MicrofacetDistributionSample) {
  const alpha = roughness * roughness;
  sample.sinTheta = Math.pow(xi.y, alpha / (2 * alpha + 1));
  sample.cosTheta = Math.sqrt(1 - sample.sinTheta * sample.sinTheta);
  sample.phi = 2 * Math.PI * xi.x;
  sample.pdf = distributionCharlie(sample.cosTheta, Math.max(alpha, 0.000001)) / 4;
}

const bitangent = new Vector3();
const tangent = new Vector3();
const up = new Vector3(0, 1, 0);
function generateTBN(normal: Vector3, out: Matrix3x3) {
  bitangent.set(0.0, 1.0, 0.0);
  const NdotUp = Vector3.dot(normal, up);
  const epsilon = 0.0000001;
  if (1.0 - Math.abs(NdotUp) <= epsilon) {
    // Sampling +Y or -Y, so we need a more robust bitangent.
    if (NdotUp > 0.0) {
      bitangent.set(0.0, 0.0, 1.0);
    } else {
      bitangent.set(0.0, 0.0, -1.0);
    }
  }
  Vector3.cross(bitangent, normal, tangent).inplaceNormalize();
  Vector3.cross(normal, tangent, bitangent);
  out.setCol(0, tangent);
  out.setCol(1, bitangent);
  out.setCol(2, normal);
}

const xi = new Vector2();
const importanceSample: MicrofacetDistributionSample = {};
const localSpaceDirection = new Vector3();
const TBN = new Matrix3x3();
const direction = new Vector3();
function getImportanceSample(sampleIndex: number, sampleCount: number, N: Vector3, roughness: number, out: Vector4) {
  // generate a quasi monte carlo point in the unit square [0.1)^2
  hammersley(sampleIndex, 1 / sampleCount, xi);
  // generate the points on the hemisphere with a fitting mapping for
  // the distribution (e.g. lambertian uses a cosine importance)
  charlie(xi, roughness, importanceSample);

  // transform the hemisphere sample to the normal coordinate frame
  // i.e. rotate the hemisphere to the normal direction
  localSpaceDirection.set(
    importanceSample.sinTheta * Math.cos(importanceSample.phi),
    importanceSample.sinTheta * Math.sin(importanceSample.phi),
    importanceSample.cosTheta
  ).inplaceNormalize();
  generateTBN(N, TBN);
  TBN.transform(localSpaceDirection, direction);
  out.set(direction.x, direction.y, direction.z, importanceSample.pdf);
}

const V = new Vector3();
const N = new Vector3();
const H = new Vector3();
const L = new Vector3();
function lut(NdotV: number, roughness: number, numSamples: number, out: Vector4) {
  V.set(Math.sqrt(1 - NdotV * NdotV), 0, NdotV);
  N.set(0, 0, 1);
  const A = 0;
  const B = 0;
  let C = 0;
  const importanceSample = new Vector4();
  for (let i = 0; i < numSamples; i++) {
    getImportanceSample(i, numSamples, N, roughness, importanceSample);
    H.set(importanceSample.x, importanceSample.y, importanceSample.z);
    // do reflect L = normalize(reflect(-V, H)) = normalize(-V - 2.0 * dot(H, -V) * H) = normalize(2 * dot(H, V) * H - V)
    Vector3.scale(H, Vector3.dot(V, H) * 2, L).subBy(V).inplaceNormalize();
    const NdotL = Math.min(Math.max(L.z, 0), 1);
    const NdotH = Math.min(Math.max(H.z, 0), 1);
    const VdotH = Math.min(Math.max(Vector3.dot(V, H), 0), 1);
    if (NdotL > 0) {
      const sheenDistribution = distributionCharlie(NdotH, roughness);
      const sheenVisibility = visibilityAshikhmin(NdotV, NdotL);
      // const sheenVisibility = visibilityCharlie(NdotV, NdotL, roughness);
      C += sheenVisibility * sheenDistribution * NdotL * VdotH;
    }
  }
  out.set(4 * A, 4 * B, 4 * 2 * Math.PI * C, 0).scaleBy(1 / numSamples);
}

function dfvCharlieUniform(NdotV: number, roughness: number, numSamples: number): number {
  let r = 0;
  const V = new Vector3(Math.sqrt(1 - NdotV * NdotV), 0, NdotV);
  const u = new Vector2();
  const H = new Vector3();
  const L = new Vector3();
  for (let i = 0; i < numSamples; i++) {
    hammersley(i, 1 / numSamples, u);
    hemisphereUniformSample(u, H);
    Vector3.scale(H, Vector3.dot(V, H) * 2, L).subBy(V);
    const VdotH = Math.min(Math.max(Vector3.dot(V, H), 0), 1);
    const NdotL = Math.min(Math.max(L.z, 0), 1);
    const NdotH = Math.min(Math.max(H.z, 0), 1);
    if (NdotL > 0) {
      const v = visibilityAshikhmin(NdotV, NdotL);
      // const v = visibilityCharlie(NdotV, NdotL, roughness);
      const d = distributionCharlie(NdotH, roughness);
      r += v * d * NdotL * VdotH;
    }
  }
  return r * (4 * 2 * Math.PI / numSamples);
}

export function createSheenLUT(device: Device, textureSize: number): Texture2D {
  const tex = device.createTexture2D(TextureFormat.RGBA8UNORM, textureSize, textureSize, GPUResourceUsageFlags.TF_LINEAR_COLOR_SPACE);
  const image = new Uint8Array(textureSize * textureSize * 4);
  let p = 0;
  const c = new Vector4();
  for (let y = 0; y < textureSize; y++) {
    const coord = Math.min(Math.max((y + 0.5) / textureSize, 0), 1);
    const roughness = coord;
    for (let x = 0; x < textureSize; x++) {
      const NdotV = Math.min(Math.max((x + 0.5) / textureSize, 0), 1);
      // const c = dfvCharlieUniform(NdotV, roughness, 1024);
      // const c = Math.min(Math.max(Math.round(t * 255), 0), 255);
      lut(NdotV, roughness, 1024, c);
      image[p++] = Math.min(Math.max(Math.round(c.z * 255), 0), 255);
      image[p++] = Math.min(Math.max(Math.round(c.z * 255), 0), 255);
      image[p++] = Math.min(Math.max(Math.round(c.z * 255), 0), 255);
      image[p++] = 255;
    }
  }
  tex.update(image, 0, 0, textureSize, textureSize);
  return tex;
}
