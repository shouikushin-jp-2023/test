/**
 * Live screen – live stream playback with real-time danmaku.
 *
 * Route params:
 *   roomId – Bilibili live room ID
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LivePlayer } from '../../components/LivePlayer';
import { getLiveRoomDetail, getLiveStreamUrl } from '../../services/api';
import type { LiveRoomDetail, LiveAnchorInfo, LiveStreamInfo } from '../../services/types';

export default function LiveScreen() {
  const { roomId: roomIdParam } = useLocalSearchParams<{ roomId: string }>();
  const roomId = Number(roomIdParam);

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<LiveRoomDetail | null>(null);
  const [anchor, setAnchor] = useState<LiveAnchorInfo | null>(null);
  const [streamInfo, setStreamInfo] = useState<LiveStreamInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRoom = async (qn = 150) => {
    try {
      const [detail, stream] = await Promise.all([
        getLiveRoomDetail(roomId),
        getLiveStreamUrl(roomId, qn),
      ]);
      setRoom(detail.room);
      setAnchor(detail.anchor);
      setStreamInfo(stream);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoom();
  }, [roomId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fb7299" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root}>
      {streamInfo && (
        <LivePlayer
          roomId={roomId}
          streamInfo={streamInfo}
          onQualityChange={(qn) => loadRoom(qn)}
        />
      )}

      {/* Room info */}
      <View style={styles.meta}>
        <View style={styles.anchorRow}>
          <Text style={styles.anchorName}>{anchor?.uname}</Text>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </View>
        <Text style={styles.roomTitle}>{room?.title}</Text>
        {room?.online != null && (
          <Text style={styles.online}>{room.online.toLocaleString()} 人观看</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#ff6b6b', fontSize: 14, textAlign: 'center', padding: 24 },
  meta: { padding: 16 },
  anchorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  anchorName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  liveBadge: {
    backgroundColor: '#ff4444',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  roomTitle: { color: '#ccc', fontSize: 14, marginTop: 6 },
  online: { color: '#888', fontSize: 12, marginTop: 4 },
});
