import React, {
  useState, useRef, useEffect, useCallback,
  forwardRef, useImperativeHandle,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  PanResponder, Animated, Platform, FlatList,
} from 'react-native';
import Video, { type VideoRef, type OnLoadData, type OnProgressData } from 'react-native-video';
import type { PlayUrlResponse, DanmakuItem, VideoQuality } from '../types';
import { buildDashMpdUri } from '../utils/dash';
import { formatDuration } from '../utils/format';
import DanmakuOverlay from './DanmakuOverlay';

// ─── Ref API ──────────────────────────────────────────────────────────────────

export interface NativeVideoPlayerRef {
  seek: (seconds: number) => void;
  setPaused: (v: boolean) => void;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface NativeVideoPlayerProps {
  playData: PlayUrlResponse;
  qualities: VideoQuality[];
  currentQn: number;
  onQualityChange: (qn: number) => void;
  onFullscreen: () => void;
  bvid?: string;
  cid?: number;
  danmakus?: DanmakuItem[];
  isFullscreen: boolean;
  initialTime?: number;
  onTimeUpdate?: (t: number) => void;
  style?: object;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTROLS_TIMEOUT = 3_000;
const PROGRESS_THROTTLE = 450;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * NativeVideoPlayer
 *
 * Core native-layer player. Supports MP4, HLS (m3u8), FLV, and DASH
 * (by writing a local MPD file). Includes a draggable progress bar,
 * quality picker, and danmaku overlay.
 */
export const NativeVideoPlayer = forwardRef<NativeVideoPlayerRef, NativeVideoPlayerProps>(
  function NativeVideoPlayer(
    { playData, qualities, currentQn, onQualityChange, onFullscreen, danmakus = [], isFullscreen, initialTime = 0, onTimeUpdate, style },
    ref,
  ) {
    const [paused, setPaused] = useState(false);
    const [currentTime, setCurrentTime] = useState(initialTime);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const [showQuality, setShowQuality] = useState(false);
    const [showDanmaku, setShowDanmaku] = useState(true);
    const [mpdUri, setMpdUri] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const videoRef = useRef<VideoRef>(null);
    const ctrlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastProgress = useRef(0);
    const seeking = useRef(false);
    const barWidth = useRef(0);
    const seekAnim = useRef(new Animated.Value(0)).current;

    // resolve stream URI
    useEffect(() => {
      let cancelled = false;
      if (playData.dash && Platform.OS !== 'web') {
        buildDashMpdUri(playData, currentQn).then((uri) => {
          if (!cancelled) setMpdUri(uri);
        });
      } else {
        setMpdUri(null);
      }
      return () => { cancelled = true; };
    }, [playData, currentQn]);

    const streamUri = playData.dash
      ? mpdUri
      : (playData.durl?.[0]?.url ?? null);

    useImperativeHandle(ref, () => ({
      seek: (s) => videoRef.current?.seek(s),
      setPaused,
    }));

    const resetControls = useCallback(() => {
      if (ctrlTimer.current) clearTimeout(ctrlTimer.current);
      setShowControls(true);
      ctrlTimer.current = setTimeout(() => setShowControls(false), CONTROLS_TIMEOUT);
    }, []);

    useEffect(() => {
      resetControls();
      return () => { if (ctrlTimer.current) clearTimeout(ctrlTimer.current); };
    }, []);

    // draggable progress bar
    const pan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        seeking.current = true;
        setPaused(true);
        seekAnim.setValue(Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth.current)));
      },
      onPanResponderMove: (e) => {
        seekAnim.setValue(Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth.current)));
      },
      onPanResponderRelease: (e) => {
        const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth.current));
        const t = ratio * duration;
        videoRef.current?.seek(t);
        setCurrentTime(t);
        seeking.current = false;
        setPaused(false);
      },
    });

    const onLoad = ({ duration: d }: OnLoadData) => {
      setDuration(d);
      setError(null);
      if (initialTime > 0) videoRef.current?.seek(initialTime);
    };

    const onProgress = ({ currentTime: t, playableDuration }: OnProgressData) => {
      if (seeking.current) return;
      const now = Date.now();
      if (now - lastProgress.current < PROGRESS_THROTTLE) return;
      lastProgress.current = now;
      setCurrentTime(t);
      setBuffered(playableDuration);
      seekAnim.setValue(duration > 0 ? t / duration : 0);
      onTimeUpdate?.(t);
    };

    if (!streamUri) {
      return (
        <View style={[styles.root, style]}>
          <Text style={styles.placeholder}>加载中…</Text>
        </View>
      );
    }

    return (
      <View style={[styles.root, style]}>
        <Video
          ref={videoRef}
          source={{ uri: streamUri }}
          style={StyleSheet.absoluteFillObject}
          paused={paused}
          resizeMode="contain"
          onLoad={onLoad}
          onProgress={onProgress}
          onError={(e) => setError(e.error?.errorString ?? '播放出错')}
          progressUpdateInterval={PROGRESS_THROTTLE}
        />

        <DanmakuOverlay
          danmakus={danmakus}
          currentTime={currentTime}
          screenWidth={(style as { width?: number } | undefined)?.width ?? 400}
          screenHeight={(style as { height?: number } | undefined)?.height ?? 225}
          visible={showDanmaku}
        />

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* tap to toggle controls */}
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={() => (showControls ? setShowControls(false) : resetControls())}
        />

        {showControls && (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
            <View style={styles.bar}>
              <TouchableOpacity onPress={() => setPaused((p) => !p)} style={styles.btn}>
                <Text style={styles.icon}>{paused ? '▶' : '⏸'}</Text>
              </TouchableOpacity>

              <Text style={styles.time}>
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </Text>

              <TouchableOpacity onPress={() => setShowDanmaku((v) => !v)} style={styles.btn}>
                <Text style={[styles.icon, !showDanmaku && styles.dim]}>弹</Text>
              </TouchableOpacity>

              {qualities.length > 0 && (
                <TouchableOpacity onPress={() => setShowQuality(true)} style={styles.qBtn}>
                  <Text style={styles.qText}>
                    {qualities.find((q) => q.qn === currentQn)?.desc ?? '画质'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={onFullscreen} style={[styles.btn, styles.mlAuto]}>
                <Text style={styles.icon}>{isFullscreen ? '⛶' : '⛶'}</Text>
              </TouchableOpacity>
            </View>

            {/* progress bar */}
            <View
              style={styles.progressWrapper}
              onLayout={(e) => { barWidth.current = e.nativeEvent.layout.width; }}
              {...pan.panHandlers}
            >
              <View style={[styles.track, { width: `${(duration > 0 ? buffered / duration : 0) * 100}%`, backgroundColor: 'rgba(255,255,255,0.25)' }]} />
              <Animated.View
                style={[
                  styles.track,
                  {
                    width: seekAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    backgroundColor: '#fb7299',
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.thumb,
                  { left: seekAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                ]}
              />
            </View>
          </View>
        )}

        {showQuality && (
          <View style={styles.qSheet}>
            <FlatList
              data={qualities}
              keyExtractor={(q) => String(q.qn)}
              renderItem={({ item: q }) => (
                <TouchableOpacity
                  style={[styles.qItem, q.qn === currentQn && styles.qItemActive]}
                  onPress={() => { onQualityChange(q.qn); setShowQuality(false); }}
                >
                  <Text style={styles.qItemText}>{q.desc}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.qCancel} onPress={() => setShowQuality(false)}>
              <Text style={styles.qItemText}>取消</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  },
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { backgroundColor: '#000', overflow: 'hidden' },
  placeholder: { color: '#fff', alignSelf: 'center', marginTop: 80 },
  bar: {
    position: 'absolute', bottom: 28, left: 0, right: 0, height: 44,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  progressWrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 28,
    justifyContent: 'center', paddingHorizontal: 12,
  },
  track: { position: 'absolute', height: 3, top: '50%', marginTop: -1.5, borderRadius: 2 },
  thumb: {
    position: 'absolute', width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#fb7299', top: '50%', marginTop: -6, marginLeft: -6,
  },
  btn: { padding: 6 },
  icon: { color: '#fff', fontSize: 18 },
  dim: { opacity: 0.4 },
  mlAuto: { marginLeft: 'auto' },
  time: { color: '#fff', fontSize: 12, marginHorizontal: 6 },
  qBtn: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 4 },
  qText: { color: '#fff', fontSize: 12 },
  qSheet: {
    position: 'absolute', bottom: 72, right: 12, width: 120, maxHeight: 240,
    backgroundColor: 'rgba(30,30,30,0.95)', borderRadius: 8, overflow: 'hidden',
  },
  qItem: { paddingVertical: 10, paddingHorizontal: 16 },
  qItemActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  qItemText: { color: '#fff', fontSize: 14 },
  qCancel: {
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center',
  },
  errorBox: {
    position: 'absolute', top: '35%', left: 16, right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: 12, alignItems: 'center',
  },
  errorText: { color: '#ff6b6b', fontSize: 13, textAlign: 'center' },
});
