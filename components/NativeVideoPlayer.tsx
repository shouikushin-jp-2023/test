/**
 * NativeVideoPlayer – the native-layer video player.
 *
 * Handles:
 *  - MP4 / M3U8 (HLS) direct playback via react-native-video
 *  - DASH playback: writes an MPD file to cache and passes the file:// URI
 *  - FLV: passed directly to ExoPlayer (Android) / warns on iOS
 *  - Custom progress bar with PanResponder drag
 *  - Quality selection overlay
 *  - Danmaku toggle
 *  - Auto-hiding controls (3-second timer)
 *  - Exposes seek / pause via forwardRef
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Animated,
  Platform,
  FlatList,
} from 'react-native';
import Video, { type VideoRef, type OnLoadData, type OnProgressData } from 'react-native-video';
import type { PlayUrlResponse, DanmakuItem, VideoQuality } from '../services/types';
import { buildDashMpdUri } from '../utils/dash';
import { formatDuration } from '../utils/format';
import DanmakuOverlay from './DanmakuOverlay';

// ─── Public ref API ───────────────────────────────────────────────────────────

export interface NativeVideoPlayerRef {
  seek: (seconds: number) => void;
  setPaused: (v: boolean) => void;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
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

const CONTROLS_TIMEOUT = 3_000;
const PROGRESS_THROTTLE = 450;

// ─── Component ────────────────────────────────────────────────────────────────

export const NativeVideoPlayer = forwardRef<NativeVideoPlayerRef, Props>(
  function NativeVideoPlayer(
    {
      playData,
      qualities,
      currentQn,
      onQualityChange,
      onFullscreen,
      danmakus = [],
      isFullscreen,
      initialTime = 0,
      onTimeUpdate,
      style,
    },
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
    const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastProgressTime = useRef(0);
    const seekingRef = useRef(false);
    const seekBarRef = useRef<View>(null);
    const seekBarWidth = useRef(0);
    const seekAnimVal = useRef(new Animated.Value(0)).current;

    // ─── Build stream URI ──────────────────────────────────────────────────────

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

    const streamUri = (() => {
      if (playData.dash) {
        return mpdUri ?? null; // wait for MPD to be written
      }
      // progressive / HLS / FLV
      return playData.durl?.[0]?.url ?? null;
    })();

    // ─── Expose ref ───────────────────────────────────────────────────────────

    useImperativeHandle(ref, () => ({
      seek: (s) => videoRef.current?.seek(s),
      setPaused: (v) => setPaused(v),
    }));

    // ─── Controls auto-hide ───────────────────────────────────────────────────

    const resetControls = useCallback(() => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      setShowControls(true);
      controlsTimer.current = setTimeout(() => setShowControls(false), CONTROLS_TIMEOUT);
    }, []);

    useEffect(() => {
      resetControls();
      return () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); };
    }, []);

    // ─── Progress bar PanResponder ────────────────────────────────────────────

    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        seekingRef.current = true;
        setPaused(true);
        const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / seekBarWidth.current));
        seekAnimVal.setValue(ratio);
      },
      onPanResponderMove: (e) => {
        const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / seekBarWidth.current));
        seekAnimVal.setValue(ratio);
      },
      onPanResponderRelease: (e) => {
        const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / seekBarWidth.current));
        const seekTo = ratio * duration;
        videoRef.current?.seek(seekTo);
        setCurrentTime(seekTo);
        seekingRef.current = false;
        setPaused(false);
      },
    });

    // ─── Video callbacks ──────────────────────────────────────────────────────

    const handleLoad = ({ duration: d }: OnLoadData) => {
      setDuration(d);
      setError(null);
      if (initialTime > 0) videoRef.current?.seek(initialTime);
    };

    const handleProgress = ({ currentTime: t, playableDuration }: OnProgressData) => {
      if (seekingRef.current) return;
      const now = Date.now();
      if (now - lastProgressTime.current < PROGRESS_THROTTLE) return;
      lastProgressTime.current = now;

      setCurrentTime(t);
      setBuffered(playableDuration);
      seekAnimVal.setValue(duration > 0 ? t / duration : 0);
      onTimeUpdate?.(t);
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    if (!streamUri) {
      return (
        <View style={[styles.container, style]}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      );
    }

    const progressRatio = duration > 0 ? currentTime / duration : 0;

    return (
      <View style={[styles.container, style]}>
        <Video
          ref={videoRef}
          source={{ uri: streamUri }}
          style={StyleSheet.absoluteFillObject}
          paused={paused}
          resizeMode="contain"
          onLoad={handleLoad}
          onProgress={handleProgress}
          onError={(e) => setError(e.error?.errorString ?? '播放出错')}
          progressUpdateInterval={PROGRESS_THROTTLE}
        />

        {/* Danmaku */}
        <DanmakuOverlay
          danmakus={danmakus}
          currentTime={currentTime}
          screenWidth={style ? (style as { width?: number }).width ?? 400 : 400}
          screenHeight={style ? (style as { height?: number }).height ?? 225 : 225}
          visible={showDanmaku}
        />

        {/* Error */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Controls tap target */}
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={() => (showControls ? setShowControls(false) : resetControls())}
        />

        {/* Controls overlay */}
        {showControls && (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
            {/* Bottom bar */}
            <View style={styles.bottomBar}>
              {/* Play / pause */}
              <TouchableOpacity onPress={() => setPaused((p) => !p)} style={styles.iconBtn}>
                <Text style={styles.iconText}>{paused ? '▶' : '⏸'}</Text>
              </TouchableOpacity>

              {/* Time */}
              <Text style={styles.timeText}>
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </Text>

              {/* Danmaku toggle */}
              <TouchableOpacity
                onPress={() => setShowDanmaku((v) => !v)}
                style={styles.iconBtn}
              >
                <Text style={[styles.iconText, !showDanmaku && styles.iconDisabled]}>弹</Text>
              </TouchableOpacity>

              {/* Quality */}
              {qualities.length > 0 && (
                <TouchableOpacity onPress={() => setShowQuality(true)} style={styles.qualityBtn}>
                  <Text style={styles.qualityText}>
                    {qualities.find((q) => q.qn === currentQn)?.desc ?? '画质'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Fullscreen */}
              <TouchableOpacity onPress={onFullscreen} style={[styles.iconBtn, { marginLeft: 'auto' }]}>
                <Text style={styles.iconText}>{isFullscreen ? '⛶' : '⛶'}</Text>
              </TouchableOpacity>
            </View>

            {/* Progress bar */}
            <View
              style={styles.progressWrapper}
              ref={seekBarRef}
              onLayout={(e) => { seekBarWidth.current = e.nativeEvent.layout.width; }}
              {...panResponder.panHandlers}
            >
              {/* buffer track */}
              <View
                style={[styles.progressTrack, { width: `${(duration > 0 ? buffered / duration : 0) * 100}%`, backgroundColor: 'rgba(255,255,255,0.25)' }]}
              />
              {/* play track */}
              <Animated.View
                style={[
                  styles.progressTrack,
                  {
                    width: seekAnimVal.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                    backgroundColor: '#fb7299',
                  },
                ]}
              />
              {/* thumb */}
              <Animated.View
                style={[
                  styles.progressThumb,
                  {
                    left: seekAnimVal.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* Quality picker */}
        {showQuality && (
          <View style={styles.qualitySheet}>
            <FlatList
              data={qualities}
              keyExtractor={(q) => String(q.qn)}
              renderItem={({ item: q }) => (
                <TouchableOpacity
                  style={[styles.qualityItem, q.qn === currentQn && styles.qualityItemActive]}
                  onPress={() => {
                    onQualityChange(q.qn);
                    setShowQuality(false);
                  }}
                >
                  <Text style={styles.qualityItemText}>{q.desc}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.qualityCancel} onPress={() => setShowQuality(false)}>
              <Text style={styles.qualityItemText}>取消</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  },
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { backgroundColor: '#000', overflow: 'hidden' },
  loadingText: { color: '#fff', alignSelf: 'center', marginTop: 80 },
  bottomBar: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  progressWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  progressTrack: {
    position: 'absolute',
    height: 3,
    top: '50%',
    marginTop: -1.5,
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fb7299',
    top: '50%',
    marginTop: -6,
    marginLeft: -6,
  },
  iconBtn: { padding: 6 },
  iconText: { color: '#fff', fontSize: 18 },
  iconDisabled: { opacity: 0.4 },
  timeText: { color: '#fff', fontSize: 12, marginHorizontal: 6 },
  qualityBtn: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
  },
  qualityText: { color: '#fff', fontSize: 12 },
  qualitySheet: {
    position: 'absolute',
    bottom: 72,
    right: 12,
    width: 120,
    maxHeight: 240,
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  qualityItem: { paddingVertical: 10, paddingHorizontal: 16 },
  qualityItemActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  qualityItemText: { color: '#fff', fontSize: 14 },
  qualityCancel: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  errorBanner: {
    position: 'absolute',
    top: '35%',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  errorText: { color: '#ff6b6b', fontSize: 13, textAlign: 'center' },
});
