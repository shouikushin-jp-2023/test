import { useEffect, useCallback } from 'react';
import { useVodStore } from '../store/playerStore';
import type { PlayUrlResponse, DanmakuItem, VideoQuality } from '../types';
import { parseDanmakuXml } from '../utils/danmaku';

interface FetchFns {
  /** Return play-url data for the given quality number. */
  fetchPlayUrl: (qn: number) => Promise<PlayUrlResponse>;
  /** Return a parsed danmaku list (XML string or pre-parsed items). */
  fetchDanmaku?: () => Promise<DanmakuItem[] | string>;
  /** Map quality numbers to human-readable labels. */
  getQualities?: (playData: PlayUrlResponse) => VideoQuality[];
}

interface Options extends FetchFns {
  /** Unique key for the current video; triggers a full reload when changed. */
  videoKey: string;
  initialQn?: number;
}

/**
 * Orchestrates play-data and danmaku loading for a VOD video.
 *
 * @example
 * const { playData, danmakus, currentQn, qualities, changeQuality } = useVideoPlayer({
 *   videoKey: bvid,
 *   initialQn: 80,
 *   fetchPlayUrl: (qn) => api.getPlayUrl(bvid, cid, qn),
 *   fetchDanmaku:  ()  => api.getDanmakuXml(cid),
 *   getQualities:  (p) => api.getVideoQualities(p),
 * });
 */
export function useVideoPlayer({
  videoKey,
  initialQn = 80,
  fetchPlayUrl,
  fetchDanmaku,
  getQualities,
}: Options) {
  const {
    playData, danmakus, currentQn, currentTime, showDanmaku,
    setPlayData, setDanmakus, setCurrentQn, setCurrentTime, toggleDanmaku, reset,
  } = useVodStore();

  // reload play-url when videoKey or quality changes
  useEffect(() => {
    if (!videoKey) return;
    let cancelled = false;
    fetchPlayUrl(currentQn)
      .then((data) => { if (!cancelled) setPlayData(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [videoKey, currentQn]);

  // load danmaku once per videoKey
  useEffect(() => {
    if (!videoKey || !fetchDanmaku) return;
    let cancelled = false;
    fetchDanmaku()
      .then((result) => {
        if (cancelled) return;
        if (typeof result === 'string') setDanmakus(parseDanmakuXml(result));
        else setDanmakus(result);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [videoKey]);

  // initialise quality and reset on unmount
  useEffect(() => {
    setCurrentQn(initialQn);
    return () => reset();
  }, [videoKey]);

  const qualities: VideoQuality[] = playData && getQualities ? getQualities(playData) : [];
  const changeQuality = useCallback((qn: number) => setCurrentQn(qn), []);

  return { playData, danmakus, currentQn, currentTime, showDanmaku, qualities, changeQuality, setCurrentTime, toggleDanmaku };
}
