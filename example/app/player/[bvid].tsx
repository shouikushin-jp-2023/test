import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  VideoPlayer, useVideoPlayer,
  type PlayUrlResponse, type VideoItem,
} from 'react-native-video-suite';
import { getVideoDetail, getPlayUrl, getDanmaku, getVideoQualities } from '../../services/api';

function demoPlayData(url: string): PlayUrlResponse {
  return {
    quality: 80,
    accept_quality: [80],
    accept_description: ['默认'],
    durl: [{ url }],
    format: url.endsWith('.mpd') ? 'dash' : url.endsWith('.m3u8') ? 'hls' : url.endsWith('.flv') ? 'flv' : 'mp4',
  };
}

function BilibiliPlayer({ bvid, cidParam }: { bvid: string; cidParam?: number }) {
  const [info, setInfo] = useState<VideoItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [cid, setCid] = useState(cidParam ?? 0);

  useEffect(() => {
    getVideoDetail(bvid)
      .then((v) => { setInfo(v); if (!cidParam) setCid(v.cid ?? v.pages?.[0]?.cid ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bvid]);

  const { playData, danmakus, currentQn, qualities, changeQuality, setCurrentTime } =
    useVideoPlayer({
      videoKey: `${bvid}_${cid}`,
      initialQn: 80,
      fetchPlayUrl: (qn) => getPlayUrl(bvid, cid, qn),
      fetchDanmaku: () => getDanmaku(cid),
      getQualities: getVideoQualities,
    });

  if (loading) return <View style={s.center}><ActivityIndicator color="#fb7299" /></View>;

  return (
    <ScrollView style={s.root}>
      <VideoPlayer
        playData={playData}
        qualities={qualities}
        currentQn={currentQn}
        onQualityChange={changeQuality}
        danmakus={danmakus}
        onTimeUpdate={setCurrentTime}
      />
      {info && (
        <View style={s.meta}>
          <Text style={s.title}>{info.title}</Text>
          <Text style={s.sub}>{info.owner.name}</Text>
          {info.desc ? <Text style={s.desc}>{info.desc}</Text> : null}
        </View>
      )}
    </ScrollView>
  );
}

export default function PlayerScreen() {
  const { bvid, demoUrl, cid } = useLocalSearchParams<{ bvid: string; demoUrl?: string; cid?: string }>();

  if (bvid === '__demo__' && demoUrl) {
    return (
      <ScrollView style={s.root}>
        <VideoPlayer
          playData={demoPlayData(demoUrl)}
          qualities={[]}
          currentQn={80}
          onQualityChange={() => {}}
        />
        <View style={s.meta}>
          <Text style={s.title}>演示流</Text>
          <Text style={s.desc} numberOfLines={2}>{demoUrl}</Text>
        </View>
      </ScrollView>
    );
  }

  return <BilibiliPlayer bvid={bvid} cidParam={cid ? Number(cid) : undefined} />;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  meta: { padding: 16 },
  title: { color: '#fff', fontSize: 17, fontWeight: '600', lineHeight: 24 },
  sub: { color: '#888', fontSize: 13, marginTop: 6 },
  desc: { color: '#aaa', fontSize: 13, marginTop: 8, lineHeight: 20 },
});
