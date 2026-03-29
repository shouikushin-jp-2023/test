import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Platform,
  Modal, StatusBar, useWindowDimensions,
} from 'react-native';
import { NativeVideoPlayer, type NativeVideoPlayerRef } from './NativeVideoPlayer';
import type { PlayUrlResponse, DanmakuItem, VideoQuality } from '../types';

let ScreenOrientation: typeof import('expo-screen-orientation') | null = null;
try { ScreenOrientation = require('expo-screen-orientation'); } catch {}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface VideoPlayerProps {
  /** Play-url response (null renders a loading placeholder). */
  playData: PlayUrlResponse | null;
  qualities: VideoQuality[];
  currentQn: number;
  onQualityChange: (qn: number) => void;
  danmakus?: DanmakuItem[];
  onTimeUpdate?: (seconds: number) => void;
  /** Arbitrary props forwarded to the underlying Video element. */
  bvid?: string;
  cid?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * VideoPlayer
 *
 * Top-level player component. Mounts exactly one `<Video>` decoder at a time
 * by unmounting the portrait instance before opening the fullscreen Modal.
 *
 * Supported formats (auto-detected from `playData`):
 *   - **MP4** – direct progressive download
 *   - **HLS** – m3u8 adaptive streaming
 *   - **FLV** – ExoPlayer on Android (react-native-video)
 *   - **DASH** – MPD written to cache, decoded natively by ExoPlayer / AVPlayer
 *
 * On web, falls back to a native `<video>` element.
 */
export function VideoPlayer({
  playData, qualities, currentQn, onQualityChange,
  danmakus, onTimeUpdate, bvid, cid,
}: VideoPlayerProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const { width, height } = useWindowDimensions();
  const VIDEO_H = width * 0.5625;
  const needsRotation = !ScreenOrientation && fullscreen;
  const lastTime = useRef(0);

  const enterFullscreen = async () => {
    if (Platform.OS !== 'web')
      await ScreenOrientation?.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
    setFullscreen(true);
  };

  const exitFullscreen = async () => {
    setFullscreen(false);
    if (Platform.OS !== 'web')
      await ScreenOrientation?.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  };

  useEffect(() => {
    return () => {
      if (Platform.OS !== 'web')
        ScreenOrientation?.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  if (!playData) {
    return (
      <View style={[styles.placeholder, { width, height: VIDEO_H }]}>
        <Text style={styles.placeholderText}>加载中…</Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    const url = playData.durl?.[0]?.url ?? '';
    return (
      <View style={{ width, height: VIDEO_H, backgroundColor: '#000' }}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <video src={url} style={{ width: '100%', height: '100%' } as any} controls playsInline />
      </View>
    );
  }

  const sharedProps = {
    playData, qualities, currentQn, onQualityChange,
    bvid, cid, danmakus,
    onTimeUpdate: (t: number) => { lastTime.current = t; onTimeUpdate?.(t); },
  };

  return (
    <>
      {!fullscreen && (
        <NativeVideoPlayer
          {...sharedProps}
          onFullscreen={enterFullscreen}
          isFullscreen={false}
          initialTime={lastTime.current}
          style={{ width, height: VIDEO_H }}
        />
      )}

      {fullscreen && (
        <Modal visible animationType="none" statusBarTranslucent>
          <StatusBar hidden />
          <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
            <View style={needsRotation
              ? { width: height, height: width, transform: [{ rotate: '90deg' }] }
              : { flex: 1, width: '100%' }
            }>
              <NativeVideoPlayer
                {...sharedProps}
                onFullscreen={exitFullscreen}
                isFullscreen
                initialTime={lastTime.current}
                style={needsRotation ? { width: height, height: width } : { flex: 1 }}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#fff', fontSize: 14 },
});
