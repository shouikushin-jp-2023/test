/**
 * useVideoPlayer – orchestrates loading play data, danmaku, and quality for
 * a given bvid+cid combination.
 */

import { useEffect, useCallback } from 'react';
import { useVodStore } from '../store/playerStore';
import { getPlayUrl, getDanmaku, getVideoQualities } from '../services/api';

interface Options {
  bvid: string;
  cid: number;
  initialQn?: number;
}

export function useVideoPlayer({ bvid, cid, initialQn = 80 }: Options) {
  const {
    playData,
    danmakus,
    currentQn,
    currentTime,
    showDanmaku,
    setPlayData,
    setDanmakus,
    setCurrentQn,
    setCurrentTime,
    toggleDanmaku,
    reset,
  } = useVodStore();

  // load play URL whenever bvid/cid/quality changes
  useEffect(() => {
    if (!bvid || !cid) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await getPlayUrl(bvid, cid, currentQn);
        if (!cancelled) setPlayData(data);
      } catch {
        // handle error silently; UI should show placeholder
      }
    })();

    return () => { cancelled = true; };
  }, [bvid, cid, currentQn]);

  // load danmaku once per cid
  useEffect(() => {
    if (!cid) return;
    let cancelled = false;

    (async () => {
      try {
        const items = await getDanmaku(cid);
        if (!cancelled) setDanmakus(items);
      } catch {
        // danmaku unavailable – non-fatal
      }
    })();

    return () => { cancelled = true; };
  }, [cid]);

  // reset store when leaving
  useEffect(() => {
    setCurrentQn(initialQn);
    return () => reset();
  }, [bvid]);

  const qualities = playData ? getVideoQualities(playData) : [];

  const changeQuality = useCallback((qn: number) => {
    setCurrentQn(qn);
  }, []);

  return {
    playData,
    danmakus,
    currentQn,
    currentTime,
    showDanmaku,
    qualities,
    changeQuality,
    setCurrentTime,
    toggleDanmaku,
  };
}
