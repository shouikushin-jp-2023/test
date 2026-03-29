/**
 * DanmakuOverlay – renders animated danmaku on top of the video.
 *
 * Supports three display modes from the Bilibili protocol:
 *   mode 1 – scrolling right-to-left across 5 horizontal lanes
 *   mode 4 – fixed at the bottom (fades out after 2 s)
 *   mode 5 – fixed at the top    (fades out after 2 s)
 *
 * For live mode pass `liveMode=true`; items are keyed by wall-clock time and
 * always triggered as they arrive (no seek/window logic).
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import type { DanmakuItem } from '../services/types';
import { danmakuColorToCss } from '../utils/danmaku';

// ─── Constants ────────────────────────────────────────────────────────────────

const LANE_COUNT = 5;
const LANE_HEIGHT = 28;
const SCROLL_DURATION = 8_000; // ms
const FIXED_STAY = 2_000;      // ms before fade
const FADE_DURATION = 500;     // ms
const MAX_ACTIVE = 30;
const SEEK_THRESHOLD = 2;      // seconds

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActiveDanmaku {
  id: string;
  item: DanmakuItem;
  /** -1 for fixed (top/bottom) */
  lane: number;
  tx: Animated.Value;
  opacity: Animated.Value;
}

interface Props {
  danmakus: DanmakuItem[];
  currentTime: number;
  screenWidth: number;
  screenHeight: number;
  visible: boolean;
  /** When true items are shown immediately as they arrive (live streaming) */
  liveMode?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DanmakuOverlay({
  danmakus,
  currentTime,
  screenWidth,
  screenHeight,
  visible,
  liveMode = false,
}: Props) {
  const [activeDanmakus, setActiveDanmakus] = useState<ActiveDanmaku[]>([]);
  const laneAvailAt = useRef<number[]>(new Array(LANE_COUNT).fill(0));
  const activated = useRef<Set<string>>(new Set());
  const prevTimeRef = useRef<number>(currentTime);
  const idCounter = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // reset when danmaku set changes (e.g. new video / seek)
  useEffect(() => {
    activated.current.clear();
    laneAvailAt.current.fill(0);
    setActiveDanmakus([]);
  }, [danmakus]);

  const pickLane = useCallback((): number | null => {
    const now = Date.now();
    for (let i = 0; i < LANE_COUNT; i++) {
      if (laneAvailAt.current[i] <= now) return i;
    }
    return null;
  }, []);

  const spawnItem = useCallback(
    (item: DanmakuItem) => {
      if (item.mode === 1) {
        const lane = pickLane();
        if (lane === null) return null;

        const charWidth = Math.min(item.fontSize, 22) * 0.8;
        const textWidth = item.text.length * charWidth;
        const laneDelay = (textWidth / (screenWidth + textWidth)) * SCROLL_DURATION;
        laneAvailAt.current[lane] = Date.now() + laneDelay;

        const tx = new Animated.Value(screenWidth);
        const id = `d_${idCounter.current++}`;

        Animated.timing(tx, {
          toValue: -textWidth - 20,
          duration: SCROLL_DURATION,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished && mountedRef.current) {
            setActiveDanmakus((prev) => prev.filter((d) => d.id !== id));
          }
        });

        return { id, item, lane, tx, opacity: new Animated.Value(1) };
      } else {
        // fixed top / bottom
        const opacity = new Animated.Value(1);
        const id = `d_${idCounter.current++}`;

        Animated.sequence([
          Animated.delay(FIXED_STAY),
          Animated.timing(opacity, { toValue: 0, duration: FADE_DURATION, useNativeDriver: true }),
        ]).start(({ finished }) => {
          if (finished && mountedRef.current) {
            setActiveDanmakus((prev) => prev.filter((d) => d.id !== id));
          }
        });

        return { id, item, lane: -1, tx: new Animated.Value(0), opacity };
      }
    },
    [pickLane, screenWidth],
  );

  // live mode: spawn every new item immediately
  useEffect(() => {
    if (!liveMode || !visible || danmakus.length === 0) return;
    const latest = danmakus[danmakus.length - 1];
    if (!latest) return;
    const key = `${latest.time}_${latest.text}`;
    if (activated.current.has(key)) return;
    activated.current.add(key);

    const active = spawnItem(latest);
    if (!active) return;
    setActiveDanmakus((prev) => {
      const next = [...prev, active];
      return next.slice(-MAX_ACTIVE);
    });
  }, [danmakus, liveMode, visible]);

  // VOD mode: trigger items that fall within a 0.4-second window around currentTime
  useEffect(() => {
    if (liveMode || !visible) return;

    const prevTime = prevTimeRef.current;
    const didSeek = Math.abs(currentTime - prevTime) > SEEK_THRESHOLD;
    prevTimeRef.current = currentTime;

    if (didSeek) {
      activated.current.clear();
      laneAvailAt.current.fill(0);
      setActiveDanmakus([]);
      return;
    }

    const window = 0.4;
    const candidates = danmakus.filter((d) => {
      const key = `${d.time}_${d.text}`;
      return (
        d.time >= currentTime - window &&
        d.time <= currentTime + window &&
        !activated.current.has(key)
      );
    });

    if (candidates.length === 0) return;
    if (activated.current.size > 200) activated.current.clear();

    const newItems: ActiveDanmaku[] = [];
    for (const item of candidates) {
      const key = `${item.time}_${item.text}`;
      activated.current.add(key);
      const active = spawnItem(item);
      if (active) newItems.push(active);
    }

    if (newItems.length > 0) {
      setActiveDanmakus((prev) => {
        const combined = [...prev, ...newItems];
        return combined.slice(-MAX_ACTIVE);
      });
    }
  }, [currentTime, visible, danmakus, liveMode, spawnItem]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {activeDanmakus.map((d) => {
        const fontSize = Math.min(d.item.fontSize || 25, 22);
        const isScrolling = d.item.mode === 1;
        const isTop = d.item.mode === 5;

        return (
          <Animated.Text
            key={d.id}
            style={[
              styles.text,
              {
                top: isScrolling
                  ? 20 + d.lane * LANE_HEIGHT
                  : isTop
                  ? 20
                  : screenHeight - 48,
                left: isScrolling ? 0 : undefined,
                alignSelf: !isScrolling ? 'center' : undefined,
                transform: isScrolling ? [{ translateX: d.tx }] : [],
                opacity: d.opacity,
                color: danmakuColorToCss(d.item.color),
                fontSize,
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
