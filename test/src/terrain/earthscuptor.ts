import * as chaos from 'balloon-device';

declare global {
  interface Window {
    PngToy: any;
  }
}

async function loadPng(url: string): Promise<{
  width: number,
  height: number,
  bitmap: Uint8Array | Uint16Array,
}> {
  const pngtoy = new window.PngToy();
  await pngtoy.fetch(url);
  return await pngtoy.decode();
}

export async function loadEarthSculptorMap(scene: chaos.Scene, mapUrl: string): Promise<chaos.Terrain> {
  const assetManager = new chaos.AssetManager(scene.device);
  const map = await assetManager.fetchTextData(mapUrl);
  const baseUrl = mapUrl.slice(0, mapUrl.lastIndexOf('/'));
  const options: { [name: string]: string[] } = {};
  map.split(/\r?\n/).forEach(opt => {
    const entry = opt.trim();
    if (entry) {
      const parts: string[] = [];
      let mark = false;
      let s = '';
      for (let i = 0; i < entry.length; i++) {
        if (entry[i] === ' ') {
          if (mark) {
            s += entry[i];
          } else if (s) {
            parts.push(s);
            s = '';
          }
        } else if (entry[i] === '"') {
          mark = !mark;
        } else {
          s += entry[i];
        }
      }
      if (s) {
        parts.push(s);
      }
      const name = parts[0].toLowerCase();
      options[name] = parts.slice(1);
      for (let i = 0; i < options[name].length; i++) {
        const val = options[name][i];
        if (val[0] === '"' && val[val.length - 1] === '"') {
          options[name][i] = val.slice(1, -1);
        }
      }
    }
  });
  console.log(options);

  const mapName = options.mapname[0];
  const heightScale = Number(options.mapheight[0]);
  const heightMap = `${baseUrl}/${mapName}.png`;
  const maskMap = options.tiletexturesize ? `${baseUrl}/${mapName}_d0.png` : `${baseUrl}/${mapName}_d.png`;
  const baseMap = options.tiletexturesize ? `${baseUrl}/${mapName}_c0.png` : `${baseUrl}/${mapName}_c.png`;
  const detailScales = options.detailscales.map(val => Number(val));
  const detailMaps: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const tex = options[`detailtexture${i}`][0].replace(/\\/g, '/');
    detailMaps.push(`${baseUrl}/${tex.slice(tex.lastIndexOf('/') + 1)}`);
  }
  const heightInfo = await loadPng(heightMap);
  const sizeX = heightInfo.width;
  const sizeZ = heightInfo.height;
  const heightValues = heightInfo.bitmap;
  const heights = new Float32Array(sizeX * sizeZ);
  for (let i = 0; i < sizeX * sizeZ; i++) {
    const h = ((heightValues[i] & 0xff) << 8) | ((heightValues[i] & 0xff00) >>> 8);
    heights[i] = h / 65535 * heightScale;
  }
  const terrain = new chaos.Terrain(scene);
  terrain.create(sizeX, sizeZ, heights, new chaos.Vector3(1, 1, 1), 33);
  terrain.maxPixelError = 6;
  terrain.material.baseMap = await assetManager.fetchTexture(baseMap, null, true);
  terrain.material.detailMaskMap = await assetManager.fetchTexture(maskMap, null, false);
  for (let i = 0; i < 4; i++) {
    const scaleX = sizeX / detailScales[i];
    const scaleZ = sizeZ / detailScales[i];
    terrain.material.addDetailMap(await assetManager.fetchTexture(detailMaps[i]), new chaos.Vector2(scaleX, scaleZ));
  }
  return terrain;
}
