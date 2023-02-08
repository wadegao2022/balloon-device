import {FileLoader} from '../../../../../shared';
import {TextureFormat, TextureMipmapLevelData, TextureMipmapData} from '../../../../device';
import type {TypedArray} from '../../../../defs';

const DDSHeaderSize = 31; // in DWORD
const DDSHeaderSizeExtended = 31 + 5; // in DWORD

const DDS_MAGIC = 0x20534444; // magic

const DDSD_CAPS = 0x1; // required
const DDSD_HEIGHT = 0x2; // required
const DDSD_WIDTH = 0x4; // required
const DDSD_PITCH = 0x8; // optional
const DDSD_PIXELFORMAT = 0x1000; // required
const DDSD_MIPMAPCOUNT = 0x20000; // optional
const DDSD_LINEARSIZE = 0x80000; // optional
const DDSD_DEPTH = 0x800000; // optional

const DDPF_ALPHAPIXELS = 0x1;
const DDPF_ALPHA = 0x2;
const DDPF_PAL8 = 0x20;
const DDPF_FOURCC = 0x4;
const DDPF_RGB = 0x40;
const DDPF_YUV = 0x200;
const DDPF_LUMINANCE = 0x20000;
const DDPF_BUMPDUDV = 0x80000;

const DDSCAPS_COMPLEX = 0x8; // optional
const DDSCAPS_MIPMAP = 0x400000; // optional
const DDSCAPS_TEXTURE = 0x1000; // required

const DDSCAPS2_CUBEMAP = 0x200;
const DDSCAPS2_CUBEMAP_POSITIVEX = 0x400;
const DDSCAPS2_CUBEMAP_NEGATIVEX = 0x800;
const DDSCAPS2_CUBEMAP_POSITIVEY = 0x1000;
const DDSCAPS2_CUBEMAP_NEGATIVEY = 0x2000;
const DDSCAPS2_CUBEMAP_POSITIVEZ = 0x4000;
const DDSCAPS2_CUBEMAP_NEGATIVEZ = 0x8000;
const DDS_CUBEMAP_ALLFACES =
  DDSCAPS2_CUBEMAP |
  DDSCAPS2_CUBEMAP_POSITIVEX |
  DDSCAPS2_CUBEMAP_NEGATIVEX |
  DDSCAPS2_CUBEMAP_POSITIVEY |
  DDSCAPS2_CUBEMAP_NEGATIVEY |
  DDSCAPS2_CUBEMAP_POSITIVEZ |
  DDSCAPS2_CUBEMAP_NEGATIVEZ;

const DDSCAPS2_VOLUME = 0x200000;

function getDimensionName(dimension: number) {
  return DX10ResourceDimension[dimension] || String(dimension);
}

enum DX10ResourceDimension {
  DDS_DIMENSION_TEXTURE1D = 2,
  DDS_DIMENSION_TEXTURE2D = 3,
  DDS_DIMENSION_TEXTURE3D = 4,
}

function getDXGIFormatName(fmt: number) {
  return DXGIFormat[fmt] || String(fmt);
}

enum DXGIFormat {
  DXGI_FORMAT_RGBA32F = 2,
  DXGI_FORMAT_RGBA32UI = 3,
  DXGI_FORMAT_RGBA32I = 4,
  DXGI_FORMAT_RGB32F = 6,
  DXGI_FORMAT_RGB32UI = 7,
  DXGI_FORMAT_RGB32I = 8,
  DXGI_FORMAT_RGBA16F = 10,
  DXGI_FORMAT_RGBA16UI = 12,
  DXGI_FORMAT_RGBA16I = 14,
  DXGI_FORMAT_RG32F = 16,
  DXGI_FORMAT_RG32UI = 17,
  DXGI_FORMAT_RG32I = 18,
  DXGI_FORMAT_RGBA8 = 28,
  DXGI_FORMAT_RGBA8_SRGB = 29,
  DXGI_FORMAT_RGBA8UI = 30,
  DXGI_FORMAT_RGBA8I = 32,
  DXGI_FORMAT_RG16F = 34,
  DXGI_FORMAT_RG16UI = 36,
  DXGI_FORMAT_RG16I = 38,
  DXGI_FORMAT_R32F = 41,
  DXGI_FORMAT_R32UI = 42,
  DXGI_FORMAT_R32I = 43,
  DXGI_FORMAT_R16F = 54,
  DXGI_FORMAT_R16UI = 57,
  DXGI_FORMAT_R16I = 59,
  DXGI_FORMAT_BGR565 = 85,
  DXGI_FORMAT_BGRA5551 = 86,
  DXGI_FORMAT_BGRA8 = 87,
  DXGI_FORMAT_BGRX8 = 88,
  DXGI_FORMAT_BGRA8_SRGB = 91,
  DXGI_FORMAT_BGRX8_SRGB = 93,
}

enum D3DFormat {
  D3DFMT_RGB8 = 20,
  D3DFMT_ARGB8 = 21,
  D3DFMT_XRGB8 = 22,
  D3DFMT_RGB565 = 23,
  D3DFMT_XRGB1555 = 24,
  D3DFMT_ARGB1555 = 25,
  D3DFMT_ARGB4 = 26,
  D3DFMT_A8 = 28,
  D3DFMT_XRGB4 = 30,
  D3DFMT_ABGR8 = 32,
  D3DFMT_XBGR8 = 33,
  D3DFMT_A8P8 = 40,
  D3DFMT_P8 = 41,
  D3DFMT_L8 = 50,
  D3DFMT_A8L8 = 51,
  D3DFMT_DXT1 = FourCCToInt32('DXT1'),
  D3DFMT_DXT2 = FourCCToInt32('DXT2'),
  D3DFMT_DXT3 = FourCCToInt32('DXT3'),
  D3DFMT_DXT4 = FourCCToInt32('DXT4'),
  D3DFMT_DXT5 = FourCCToInt32('DXT5'),
  D3DFMT_R16F = 111,
  D3DFMT_RG16F = 112,
  D3DFMT_RGBA16F = 113,
  D3DFMT_R32F = 114,
  D3DFMT_RG32F = 115,
  D3DFMT_RGBA32F = 116,
}

function FourCCToInt32(value: string) {
  return (
    value.charCodeAt(0) +
    (value.charCodeAt(1) << 8) +
    (value.charCodeAt(2) << 16) +
    (value.charCodeAt(3) << 24)
  );
}

function Int32ToFourCC(value: number) {
  return String.fromCharCode(
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >> 24) & 0xff,
  );
}

function getPixelFormatDesc(header: DDSHeader) {
  let desc = '';
  const flags: string[] = [];
  const pf = header.ddsPixelFormat;
  if (pf.dwFlags & DDPF_ALPHAPIXELS) {
    flags.push('AlphaPixels');
  }
  if (pf.dwFlags & DDPF_ALPHA) {
    flags.push('Alpha');
  }
  if (pf.dwFlags & DDPF_FOURCC) {
    flags.push('FourCC');
  }
  if (pf.dwFlags & DDPF_LUMINANCE) {
    flags.push('Luminance');
  }
  if (pf.dwFlags & DDPF_RGB) {
    flags.push('RGB');
  }
  if (pf.dwFlags & DDPF_YUV) {
    flags.push('YUV');
  }
  if (pf.dwFlags & DDPF_PAL8) {
    flags.push('Pal8');
  }
  if (pf.dwFlags & DDPF_BUMPDUDV) {
    flags.push('BumpDuDv');
  }
  desc += `Flags: ${flags.join('|')}\n`;
  if (pf.dwFlags & DDPF_FOURCC) {
    if (!header.ddsHeaderDX10) {
      const fmt = D3DFormat[pf.dwFourCC] || String(pf.dwFourCC);
      desc += `FourCC: ${fmt}`;
    }
  }
  if (header.ddsHeaderDX10) {
    desc += `DXGIFormat: ${getDXGIFormatName(header.ddsHeaderDX10.dxgiFormat)}\n`;
    desc += `Dimension: ${getDimensionName(header.ddsHeaderDX10.dimension)}\n`;
    desc += `ArraySize: ${header.ddsHeaderDX10.arraySize}\n`;
    desc += `DXGIMiscFlag: ${header.ddsHeaderDX10.miscFlag}\n`;
  }
  if (pf.dwFlags & (DDPF_RGB | DDPF_ALPHAPIXELS | DDPF_ALPHA | DDPF_LUMINANCE)) {
    desc += `RGBBitCount: ${pf.dwRGBBitCount}\n`;
    desc += `RBitMask: 0x${pf.dwRBitMask.toString(16)}\n`;
    desc += `GBitMask: 0x${pf.dwGBitMask.toString(16)}\n`;
    desc += `BBitMask: 0x${pf.dwBBitMask.toString(16)}\n`;
    desc += `ABitMask: 0x${pf.dwABitMask.toString(16)}\n`;
  }
  return desc;
}

interface DDSPixelFormat {
  dwFlags: number;
  dwFourCC?: number;
  dwRGBBitCount?: number;
  dwRBitMask?: number;
  dwGBitMask?: number;
  dwBBitMask?: number;
  dwABitMask?: number;
}

function getDDSHeaderDesc(header: DDSHeader) {
  let desc = '';
  const flags: string[] = [];
  if (header.dwFlags & DDSD_CAPS) {
    flags.push('Caps');
  }
  if (header.dwFlags & DDSD_HEIGHT) {
    flags.push('Height');
  }
  if (header.dwFlags & DDSD_WIDTH) {
    flags.push('Width');
  }
  if (header.dwFlags & DDSD_PITCH) {
    flags.push('Pitch');
  }
  if (header.dwFlags & DDSD_PIXELFORMAT) {
    flags.push('PixelFormat');
  }
  if (header.dwFlags & DDSD_MIPMAPCOUNT) {
    flags.push('MipmapCount');
  }
  if (header.dwFlags & DDSD_LINEARSIZE) {
    flags.push('LinearSize');
  }
  if (header.dwFlags & DDSD_DEPTH) {
    flags.push('Depth');
  }
  desc += `Flags: ${flags.join('|')}\n`;
  if (header.dwFlags & DDSD_WIDTH) {
    desc += `Width: ${header.dwWidth}\n`;
  }
  if (header.dwFlags & DDSD_HEIGHT) {
    desc += `Height: ${header.dwHeight}\n`;
  }
  if (header.dwFlags & DDSD_DEPTH) {
    desc += `Depth: ${header.dwDepth}\n`;
  }
  if (header.dwFlags & DDSD_PITCH) {
    desc += `Pitch: ${header.dwPitchOrLinearSize}\n`;
  }
  if (header.dwFlags & DDSD_LINEARSIZE) {
    desc += `LinearSize: ${header.dwPitchOrLinearSize}\n`;
  }
  if (header.dwFlags & DDSD_MIPMAPCOUNT) {
    desc += `MipmapCount: ${header.dwMipmapCount}\n`;
  }
  const caps: string[] = [];
  if (header.dwCaps & DDSCAPS_COMPLEX) {
    caps.push('Complex');
  }
  if (header.dwCaps & DDSCAPS_MIPMAP) {
    caps.push('Mipmap');
  }
  if (header.dwCaps & DDSCAPS_TEXTURE) {
    caps.push('Texture');
  }
  desc += `Caps: ${caps.join('|')}\n`;
  const caps2: string[] = [];
  if (header.dwCaps2 & DDSCAPS2_CUBEMAP) {
    caps2.push('CubeMap');
  }
  if (header.dwCaps2 & DDSCAPS2_CUBEMAP_POSITIVEX) {
    caps2.push('CubeFacePX');
  }
  if (header.dwCaps2 & DDSCAPS2_CUBEMAP_NEGATIVEX) {
    caps2.push('CubeFaceNX');
  }
  if (header.dwCaps2 & DDSCAPS2_CUBEMAP_POSITIVEY) {
    caps2.push('CubeFacePY');
  }
  if (header.dwCaps2 & DDSCAPS2_CUBEMAP_NEGATIVEY) {
    caps2.push('CubeFaceNY');
  }
  if (header.dwCaps2 & DDSCAPS2_CUBEMAP_POSITIVEZ) {
    caps2.push('CubeFacePZ');
  }
  if (header.dwCaps2 & DDSCAPS2_CUBEMAP_NEGATIVEZ) {
    caps2.push('CubeFaceNZ');
  }
  if (header.dwCaps2 & DDSCAPS2_VOLUME) {
    caps2.push('Volume');
  }
  desc += `Caps2: ${caps2.join('|')}\n`;
  if (header.dwFlags & DDSD_PIXELFORMAT) {
    desc += getPixelFormatDesc(header);
  }
  return desc;
}

interface DDSHeader {
  dwSize: number; // must be DDSHeaderSize * 4 = 124
  dwFlags: number;
  dwHeight: number;
  dwWidth: number;
  dwPitchOrLinearSize: number;
  dwDepth: number;
  dwMipmapCount: number;
  ddsPixelFormat: DDSPixelFormat;
  dwCaps: number;
  dwCaps2: number;
  dwCaps3: number;
  dwCaps4: number;
  ddsHeaderDX10: DDSHeaderDX10;
  dataOffset: number;
}

interface DDSHeaderDX10 {
  dxgiFormat: DXGIFormat;
  dimension: DX10ResourceDimension;
  miscFlag: number;
  arraySize: number;
}

export function loadDDSHeader(dds: ArrayBuffer): DDSHeader {
  const ddsHeader = {} as DDSHeader;
  const header = new Uint32Array(dds, 0, DDSHeaderSize + 1);
  const magic = header[0];
  if (magic !== DDS_MAGIC) {
    console.log('Invalid DDS magic');
    return null;
  }
  ddsHeader.dwSize = header[1];
  if (ddsHeader.dwSize !== 124) {
    console.log('Invalid DDS header size');
    return null;
  }
  ddsHeader.dataOffset = ddsHeader.dwSize + 4;
  ddsHeader.dwFlags = header[2];
  ddsHeader.dwHeight = header[3];
  ddsHeader.dwWidth = header[4];
  ddsHeader.dwPitchOrLinearSize = header[5];
  ddsHeader.dwDepth = header[6];
  ddsHeader.dwMipmapCount = header[7];
  ddsHeader.ddsPixelFormat = {} as DDSPixelFormat;
  ddsHeader.ddsPixelFormat.dwFlags = header[20];
  ddsHeader.ddsPixelFormat.dwFourCC = header[21];
  ddsHeader.ddsPixelFormat.dwRGBBitCount = header[22];
  ddsHeader.ddsPixelFormat.dwRBitMask = header[23];
  ddsHeader.ddsPixelFormat.dwGBitMask = header[24];
  ddsHeader.ddsPixelFormat.dwBBitMask = header[25];
  ddsHeader.ddsPixelFormat.dwABitMask = header[26];
  ddsHeader.dwCaps = header[27];
  ddsHeader.dwCaps2 = header[28];
  ddsHeader.dwCaps3 = header[29];
  ddsHeader.dwCaps4 = header[30];
  if (Int32ToFourCC(ddsHeader.ddsPixelFormat.dwFourCC) === 'DX10') {
    const headerEx = new Uint32Array(dds, 0, DDSHeaderSizeExtended + 1);
    ddsHeader.ddsHeaderDX10 = {} as DDSHeaderDX10;
    ddsHeader.ddsHeaderDX10.dxgiFormat = headerEx[32];
    ddsHeader.ddsPixelFormat.dwFourCC = ddsHeader.ddsHeaderDX10.dxgiFormat;
    ddsHeader.ddsHeaderDX10.dimension = headerEx[33];
    ddsHeader.ddsHeaderDX10.miscFlag = headerEx[34];
    ddsHeader.ddsHeaderDX10.arraySize = headerEx[35];
    ddsHeader.dataOffset += 5 * 4;
  }
  return ddsHeader;
}

interface DDSMetaData extends TextureMipmapData {
  dataOffset: number;
}

const enum DDSConvert {
  RGB_SWIZZLE = 1 << 0,
  ALPHA_ONE = 11 << 1,
}

const legacyDDSMap: {
  format: TextureFormat;
  convertFlags: number;
  pf: DDSPixelFormat;
}[] = [
  {
    format: TextureFormat.DXT1,
    convertFlags: 0,
    pf: {
      dwFlags: DDPF_FOURCC,
      dwFourCC: FourCCToInt32('DXT1'),
    },
  },
  {
    format: TextureFormat.DXT3,
    convertFlags: 0,
    pf: {
      dwFlags: DDPF_FOURCC,
      dwFourCC: FourCCToInt32('DXT3'),
    },
  },
  {
    format: TextureFormat.DXT5,
    convertFlags: 0,
    pf: {
      dwFlags: DDPF_FOURCC,
      dwFourCC: FourCCToInt32('DXT5'),
    },
  },
  {
    format: TextureFormat.BGRA8UNORM,
    convertFlags: DDSConvert.RGB_SWIZZLE,
    pf: {
      dwFlags: DDPF_RGB | DDPF_ALPHAPIXELS,
      dwRGBBitCount: 32,
      dwRBitMask: 0x00ff0000,
      dwGBitMask: 0x0000ff00,
      dwBBitMask: 0x000000ff,
      dwABitMask: 0xff000000,
    },
  },
  {
    format: TextureFormat.BGRA8UNORM,
    convertFlags: DDSConvert.RGB_SWIZZLE | DDSConvert.ALPHA_ONE,
    pf: {
      dwFlags: DDPF_RGB,
      dwRGBBitCount: 32,
      dwRBitMask: 0x00ff0000,
      dwGBitMask: 0x0000ff00,
      dwBBitMask: 0x000000ff,
    },
  },
  {
    format: TextureFormat.RGBA8UNORM,
    convertFlags: 0,
    pf: {
      dwFlags: DDPF_RGB | DDPF_ALPHAPIXELS,
      dwRGBBitCount: 32,
      dwRBitMask: 0x000000ff,
      dwGBitMask: 0x0000ff00,
      dwBBitMask: 0x00ff0000,
      dwABitMask: 0xff000000,
    },
  },
  {
    format: TextureFormat.RGBA8UNORM,
    convertFlags: DDSConvert.ALPHA_ONE,
    pf: {
      dwFlags: DDPF_RGB,
      dwRGBBitCount: 32,
      dwRBitMask: 0x000000ff,
      dwGBitMask: 0x0000ff00,
      dwBBitMask: 0x00ff0000,
    },
  },
  {
    format: TextureFormat.R16F,
    convertFlags: 0,
    pf: {
      dwFlags: DDPF_FOURCC,
      dwFourCC: 111,
    },
  },
  {
    format: TextureFormat.R16F,
    convertFlags: 0,
    pf: {
      dwFlags: DDPF_FOURCC,
      dwFourCC: DXGIFormat.DXGI_FORMAT_R16F,
    },
  },
  {
    format: TextureFormat.RG16F,
    convertFlags: 0,
    pf: {
      dwFlags: DDPF_FOURCC,
      dwFourCC: 112,
    },
  },
  {
    format: TextureFormat.RG16F,
    convertFlags: 0,
    pf: {
      dwFlags: DDPF_FOURCC,
      dwFourCC: DXGIFormat.DXGI_FORMAT_RG16F,
    },
  },
  {
    format: TextureFormat.RGBA16F,
    convertFlags: 0,
    pf: {
      dwFlags: DDPF_FOURCC,
      dwFourCC: 113,
    },
  },
  {
    format: TextureFormat.RGBA16F,
    convertFlags: 0,
    pf: {
      dwFlags: DDPF_FOURCC,
      dwFourCC: DXGIFormat.DXGI_FORMAT_RGBA16F,
    },
  },
  {
    format: TextureFormat.R32F,
    convertFlags: 0,
    pf: {
      dwFlags: DDPF_FOURCC,
      dwFourCC: 114,
    },
  },
  {
    format: TextureFormat.R32F,
    convertFlags: 0,
    pf: {
      dwFlags: DDPF_FOURCC,
      dwFourCC: DXGIFormat.DXGI_FORMAT_R32F,
    },
  },
  {
    format: TextureFormat.RG32F,
    convertFlags: 0,
    pf: {
      dwFlags: DDPF_FOURCC,
      dwFourCC: 115,
    },
  },
  {
    format: TextureFormat.RG32F,
    convertFlags: 0,
    pf: {
      dwFlags: DDPF_FOURCC,
      dwFourCC: DXGIFormat.DXGI_FORMAT_RG32F,
    },
  },
  {
    format: TextureFormat.RGBA32F,
    convertFlags: 0,
    pf: {
      dwFlags: DDPF_FOURCC,
      dwFourCC: 116,
    },
  },
  {
    format: TextureFormat.RGBA32F,
    convertFlags: 0,
    pf: {
      dwFlags: DDPF_FOURCC,
      dwFourCC: DXGIFormat.DXGI_FORMAT_RGBA32F,
    },
  },
];

function getTextureFormat(pf: DDSPixelFormat) {
  const flags = pf.dwFlags;
  let index;
  for (index = 0; index < legacyDDSMap.length; index++) {
    const entry = legacyDDSMap[index];
    if (flags & DDPF_FOURCC && entry.pf.dwFlags & DDPF_FOURCC) {
      if (pf.dwFourCC === entry.pf.dwFourCC) {
        break;
      }
    } else if (flags === entry.pf.dwFlags) {
      if (flags & DDPF_ALPHA) {
        if (pf.dwRGBBitCount === entry.pf.dwRGBBitCount && pf.dwABitMask === entry.pf.dwABitMask) {
          break;
        }
      } else if (flags & DDPF_LUMINANCE) {
        if (pf.dwRGBBitCount === entry.pf.dwRGBBitCount && pf.dwRBitMask === entry.pf.dwRBitMask) {
          if (pf.dwABitMask === entry.pf.dwABitMask || !(flags & DDPF_ALPHAPIXELS)) {
            break;
          }
        }
      } else if (pf.dwRGBBitCount === entry.pf.dwRGBBitCount) {
        if (
          pf.dwRBitMask === entry.pf.dwRBitMask &&
          pf.dwGBitMask === entry.pf.dwGBitMask &&
          pf.dwBBitMask === entry.pf.dwBBitMask
        ) {
          if (pf.dwABitMask === entry.pf.dwABitMask || !(flags & DDPF_ALPHAPIXELS)) {
            break;
          }
        }
      }
    }
  }
  if (index === legacyDDSMap.length) {
    return null;
  }
  return legacyDDSMap[index].format;
}

function getMetaDataFromHeader(header: DDSHeader, metaData?: DDSMetaData): DDSMetaData {
  metaData = metaData || ({} as DDSMetaData);
  metaData.format = getTextureFormat(header.ddsPixelFormat);
  if (metaData.format === null) {
    return null;
  }
  metaData.isCompressed =
    metaData.format === TextureFormat.DXT1 ||
    metaData.format === TextureFormat.DXT3 ||
    metaData.format === TextureFormat.DXT5;
  metaData.dataOffset = header.ddsHeaderDX10 ? 37 * 4 : 32 * 4;
  metaData.width = header.dwWidth;
  metaData.height = header.dwHeight;
  metaData.depth = 1;
  metaData.mipLevels = header.dwMipmapCount || 1;
  metaData.arraySize = header.ddsHeaderDX10 ? header.ddsHeaderDX10.arraySize : 1;
  metaData.isCubemap = metaData.isVolume = false;
  if (header.dwCaps2 & DDS_CUBEMAP_ALLFACES) {
    metaData.isCubemap = true;
    metaData.arraySize *= 6;
  } else if (header.dwCaps2 & DDSCAPS2_VOLUME) {
    metaData.isVolume = true;
    metaData.depth = header.dwDepth;
  }
  return metaData;
}

function getMipmapData(
  dds: ArrayBuffer,
  width: number,
  height: number,
  format: TextureFormat,
  dataOffset: number,
): TypedArray {
  switch (format) {
    case TextureFormat.R16F:
      return new Uint16Array(dds, dataOffset, width * height);
    case TextureFormat.RG16F:
      return new Uint16Array(dds, dataOffset, width * height * 2);
    case TextureFormat.R32F:
      return new Float32Array(dds, dataOffset, width * height);
    case TextureFormat.RGBA8UNORM:
    case TextureFormat.BGRA8UNORM:
      return new Uint8Array(dds, dataOffset, width * height * 4);
    case TextureFormat.RGBA16F:
      return new Uint16Array(dds, dataOffset, width * height * 4);
    case TextureFormat.RG32F:
      return new Float32Array(dds, dataOffset, width * height * 2);
    case TextureFormat.RGBA32F:
      return new Float32Array(dds, dataOffset, width * height * 4);
    case TextureFormat.DXT1:
      return new Uint8Array(
        dds,
        dataOffset,
        (((Math.max(4, width) / 4) * Math.max(4, height)) / 4) * 8,
      );
    case TextureFormat.DXT3:
    case TextureFormat.DXT5:
      return new Uint8Array(
        dds,
        dataOffset,
        (((Math.max(4, width) / 4) * Math.max(4, height)) / 4) * 16,
      );
    default:
      return null;
  }
}

export function getDDSMipLevelsInfo(dds: ArrayBuffer): DDSMetaData {
  const ddsHeader = loadDDSHeader(dds);
  if (!ddsHeader) {
    return null;
  }
  const ddsLevelsInfo = {} as DDSMetaData;
  getMetaDataFromHeader(ddsHeader, ddsLevelsInfo);
  ddsLevelsInfo.mipDatas = [];
  let dataOffset = ddsLevelsInfo.dataOffset;
  for (let i = 0; i < ddsLevelsInfo.arraySize; i++) {
    const mipDatas: TextureMipmapLevelData[] = [];
    let width = ddsLevelsInfo.width;
    let height = ddsLevelsInfo.height;
    for (let mip = 0; mip < ddsLevelsInfo.mipLevels; mip++) {
      const mipData = getMipmapData(dds, width, height, ddsLevelsInfo.format, dataOffset);
      mipDatas.push({data: mipData, width: width, height: height});
      dataOffset += mipData.byteLength;
      width = Math.max(1, width >> 1);
      height = Math.max(1, height >> 1);
    }
    ddsLevelsInfo.mipDatas.push(mipDatas);
  }
  return ddsLevelsInfo;
}

export async function dumpDDS(ddsFile: string) {
  const content = (await new FileLoader(null, 'arraybuffer').load(ddsFile)) as ArrayBuffer;
  if (!content) {
    console.log(`Error reading file ${ddsFile}`);
    return null;
  }
  const ddsHeader = loadDDSHeader(content);
  if (!ddsHeader) {
    console.log(`Invalid DDS file ${ddsFile}`);
    return null;
  }
  const desc = getDDSHeaderDesc(ddsHeader);
  console.log(desc);

  const metaData = getMetaDataFromHeader(ddsHeader);
  console.log(metaData);

  return ddsHeader;
}
