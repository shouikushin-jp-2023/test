/**
 * LivePlayer – full-screen capable live stream player supporting HLS and FLV.
 *
 * Features:
 *  - HLS (m3u8) playback via react-native-video
 *  - FLV live stream via react-native-video (ExoPlayer on Android supports FLV)
 *  - Real-time danmaku overlay connected via useLiveDanmaku WebSocket hook
 *  - Quality switching
 *  - Fullscreen via expo-screen-orientation
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  StatusBar,
  Platform,
  useWindowDimensions,
  FlatList,
} from 'react-native';
import Video, { type VideoRef } from 'react-native-video';
import { useLiveDanmaku } from '../hooks/useLiveDanmaku';
import { useLiveStore } from '../store/playerStore';
import DanmakuOverlay from './DanmakuOverlay';
import type { LiveStreamInfo } from '../services/types';

let ScreenOrientation: typeof import('expo-screen-orientation') | null = null;
try { ScreenOrientation = require('expo-screen-orientation'); } catch {}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  roomId: number;
  streamInfo: LiveStreamInfo;
  uid?: number;
  onQualityChange?: (qn: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LivePlayer({ roomId, streamInfo, uid = 0, onQualityChange }: Props) {
  const { width } = useWindowDimensions();
  const VIDEO_HEIGHT = width * 0.5625;

  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showQuality, setShowQuality] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<VideoRef>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { liveDanmakus, showDanmaku } = useLiveStore();

  // connect WebSocket danmaku
  useLiveDanmaku({ roomId, uid, enabled: true });

  // pick the best stream URL: prefer HLS for iOS/web, FLV for Android
  const streamUrl =
    Platform.OS === 'android'
      ? (streamInfo.flv ?? streamInfo.hls ?? '')
      : (streamInfo.hls ?? streamInfo.flv ?? '');

  const needsRotation = !ScreenOrientation && fullscreen;

  // auto-hide controls
  const resetControlsTimer = () => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    setShowControls(true);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 4_000);
  };

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

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

  useEffect(() => {
    return () => {
      if (Platform.OS !== 'web')
        ScreenOrientation?.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  // ─── Render helpers ──────────────────────────────────────────────────────────

  const renderVideo = (w: number, h: number) => (
    <View style={{ width: w, height: h, backgroundColor: '#000' }}>
      <Video
        ref={videoRef}
        source={{ uri: streamUrl }}
        style={{ width: w, height: h }}
        paused={paused}
        resizeMode="contain"
        onError={(e) => setError(e.error?.errorString ?? 'Playback error')}
        onLoad={() => setError(null)}
        repeat={false}
        // Live stream – no need to buffer on end
      />

      {/* Danmaku overlay */}
      {showDanmaku && (
        <DanmakuOverlay
          danmakus={liveDanmakus}
          currentTime={0}
          screenWidth={w}
          screenHeight={h}
          visible={showDanmaku}
          liveMode
        />
      )}

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Controls overlay */}
      {showControls && (
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={resetControlsTimer}
        >
          <View style={styles.controlsTop}>
            <Text style={styles.liveTag}>LIVE</Text>
          </View>
          <View style={styles.controlsBottom}>
            {/* play / pause */}
            <TouchableOpacity onPress={() => setPaused((p) => !p)} style={styles.iconBtn}>
              <Text style={styles.iconText}>{paused ? '▶' : '⏸'}</Text>
            </TouchableOpacity>

            {/* quality */}
            {streamInfo.qualities.length > 0 && (
              <TouchableOpacity onPress={() => setShowQuality(true)} style={styles.qualityBtn}>
                <Text style={styles.qualityText}>
                  {streamInfo.qualities.find((q) => q.qn === streamInfo.currentQn)?.desc ?? '画质'}
                </Text>
              </TouchableOpacity>
            )}

            {/* fullscreen */}
            <TouchableOpacity
              onPress={fullscreen ? handleExitFullscreen : handleEnterFullscreen}
              style={[styles.iconBtn, { marginLeft: 'auto' }]}
            >
              <Text style={styles.iconText}>{fullscreen ? '⛶' : '⛶'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Quality sheet */}
      {showQuality && (
        <View style={styles.qualitySheet}>
          <FlatList
            data={streamInfo.qualities}
            keyExtractor={(q) => String(q.qn)}
            renderItem={({ item: q }) => (
              <TouchableOpacity
                style={[styles.qualityItem, q.qn === streamInfo.currentQn && styles.qualityItemActive]}
                onPress={() => {
                  onQualityChange?.(q.qn);
                  setShowQuality(false);
                }}
              >
                <Text style={styles.qualityItemText}>{q.desc}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity onPress={() => setShowQuality(false)} style={styles.qualityCancel}>
            <Text style={styles.qualityItemText}>取消</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ─── Portrait ────────────────────────────────────────────────────────────────

  if (fullscreen) {
    const { height } = useWindowDimensions(); // eslint-disable-line react-hooks/rules-of-hooks
    return (
      <Modal visible animationType="none" statusBarTranslucent>
        <StatusBar hidden />
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          {needsRotation ? (
            <View style={{ width: height, height: width, transform: [{ rotate: '90deg' }] }}>
              {renderVideo(height, width)}
            </View>
          ) : (
            renderVideo(width, height)
          )}
        </View>
      </Modal>
    );
  }

  return renderVideo(width, VIDEO_HEIGHT);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  controlsTop: {
    position: 'absolute',
    top: 8,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlsBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  liveTag: {
    color: '#ff4444',
    fontWeight: '900',
    fontSize: 13,
    backgroundColor: 'rgba(255,68,68,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  iconBtn: { padding: 8 },
  iconText: { color: '#fff', fontSize: 18 },
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
    bottom: 44,
    right: 0,
    width: 120,
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
    top: '40%',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  errorText: { color: '#ff6b6b', fontSize: 14, textAlign: 'center' },
});
