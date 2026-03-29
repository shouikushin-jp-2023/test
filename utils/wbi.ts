/**
 * WBI Signing – Bilibili's request authentication mechanism.
 *
 * Each signed API request requires:
 *   1. A "mixin key" derived by reordering the concatenated img+sub keys
 *      fetched from https://api.bilibili.com/x/web-interface/nav
 *   2. A current Unix timestamp (wts)
 *   3. Parameters sorted alphabetically, special chars stripped, then
 *      MD5-hashed together with the mixin key to produce w_rid
 *
 * Usage:
 *   const { imgKey, subKey } = await fetchWbiKeys(sessdata);
 *   const signed = signWbi({ mid: 123 }, imgKey, subKey);
 *   // signed = { mid: '123', wts: '...', w_rid: '...' }
 */

// ─── Mixin key permutation table ──────────────────────────────────────────────

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2,  53, 8,  23, 32, 15, 50, 10, 31, 58, 3,  45, 35,
  27, 43, 5,  49, 33, 9,  42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7,  16, 24, 55, 40, 61, 26, 17, 0,  1,  60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6,  63, 57, 62, 11, 36, 20, 34, 44, 52,
];

/** Derive the 32-char mixin key from imgKey + subKey */
export function getMixinKey(imgKey: string, subKey: string): string {
  const raw = imgKey + subKey;
  return MIXIN_KEY_ENC_TAB.slice(0, 32)
    .map((i) => raw[i])
    .join('');
}

// ─── Minimal MD5 (no external deps) ──────────────────────────────────────────

function safeAdd(x: number, y: number): number {
  const lsw = (x & 0xffff) + (y & 0xffff);
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xffff);
}

function bitRotateLeft(num: number, cnt: number): number {
  return (num << cnt) | (num >>> (32 - cnt));
}

function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
  return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}

function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return md5cmn((b & c) | (~b & d), a, b, x, s, t);
}
function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return md5cmn((b & d) | (c & ~d), a, b, x, s, t);
}
function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return md5cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return md5cmn(c ^ (b | ~d), a, b, x, s, t);
}

function md5blks(s: string): number[] {
  const l = s.length;
  const blks: number[] = new Array(((l + 8 >> 6) + 1) * 16).fill(0);
  for (let i = 0; i < l; i++) blks[i >> 2] |= s.charCodeAt(i) << ((i % 4) * 8);
  blks[l >> 2] |= 0x80 << ((l % 4) * 8);
  blks[blks.length - 2] = l * 8;
  return blks;
}

function hex(n: number): string {
  const hexChr = '0123456789abcdef';
  let s = '';
  for (let j = 0; j < 4; j++) {
    s += hexChr[(n >> (j * 8 + 4)) & 0x0f] + hexChr[(n >> (j * 8)) & 0x0f];
  }
  return s;
}

export function md5(s: string): string {
  const x = md5blks(s);
  let [a, b, c, d] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];

  for (let i = 0; i < x.length; i += 16) {
    const [aa, bb, cc, dd] = [a, b, c, d];

    a = md5ff(a, b, c, d, x[i],      7, -680876936);  b = md5ff(d, a, b, c, x[i+1],  12, -389564586);
    c = md5ff(c, d, a, b, x[i+2],   17,  606105819);  d = md5ff(b, c, d, a, x[i+3],  22, -1044525330);
    a = md5ff(a, b, c, d, x[i+4],    7, -176418897);  b = md5ff(d, a, b, c, x[i+5],  12,  1200080426);
    c = md5ff(c, d, a, b, x[i+6],   17, -1473231341); d = md5ff(b, c, d, a, x[i+7],  22, -45705983);
    a = md5ff(a, b, c, d, x[i+8],    7,  1770035416); b = md5ff(d, a, b, c, x[i+9],  12, -1958414417);
    c = md5ff(c, d, a, b, x[i+10],  17, -42063);      d = md5ff(b, c, d, a, x[i+11], 22, -1990404162);
    a = md5ff(a, b, c, d, x[i+12],   7,  1804603682); b = md5ff(d, a, b, c, x[i+13], 12, -40341101);
    c = md5ff(c, d, a, b, x[i+14],  17, -1502002290); d = md5ff(b, c, d, a, x[i+15], 22,  1236535329);

    a = md5gg(a, b, c, d, x[i+1],    5, -165796510);  b = md5gg(d, a, b, c, x[i+6],   9, -1069501632);
    c = md5gg(c, d, a, b, x[i+11],  14,  643717713);  d = md5gg(b, c, d, a, x[i],    20, -373897302);
    a = md5gg(a, b, c, d, x[i+5],    5, -701558691);  b = md5gg(d, a, b, c, x[i+10],  9,  38016083);
    c = md5gg(c, d, a, b, x[i+15],  14, -660478335);  d = md5gg(b, c, d, a, x[i+4],  20, -405537848);
    a = md5gg(a, b, c, d, x[i+9],    5,  568446438);  b = md5gg(d, a, b, c, x[i+14],  9, -1019803690);
    c = md5gg(c, d, a, b, x[i+3],   14, -187363961);  d = md5gg(b, c, d, a, x[i+8],  20,  1163531501);
    a = md5gg(a, b, c, d, x[i+13],   5, -1444681467); b = md5gg(d, a, b, c, x[i+2],   9, -51403784);
    c = md5gg(c, d, a, b, x[i+7],   14,  1735328473); d = md5gg(b, c, d, a, x[i+12], 20, -1926607734);

    a = md5hh(a, b, c, d, x[i+5],    4, -378558);     b = md5hh(d, a, b, c, x[i+8],  11, -2022574463);
    c = md5hh(c, d, a, b, x[i+11],  16,  1839030562); d = md5hh(b, c, d, a, x[i+14], 23, -35309556);
    a = md5hh(a, b, c, d, x[i+1],    4, -1530992060); b = md5hh(d, a, b, c, x[i+4],  11,  1272893353);
    c = md5hh(c, d, a, b, x[i+7],   16, -155497632);  d = md5hh(b, c, d, a, x[i+10], 23, -1094730640);
    a = md5hh(a, b, c, d, x[i+13],   4,  681279174);  b = md5hh(d, a, b, c, x[i],    11, -358537222);
    c = md5hh(c, d, a, b, x[i+3],   16, -722521979);  d = md5hh(b, c, d, a, x[i+6],  23,  76029189);
    a = md5hh(a, b, c, d, x[i+9],    4, -640364487);  b = md5hh(d, a, b, c, x[i+12], 11, -421815835);
    c = md5hh(c, d, a, b, x[i+15],  16,  530742520);  d = md5hh(b, c, d, a, x[i+2],  23, -995338651);

    a = md5ii(a, b, c, d, x[i],      6, -198630844);  b = md5ii(d, a, b, c, x[i+7],  10,  1126891415);
    c = md5ii(c, d, a, b, x[i+14],  15, -1416354905); d = md5ii(b, c, d, a, x[i+5],  21, -57434055);
    a = md5ii(a, b, c, d, x[i+12],   6,  1700485571); b = md5ii(d, a, b, c, x[i+3],  10, -1894986606);
    c = md5ii(c, d, a, b, x[i+10],  15, -1051523);    d = md5ii(b, c, d, a, x[i+1],  21, -2054922799);
    a = md5ii(a, b, c, d, x[i+8],    6,  1873313359); b = md5ii(d, a, b, c, x[i+15], 10, -30611744);
    c = md5ii(c, d, a, b, x[i+6],   15, -1560198380); d = md5ii(b, c, d, a, x[i+13], 21,  1309151649);
    a = md5ii(a, b, c, d, x[i+4],    6, -145523070);  b = md5ii(d, a, b, c, x[i+11], 10, -1120210379);
    c = md5ii(c, d, a, b, x[i+2],   15,  718787259);  d = md5ii(b, c, d, a, x[i+9],  21, -343485551);

    a = safeAdd(a, aa); b = safeAdd(b, bb); c = safeAdd(c, cc); d = safeAdd(d, dd);
  }
  return hex(a) + hex(b) + hex(c) + hex(d);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface WbiKeys {
  imgKey: string;
  subKey: string;
}

/**
 * Sign a parameter map with WBI.
 * Returns a new object with wts and w_rid appended.
 */
export function signWbi(
  params: Record<string, string | number>,
  imgKey: string,
  subKey: string,
): Record<string, string> {
  const mixinKey = getMixinKey(imgKey, subKey);
  const wts = Math.floor(Date.now() / 1000).toString();

  const withTs: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    withTs[k] = String(v);
  }
  withTs['wts'] = wts;

  // sort by key
  const sorted = Object.keys(withTs)
    .sort()
    .reduce<Record<string, string>>((acc, k) => {
      // strip special chars from values
      acc[k] = withTs[k].replace(/[!'()*]/g, '');
      return acc;
    }, {});

  const query = Object.entries(sorted)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  sorted['w_rid'] = md5(query + mixinKey);
  return sorted;
}

/**
 * Extract WBI keys from the nav API response.
 * Pass the `wbi_img` field from:
 *   GET https://api.bilibili.com/x/web-interface/nav
 */
export function extractWbiKeys(wbiImg: {
  img_url: string;
  sub_url: string;
}): WbiKeys {
  const imgKey = wbiImg.img_url.split('/').pop()!.replace(/\.\w+$/, '');
  const subKey = wbiImg.sub_url.split('/').pop()!.replace(/\.\w+$/, '');
  return { imgKey, subKey };
}
