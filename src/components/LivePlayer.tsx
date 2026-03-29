import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  StatusBar, Platform, useWindowDimensions, FlatList,
} from 'react-native';
import Video, { type VideoRef } from 'react-native-video';
import { useLiveDanmaku } from '../hooks/useLiveDanmaku';
import { useLiveStore } from '../store/playerStore';
import DanmakuOverlay from './DanmakuOverlay';
import type { LiveStreamInfo } from '../types';

let ScreenOrientation: typeof import('expo-screen-orientation') | null = null;
try { ScreenOrientation = require('expo-screen-orientation'); } catch {}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LivePlayerProps {
  roomId: number;
  streamInfo: LiveStreamInfo;
  /** Authenticated user UID (0 for anonymous). Used for danmaku WebSocket auth. */
  uid?: number;
  onQualityChange?: (qn: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * LivePlayer
 *
 * Plays a live stream (HLS or FLV) with real-time danmaku overlay. iOS prefers
 * HLS, Android prefers FLV. Supports fullscreen, quality switching, and
 * danmaku toggle.
 */
export function LivePlayer({ roomId, streamInfo, uid = 0, onQualityChange }: LivePlayerProps) {
  const { width, height: winH } = useWindowDimensions();
  const VIDEO_H = width * 0.5625;

  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showQuality, setShowQuality] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<VideoRef>(null);
  const ctrlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const needsRotation = !ScreenOrientation && fullscreen;

  const { liveDanmakus, showDanmaku } = useLiveStore();
  useLiveDanmaku({ roomId, uid, enabled: true });

  const streamUrl =
    Platform.OS === 'android'
      ? (streamInfo.flv ?? streamInfo.hls ?? '')
      : (streamInfo.hls ?? streamInfo.flv ?? '');

  const resetControls = () => {
    if (ctrlTimer.current) clearTimeout(ctrlTimer.current);
    setShowControls(true);
    ctrlTimer.current = setTimeout(() => setShowControls(false), 4_000);
  };

  useEffect(() => {
    resetControls();
    return () => { if (ctrlTimer.current) clearTimeout(ctrlTimer.current); };
  }, []);

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

  const renderPlayer = (w: number, h: number) => (
    <View style={{ width: w, height: h, backgroundColor: '#000' }}>
      <Video
        ref={videoRef}
        source={{ uri: streamUrl }}
        style={{ width: w, height: h }}
        paused={paused}
        resizeMode="contain"
        onError={(e) => setError(e.error?.errorString ?? '播放出错')}
        onLoad={() => setError(null)}
      />

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

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {showControls && (
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={resetControls}>
          <View style={styles.topBar}>
            <Text style={styles.liveTag}>LIVE</Text>
          </View>
          <View style={styles.bottomBar}>
            <TouchableOpacity onPress={() => setPaused((p) => !p)} style={styles.btn}>
              <Text style={styles.icon}>{paused ? '▶' : '⏸'}</Text>
            </TouchableOpacity>

            {streamInfo.qualities.length > 0 && (
              <TouchableOpacity onPress={() => setShowQuality(true)} style={styles.qBtn}>
                <Text style={styles.qText}>
                  {streamInfo.qualities.find((q) => q.qn === streamInfo.currentQn)?.desc ?? '画质'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={fullscreen ? exitFullscreen : enterFullscreen}
              style={[styles.btn, styles.mlAuto]}
            >
              <Text style={styles.icon}>⛶</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {showQuality && (
        <View style={styles.qSheet}>
          <FlatList
            data={streamInfo.qualities}
            keyExtractor={(q) => String(q.qn)}
            renderItem={({ item: q }) => (
              <TouchableOpacity
                style={[styles.qItem, q.qn === streamInfo.currentQn && styles.qItemActive]}
                onPress={() => { onQualityChange?.(q.qn); setShowQuality(false); }}
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

  if (fullscreen) {
    return (
      <Modal visible animationType="none" statusBarTranslucent>
        <StatusBar hidden />
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          {needsRotation ? (
            <View style={{ width: winH, height: width, transform: [{ rotate: '90deg' }] }}>
              {renderPlayer(winH, width)}
            </View>
          ) : renderPlayer(width, winH)}
        </View>
      </Modal>
    );
  }

  return renderPlayer(width, VIDEO_H);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  topBar: { position: 'absolute', top: 8, left: 12 },
  liveTag: {
    color: '#ff4444', fontWeight: '900', fontSize: 13,
    backgroundColor: 'rgba(255,68,68,0.15)', paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#ff4444',
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 44,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  btn: { padding: 8 },
  icon: { color: '#fff', fontSize: 18 },
  mlAuto: { marginLeft: 'auto' },
  qBtn: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 4 },
  qText: { color: '#fff', fontSize: 12 },
  qSheet: {
    position: 'absolute', bottom: 44, right: 0, width: 120,
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
    position: 'absolute', top: '40%', left: 16, right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: 12, alignItems: 'center',
  },
  errorText: { color: '#ff6b6b', fontSize: 14, textAlign: 'center' },
});
