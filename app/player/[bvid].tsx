/**
 * Player screen – VOD playback.
 *
 * Route params:
 *   bvid      – Bilibili BV identifier (or "__demo__" for raw URL demos)
 *   demoUrl   – direct stream URL when bvid === "__demo__"
 *   cid       – optional pre-resolved cid
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { VideoPlayer } from '../../components/VideoPlayer';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';
import { getVideoDetail } from '../../services/api';
import type { VideoItem, PlayUrlResponse } from '../../services/types';

// ─── Demo mode ────────────────────────────────────────────────────────────────

function demoPlayData(url: string): PlayUrlResponse {
  return {
    quality: 80,
    accept_quality: [80],
    accept_description: ['高清 720P'],
    durl: [{ url }],
    format: url.endsWith('.mpd') ? 'dash' : url.endsWith('.m3u8') ? 'hls' : url.endsWith('.flv') ? 'flv' : 'mp4',
  };
}

// ─── Bilibili mode ────────────────────────────────────────────────────────────

function BilibiliPlayer({ bvid, cid: cidParam }: { bvid: string; cid?: number }) {
  const [videoItem, setVideoItem] = useState<VideoItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [cid, setCid] = useState(cidParam ?? 0);

  useEffect(() => {
    getVideoDetail(bvid)
      .then((item) => {
        setVideoItem(item);
        if (!cidParam) setCid(item.cid ?? item.pages?.[0]?.cid ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bvid]);

  const { playData, danmakus, currentQn, qualities, changeQuality, setCurrentTime } =
    useVideoPlayer({ bvid, cid, initialQn: 80 });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fb7299" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root}>
      <VideoPlayer
        playData={playData}
        qualities={qualities}
        currentQn={currentQn}
        onQualityChange={changeQuality}
        bvid={bvid}
        cid={cid}
        danmakus={danmakus}
        onTimeUpdate={setCurrentTime}
      />

      {videoItem && (
        <View style={styles.meta}>
          <Text style={styles.title}>{videoItem.title}</Text>
          <Text style={styles.uploader}>{videoItem.owner.name}</Text>
          {videoItem.desc ? <Text style={styles.desc}>{videoItem.desc}</Text> : null}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PlayerScreen() {
  const { bvid, demoUrl, cid } = useLocalSearchParams<{
    bvid: string;
    demoUrl?: string;
    cid?: string;
  }>();

  if (bvid === '__demo__' && demoUrl) {
    const playData = demoPlayData(demoUrl);
    return (
      <ScrollView style={styles.root}>
        <VideoPlayer
          playData={playData}
          qualities={[]}
          currentQn={80}
          onQualityChange={() => {}}
        />
        <View style={styles.meta}>
          <Text style={styles.title}>演示流</Text>
          <Text style={styles.desc} numberOfLines={2}>{demoUrl}</Text>
        </View>
      </ScrollView>
    );
  }

  return <BilibiliPlayer bvid={bvid} cid={cid ? Number(cid) : undefined} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  meta: { padding: 16 },
  title: { color: '#fff', fontSize: 17, fontWeight: '600', lineHeight: 24 },
  uploader: { color: '#888', fontSize: 13, marginTop: 6 },
  desc: { color: '#aaa', fontSize: 13, marginTop: 8, lineHeight: 20 },
});
