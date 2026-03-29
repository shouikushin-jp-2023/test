import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LivePlayer, type LiveRoomDetail, type LiveAnchorInfo, type LiveStreamInfo } from 'react-native-video-suite';
import { getLiveRoomDetail, getLiveStreamUrl } from '../../services/api';

export default function LiveScreen() {
  const { roomId: roomIdParam } = useLocalSearchParams<{ roomId: string }>();
  const roomId = Number(roomIdParam);

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<LiveRoomDetail | null>(null);
  const [anchor, setAnchor] = useState<LiveAnchorInfo | null>(null);
  const [streamInfo, setStreamInfo] = useState<LiveStreamInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (qn = 150) => {
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

  useEffect(() => { load(); }, [roomId]);

  if (loading) return <View style={s.center}><ActivityIndicator color="#fb7299" size="large" /></View>;
  if (error) return <View style={s.center}><Text style={s.err}>{error}</Text></View>;

  return (
    <ScrollView style={s.root}>
      {streamInfo && (
        <LivePlayer
          roomId={roomId}
          streamInfo={streamInfo}
          onQualityChange={(qn) => load(qn)}
        />
      )}
      <View style={s.meta}>
        <View style={s.row}>
          <Text style={s.uname}>{anchor?.uname}</Text>
          <View style={s.badge}><Text style={s.badgeTxt}>LIVE</Text></View>
        </View>
        <Text style={s.title}>{room?.title}</Text>
        {room?.online != null && (
          <Text style={s.online}>{room.online.toLocaleString()} 人观看</Text>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  err: { color: '#ff6b6b', fontSize: 14, textAlign: 'center', padding: 24 },
  meta: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  uname: { color: '#fff', fontSize: 16, fontWeight: '700' },
  badge: { backgroundColor: '#ff4444', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '900' },
  title: { color: '#ccc', fontSize: 14, marginTop: 6 },
  online: { color: '#888', fontSize: 12, marginTop: 4 },
});
