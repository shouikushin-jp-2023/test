import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import type { DanmakuItem } from '../types';
import { danmakuColorToCss } from '../utils/danmaku';

// ─── Config ───────────────────────────────────────────────────────────────────

const LANE_COUNT = 5;
const LANE_H = 28;
const SCROLL_MS = 8_000;
const FIXED_STAY_MS = 2_000;
const FADE_MS = 500;
const MAX_ACTIVE = 30;
const SEEK_GAP = 2; // seconds – threshold to treat as a seek

// ─── Types ────────────────────────────────────────────────────────────────────

interface Active {
  id: string;
  item: DanmakuItem;
  lane: number;
  tx: Animated.Value;
  opacity: Animated.Value;
}

export interface DanmakuOverlayProps {
  danmakus: DanmakuItem[];
  currentTime: number;
  screenWidth: number;
  screenHeight: number;
  visible: boolean;
  /**
   * When `true` every new item in `danmakus` is rendered immediately
   * (live-stream mode). When `false` items are triggered by `currentTime`
   * within a ±0.4 s window (VOD mode).
   */
  liveMode?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * DanmakuOverlay
 *
 * Renders animated floating comments over a video. Supports:
 *   - mode 1: right-to-left scrolling across 5 horizontal lanes
 *   - mode 4: fixed at the bottom, fades out after 2 s
 *   - mode 5: fixed at the top, fades out after 2 s
 */
export default function DanmakuOverlay({
  danmakus,
  currentTime,
  screenWidth,
  screenHeight,
  visible,
  liveMode = false,
}: DanmakuOverlayProps) {
  const [active, setActive] = useState<Active[]>([]);
  const laneAt = useRef<number[]>(new Array(LANE_COUNT).fill(0));
  const seen = useRef<Set<string>>(new Set());
  const prevTime = useRef(currentTime);
  const idSeq = useRef(0);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  // reset when the danmaku set changes (new video)
  useEffect(() => {
    seen.current.clear();
    laneAt.current.fill(0);
    setActive([]);
  }, [danmakus]);

  const pickLane = useCallback((): number | null => {
    const now = Date.now();
    for (let i = 0; i < LANE_COUNT; i++) {
      if (laneAt.current[i] <= now) return i;
    }
    return null;
  }, []);

  const spawn = useCallback(
    (item: DanmakuItem): Active | null => {
      const id = `d${idSeq.current++}`;

      if (item.mode === 1) {
        const lane = pickLane();
        if (lane === null) return null;

        const charW = Math.min(item.fontSize, 22) * 0.8;
        const textW = item.text.length * charW;
        laneAt.current[lane] = Date.now() + (textW / (screenWidth + textW)) * SCROLL_MS;

        const tx = new Animated.Value(screenWidth);
        Animated.timing(tx, { toValue: -textW - 20, duration: SCROLL_MS, useNativeDriver: true })
          .start(({ finished }) => {
            if (finished && alive.current) setActive((prev) => prev.filter((d) => d.id !== id));
          });

        return { id, item, lane, tx, opacity: new Animated.Value(1) };
      }

      // fixed (mode 4 / 5)
      const opacity = new Animated.Value(1);
      Animated.sequence([
        Animated.delay(FIXED_STAY_MS),
        Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && alive.current) setActive((prev) => prev.filter((d) => d.id !== id));
      });

      return { id, item, lane: -1, tx: new Animated.Value(0), opacity };
    },
    [pickLane, screenWidth],
  );

  // live mode – trigger each new item as it arrives
  useEffect(() => {
    if (!liveMode || !visible || !danmakus.length) return;
    const latest = danmakus[danmakus.length - 1];
    const key = `${latest.time}_${latest.text}`;
    if (seen.current.has(key)) return;
    seen.current.add(key);
    const a = spawn(latest);
    if (a) setActive((prev) => [...prev, a].slice(-MAX_ACTIVE));
  }, [danmakus, liveMode, visible, spawn]);

  // VOD mode – trigger items within a ±0.4 s window of currentTime
  useEffect(() => {
    if (liveMode || !visible) return;

    const prev = prevTime.current;
    const didSeek = Math.abs(currentTime - prev) > SEEK_GAP;
    prevTime.current = currentTime;

    if (didSeek) {
      seen.current.clear();
      laneAt.current.fill(0);
      setActive([]);
      return;
    }

    if (seen.current.size > 200) seen.current.clear();

    const W = 0.4;
    const candidates = danmakus.filter((d) => {
      const key = `${d.time}_${d.text}`;
      return d.time >= currentTime - W && d.time <= currentTime + W && !seen.current.has(key);
    });
    if (!candidates.length) return;

    const newItems: Active[] = [];
    for (const item of candidates) {
      seen.current.add(`${item.time}_${item.text}`);
      const a = spawn(item);
      if (a) newItems.push(a);
    }
    if (newItems.length) {
      setActive((prev) => [...prev, ...newItems].slice(-MAX_ACTIVE));
    }
  }, [currentTime, visible, danmakus, liveMode, spawn]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {active.map((d) => {
        const sz = Math.min(d.item.fontSize || 25, 22);
        const scrolling = d.item.mode === 1;
        const top = d.item.mode === 5;
        return (
          <Animated.Text
            key={d.id}
            style={[
              styles.text,
              {
                fontSize: sz,
                color: danmakuColorToCss(d.item.color),
                opacity: d.opacity,
                top: scrolling ? 20 + d.lane * LANE_H : top ? 20 : screenHeight - 48,
                left: scrolling ? 0 : undefined,
                alignSelf: scrolling ? undefined : 'center',
                transform: scrolling ? [{ translateX: d.tx }] : [],
              },
            ]}
          >
            {d.item.text}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    position: 'absolute',
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
