/**
 * WBI request signing.
 *
 * Derives a mixin key from two image-based keys, appends a Unix timestamp,
 * sorts parameters, strips special characters, and produces an MD5 w_rid hash.
 *
 * Usage:
 *   const keys = extractWbiKeys(navResponse.wbi_img);
 *   const signed = signWbi({ mid: 123 }, keys.imgKey, keys.subKey);
 */

// Permutation table for mixin key derivation
const ENC_TAB = [
  46, 47, 18, 2,  53, 8,  23, 32, 15, 50, 10, 31, 58, 3,  45, 35,
  27, 43, 5,  49, 33, 9,  42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7,  16, 24, 55, 40, 61, 26, 17, 0,  1,  60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6,  63, 57, 62, 11, 36, 20, 34, 44, 52,
];

export function getMixinKey(imgKey: string, subKey: string): string {
  const raw = imgKey + subKey;
  return ENC_TAB.slice(0, 32).map((i) => raw[i]).join('');
}

// ─── MD5 (no external dependencies) ──────────────────────────────────────────

function safeAdd(x: number, y: number): number {
  const lsw = (x & 0xffff) + (y & 0xffff);
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xffff);
}

function rotL(n: number, s: number): number {
  return (n << s) | (n >>> (32 - s));
}

function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
  return safeAdd(rotL(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}

const ff = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
  cmn((b & c) | (~b & d), a, b, x, s, t);
const gg = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
  cmn((b & d) | (c & ~d), a, b, x, s, t);
const hh = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
  cmn(b ^ c ^ d, a, b, x, s, t);
const ii = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
  cmn(c ^ (b | ~d), a, b, x, s, t);

function blocks(s: string): number[] {
  const l = s.length;
  const b: number[] = new Array(((l + 8 >> 6) + 1) * 16).fill(0);
  for (let i = 0; i < l; i++) b[i >> 2] |= s.charCodeAt(i) << ((i % 4) * 8);
  b[l >> 2] |= 0x80 << ((l % 4) * 8);
  b[b.length - 2] = l * 8;
  return b;
}

function hexWord(n: number): string {
  const h = '0123456789abcdef';
  let s = '';
  for (let j = 0; j < 4; j++) s += h[(n >> (j * 8 + 4)) & 0x0f] + h[(n >> (j * 8)) & 0x0f];
  return s;
}

export function md5(s: string): string {
  const x = blocks(s);
  let [a, b, c, d] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];

  for (let i = 0; i < x.length; i += 16) {
    const [aa, bb, cc, dd] = [a, b, c, d];

    a = ff(a,b,c,d, x[i],    7, -680876936);   b = ff(d,a,b,c, x[i+1],  12, -389564586);
    c = ff(c,d,a,b, x[i+2],  17,  606105819);   d = ff(b,c,d,a, x[i+3],  22, -1044525330);
    a = ff(a,b,c,d, x[i+4],   7, -176418897);   b = ff(d,a,b,c, x[i+5],  12,  1200080426);
    c = ff(c,d,a,b, x[i+6],  17, -1473231341);  d = ff(b,c,d,a, x[i+7],  22, -45705983);
    a = ff(a,b,c,d, x[i+8],   7,  1770035416);  b = ff(d,a,b,c, x[i+9],  12, -1958414417);
    c = ff(c,d,a,b, x[i+10], 17, -42063);        d = ff(b,c,d,a, x[i+11], 22, -1990404162);
    a = ff(a,b,c,d, x[i+12],  7,  1804603682);  b = ff(d,a,b,c, x[i+13], 12, -40341101);
    c = ff(c,d,a,b, x[i+14], 17, -1502002290);  d = ff(b,c,d,a, x[i+15], 22,  1236535329);

    a = gg(a,b,c,d, x[i+1],   5, -165796510);   b = gg(d,a,b,c, x[i+6],   9, -1069501632);
    c = gg(c,d,a,b, x[i+11], 14,  643717713);   d = gg(b,c,d,a, x[i],    20, -373897302);
    a = gg(a,b,c,d, x[i+5],   5, -701558691);   b = gg(d,a,b,c, x[i+10],  9,  38016083);
    c = gg(c,d,a,b, x[i+15], 14, -660478335);   d = gg(b,c,d,a, x[i+4],  20, -405537848);
    a = gg(a,b,c,d, x[i+9],   5,  568446438);   b = gg(d,a,b,c, x[i+14],  9, -1019803690);
    c = gg(c,d,a,b, x[i+3],  14, -187363961);   d = gg(b,c,d,a, x[i+8],  20,  1163531501);
    a = gg(a,b,c,d, x[i+13],  5, -1444681467);  b = gg(d,a,b,c, x[i+2],   9, -51403784);
    c = gg(c,d,a,b, x[i+7],  14,  1735328473);  d = gg(b,c,d,a, x[i+12], 20, -1926607734);

    a = hh(a,b,c,d, x[i+5],   4, -378558);      b = hh(d,a,b,c, x[i+8],  11, -2022574463);
    c = hh(c,d,a,b, x[i+11], 16,  1839030562);  d = hh(b,c,d,a, x[i+14], 23, -35309556);
    a = hh(a,b,c,d, x[i+1],   4, -1530992060);  b = hh(d,a,b,c, x[i+4],  11,  1272893353);
    c = hh(c,d,a,b, x[i+7],  16, -155497632);   d = hh(b,c,d,a, x[i+10], 23, -1094730640);
    a = hh(a,b,c,d, x[i+13],  4,  681279174);   b = hh(d,a,b,c, x[i],    11, -358537222);
    c = hh(c,d,a,b, x[i+3],  16, -722521979);   d = hh(b,c,d,a, x[i+6],  23,  76029189);
    a = hh(a,b,c,d, x[i+9],   4, -640364487);   b = hh(d,a,b,c, x[i+12], 11, -421815835);
    c = hh(c,d,a,b, x[i+15], 16,  530742520);   d = hh(b,c,d,a, x[i+2],  23, -995338651);

    a = ii(a,b,c,d, x[i],     6, -198630844);   b = ii(d,a,b,c, x[i+7],  10,  1126891415);
    c = ii(c,d,a,b, x[i+14], 15, -1416354905);  d = ii(b,c,d,a, x[i+5],  21, -57434055);
    a = ii(a,b,c,d, x[i+12],  6,  1700485571);  b = ii(d,a,b,c, x[i+3],  10, -1894986606);
    c = ii(c,d,a,b, x[i+10], 15, -1051523);      d = ii(b,c,d,a, x[i+1],  21, -2054922799);
    a = ii(a,b,c,d, x[i+8],   6,  1873313359);  b = ii(d,a,b,c, x[i+15], 10, -30611744);
    c = ii(c,d,a,b, x[i+6],  15, -1560198380);  d = ii(b,c,d,a, x[i+13], 21,  1309151649);
    a = ii(a,b,c,d, x[i+4],   6, -145523070);   b = ii(d,a,b,c, x[i+11], 10, -1120210379);
    c = ii(c,d,a,b, x[i+2],  15,  718787259);   d = ii(b,c,d,a, x[i+9],  21, -343485551);

    a = safeAdd(a, aa); b = safeAdd(b, bb);
    c = safeAdd(c, cc); d = safeAdd(d, dd);
  }
  return hexWord(a) + hexWord(b) + hexWord(c) + hexWord(d);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface WbiKeys {
  imgKey: string;
  subKey: string;
}

/**
 * Sign a parameter map. Returns a new object with `wts` and `w_rid` appended.
 */
export function signWbi(
  params: Record<string, string | number>,
  imgKey: string,
  subKey: string,
): Record<string, string> {
  const mixinKey = getMixinKey(imgKey, subKey);
  const wts = Math.floor(Date.now() / 1000).toString();

  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) raw[k] = String(v);
  raw['wts'] = wts;

  const sorted = Object.keys(raw)
    .sort()
    .reduce<Record<string, string>>((acc, k) => {
      acc[k] = raw[k].replace(/[!'()*]/g, '');
      return acc;
    }, {});

  const query = Object.entries(sorted)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  sorted['w_rid'] = md5(query + mixinKey);
  return sorted;
}

/**
 * Extract WBI keys from the `wbi_img` field of the nav API response.
 */
export function extractWbiKeys(wbiImg: { img_url: string; sub_url: string }): WbiKeys {
  const imgKey = wbiImg.img_url.split('/').pop()!.replace(/\.\w+$/, '');
  const subKey = wbiImg.sub_url.split('/').pop()!.replace(/\.\w+$/, '');
  return { imgKey, subKey };
}
