/* eslint-disable @typescript-eslint/no-explicit-any */
export type Constructor<T = any> = T extends Int8Array ? Int8ArrayConstructor
  : T extends Uint8Array ? Uint8ArrayConstructor
  : T extends Uint8ClampedArray ? Uint8ClampedArrayConstructor
  : T extends Int16Array ? Int16ArrayConstructor
  : T extends Uint16Array ? Uint16ArrayConstructor
  : T extends Int32Array ? Int32ArrayConstructor
  : T extends Uint32Array ? Uint32ArrayConstructor
  : T extends BigInt64Array ? BigInt64ArrayConstructor
  : T extends BigUint64Array ? BigUint64ArrayConstructor
  : T extends Float32Array ? Float32ArrayConstructor
  : T extends Float64Array ? Float64ArrayConstructor
  : GenConstructor<T>;

export interface GenConstructor<T> {
  new (...args: any[]): T;
}

export function superClassOf(cls: Constructor) {
  return Object.getPrototypeOf(cls.prototype).constructor;
}

export function zip<K = string>(keys: string[], values: K[]): {[k: string]: K} {
  const ret: {[k: string]: K} = {};
  const len = keys.length;
  for (let i = 0; i < len; i++) {
    ret[keys[i]] = values[i];
  }
  return ret;
}

export function flipKV(obj: {[k: string]: string}): {[k: string]: string} {
  return zip(Object.values(obj), Object.keys(obj));
}

// base64 to array
// reference:
// https://github.com/danguer/blog-examples/blob/master/js/base64-binary.js
// http://blog.danguer.com/2011/10/24/base64-binary-decoding-in-javascript/

const _keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function removePaddingChars(input: string) {
  const lkey = _keyStr.indexOf(input.charAt(input.length - 1));
  if (lkey == 64) {
    return input.substring(0, input.length - 1);
  }
  return input;
}

export function base64ToU8(input: string) {
  //get last chars to see if are valid
  input = removePaddingChars(input);
  input = removePaddingChars(input);

  const bytes = Math.floor((input.length / 4) * 3);
  const uarray = new Uint8Array(bytes);
  let j = 0;

  input = input.replace(/[^A-Za-z0-9+/=]/g, '');
  for (let i = 0; i < bytes; i += 3) {
    //get the 3 octects in 4 ascii chars
    const enc1 = _keyStr.indexOf(input.charAt(j++));
    const enc2 = _keyStr.indexOf(input.charAt(j++));
    const enc3 = _keyStr.indexOf(input.charAt(j++));
    const enc4 = _keyStr.indexOf(input.charAt(j++));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    uarray[i] = chr1;
    if (enc3 != 64) uarray[i + 1] = chr2;
    if (enc4 != 64) uarray[i + 2] = chr3;
  }

  return uarray;
}

export function stringToU8(s: string) {
  const escstr = encodeURIComponent(s);
  const binstr = escstr.replace(/%([0-9A-F]{2})/g, function (match, p1) {
    return String.fromCharCode(Number('0x' + p1));
  });
  const ua = new Uint8Array(binstr.length);
  Array.prototype.forEach.call(binstr, function (ch, i) {
    ua[i] = ch.charCodeAt(0);
  });
  return ua;
}

export function u8ToString(ua: Uint8Array) {
  const binstr = Array.prototype.map
    .call(ua, function (ch) {
      return String.fromCharCode(ch);
    })
    .join('');
  const escstr = binstr.replace(/(.)/g, function (m, p) {
    let code = p.charCodeAt(p).toString(16).toUpperCase();
    if (code.length < 2) {
      code = '0' + code;
    }
    return '%' + code;
  });
  return decodeURIComponent(escstr);
}

export function assert(expr: boolean, message?: string, fatal?: boolean) {
  if (!expr) {
    const msg = `Assertion failed: ${message}`;
    console.log(msg);
    if (fatal) {
      throw new Error(msg);
    }
  }
  return expr;
}
