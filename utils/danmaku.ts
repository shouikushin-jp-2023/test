import type { DanmakuItem } from '../services/types';

/**
 * Parse a Bilibili danmaku XML string into a sorted array of DanmakuItem.
 *
 * Each <d> element has a `p` attribute:
 *   time,mode,fontSize,color,ts,pool,uid_hash,dmid,weight
 */
export function parseDanmakuXml(xml: string): DanmakuItem[] {
  const re = /<d p="([^"]+)">([^<]*)<\/d>/g;
  const items: DanmakuItem[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(xml)) !== null) {
    const p = m[1].split(',');
    if (p.length < 4) continue;

    const time = parseFloat(p[0]);
    const mode = parseInt(p[1], 10);
    const fontSize = parseInt(p[2], 10);
    const color = parseInt(p[3], 10);

    // unescape HTML entities
    const text = m[2]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    if (!text || isNaN(time)) continue;

    // only support scroll (1), bottom-fixed (4), top-fixed (5)
    if (mode !== 1 && mode !== 4 && mode !== 5) continue;

    items.push({
      time,
      mode: mode as 1 | 4 | 5,
      fontSize,
      color,
      text,
    });
  }

  return items.sort((a, b) => a.time - b.time);
}

/**
 * Convert a Bilibili danmaku colour integer to a CSS hex string.
 * e.g. 16777215 → "#ffffff"
 */
export function danmakuColorToCss(color: number): string {
  return '#' + (color >>> 0 & 0xffffff).toString(16).padStart(6, '0');
}

/**
 * Filter danmakus that fall within [start, end] seconds.
 */
export function danmakuInWindow(
  danmakus: DanmakuItem[],
  start: number,
  end: number,
): DanmakuItem[] {
  return danmakus.filter((d) => d.time >= start && d.time <= end);
}
