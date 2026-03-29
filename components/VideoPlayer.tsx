/**
 * VideoPlayer – top-level video player component.
 *
 * Orchestrates portrait / fullscreen rendering so that only one
 * <Video> decoder is mounted at a time.
 *
 * Supported stream types (detected automatically from the play data):
 *   • MP4  – durl[0].url ending in .mp4
 *   • FLV  – durl[0].url ending in .flv
 *   • HLS  – durl[0].url ending in .m3u8
 *   • DASH – playData.dash present → MPD file written to cache
 *
 * On web, falls back to a plain <video> element.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Platform,
  Modal,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { NativeVideoPlayer, type NativeVideoPlayerRef } from './NativeVideoPlayer';
import type { PlayUrlResponse, DanmakuItem, VideoQuality } from '../services/types';

let ScreenOrientation: typeof import('expo-screen-orientation') | null = null;
try { ScreenOrientation = require('expo-screen-orientation'); } catch {}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  playData: PlayUrlResponse | null;
  qualities: VideoQuality[];
  currentQn: number;
  onQualityChange: (qn: number) => void;
  bvid?: string;
  cid?: number;
  danmakus?: DanmakuItem[];
  onTimeUpdate?: (t: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VideoPlayer({
  playData,
  qualities,
  currentQn,
  onQualityChange,
  bvid,
  cid,
  danmakus,
  onTimeUpdate,
}: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const { width, height } = useWindowDimensions();
  const VIDEO_HEIGHT = width * 0.5625; // 16:9
  const needsRotation = !ScreenOrientation && fullscreen;
  const lastTimeRef = useRef(0);
  const portraitRef = useRef<NativeVideoPlayerRef>(null);

  const handleEnterFullscreen = async () => {
    if (Platform.OS !== 'web')
      await ScreenOrientation?.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
    setFullscreen(true);
  };

  const handleExitFullscreen = async () => {
    setFullscreen(false);
    if (Platform.OS !== 'web')
      await ScreenOrientation?.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  };

  // restore portrait on unmount
  useEffect(() => {
    return () => {
      if (Platform.OS !== 'web')
        ScreenOrientation?.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  // ─── No data ──────────────────────────────────────────────────────────────

  if (!playData) {
    return (
      <View style={[{ width, height: VIDEO_HEIGHT, backgroundColor: '#000' }, styles.placeholder]}>
        <Text style={styles.placeholderText}>视频加载中...</Text>
      </View>
    );
  }

  // ─── Web fallback ─────────────────────────────────────────────────────────

  if (Platform.OS === 'web') {
    const url = playData.durl?.[0]?.url ?? '';
    return (
      <View style={{ width, height: VIDEO_HEIGHT, backgroundColor: '#000' }}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <video
          src={url}
          style={{ width: '100%', height: '100%', backgroundColor: '#000' } as any}
          controls
          playsInline
        />
      </View>
    );
  }

  // ─── Native – portrait ────────────────────────────────────────────────────

  return (
    <>
      {!fullscreen && (
        <NativeVideoPlayer
          ref={portraitRef}
          playData={playData}
          qualities={qualities}
          currentQn={currentQn}
          onQualityChange={onQualityChange}
          onFullscreen={handleEnterFullscreen}
          bvid={bvid}
          cid={cid}
          danmakus={danmakus}
          isFullscreen={false}
          initialTime={lastTimeRef.current}
          onTimeUpdate={(t) => { lastTimeRef.current = t; onTimeUpdate?.(t); }}
          style={{ width, height: VIDEO_HEIGHT }}
        />
      )}

      {/* ─── Native – fullscreen (Modal) ─────────────────────────────────── */}
      {fullscreen && (
        <Modal visible animationType="none" statusBarTranslucent>
          <StatusBar hidden />
          <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
            <View
              style={
                needsRotation
                  ? { width: height, height: width, transform: [{ rotate: '90deg' }] }
                  : { flex: 1, width: '100%' }
              }
            >
              <NativeVideoPlayer
                playData={playData}
                qualities={qualities}
                currentQn={currentQn}
                onQualityChange={onQualityChange}
                onFullscreen={handleExitFullscreen}
                bvid={bvid}
                cid={cid}
                danmakus={danmakus}
                isFullscreen
                initialTime={lastTimeRef.current}
                onTimeUpdate={(t) => { lastTimeRef.current = t; onTimeUpdate?.(t); }}
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
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#fff', fontSize: 14 },
});
