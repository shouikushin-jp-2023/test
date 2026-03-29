import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';

const DEMO_STREAMS = [
  { label: 'Big Buck Bunny (MP4)',  format: 'MP4',  url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
  { label: 'Apple HLS (m3u8)',      format: 'HLS',  url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8' },
  { label: 'Akamai DASH (mpd)',     format: 'DASH', url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd' },
];

type Tab = 'demo' | 'bilibili' | 'live';

export default function HomeScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('demo');
  const [customUrl, setCustomUrl] = useState('');
  const [bvid, setBvid] = useState('');
  const [roomId, setRoomId] = useState('');

  const openDemo = (url: string) =>
    router.push({ pathname: '/player/[bvid]', params: { bvid: '__demo__', demoUrl: url } });

  const openBilibili = () => {
    const v = bvid.trim();
    if (!v) { Alert.alert('请输入 BV 号'); return; }
    router.push({ pathname: '/player/[bvid]', params: { bvid: v } });
  };

  const openLive = () => {
    const id = roomId.trim();
    if (!id || isNaN(Number(id))) { Alert.alert('请输入直播间号'); return; }
    router.push({ pathname: '/live/[roomId]', params: { roomId: id } });
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Tabs */}
      <View style={styles.tabs}>
        {(['demo', 'bilibili', 'live'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabOn]} onPress={() => setTab(t)}>
            <Text style={[styles.tabTxt, tab === t && styles.tabTxtOn]}>
              {t === 'demo' ? '演示' : t === 'bilibili' ? 'Bilibili' : '直播'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'demo' && (
        <View style={styles.sec}>
          <Text style={styles.heading}>演示流</Text>
          {DEMO_STREAMS.map((s) => (
            <TouchableOpacity key={s.label} style={styles.card} onPress={() => openDemo(s.url)}>
              <Text style={styles.fmt}>{s.format}</Text>
              <Text style={styles.label}>{s.label}</Text>
            </TouchableOpacity>
          ))}

          <Text style={[styles.heading, { marginTop: 20 }]}>自定义 URL</Text>
          <TextInput style={styles.input} placeholder="mp4 / m3u8 / mpd / flv URL" placeholderTextColor="#666"
            value={customUrl} onChangeText={setCustomUrl} autoCapitalize="none" autoCorrect={false} />
          <TouchableOpacity style={styles.btn} onPress={() => customUrl.trim() && openDemo(customUrl.trim())}>
            <Text style={styles.btnTxt}>播放</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'bilibili' && (
        <View style={styles.sec}>
          <Text style={styles.heading}>Bilibili 视频</Text>
          <TextInput style={styles.input} placeholder="BV 号，如 BV1GJ411x7h7" placeholderTextColor="#666"
            value={bvid} onChangeText={setBvid} autoCapitalize="none" autoCorrect={false} />
          <TouchableOpacity style={styles.btn} onPress={openBilibili}>
            <Text style={styles.btnTxt}>播放</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'live' && (
        <View style={styles.sec}>
          <Text style={styles.heading}>直播间</Text>
          <TextInput style={styles.input} placeholder="直播间号，如 21452505" placeholderTextColor="#666"
            value={roomId} onChangeText={setRoomId} keyboardType="number-pad" />
          <TouchableOpacity style={styles.btn} onPress={openLive}>
            <Text style={styles.btnTxt}>进入直播间</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.featureBox}>
        <Text style={styles.featureTitle}>react-native-video-suite 功能</Text>
        {[
          '✅  MP4 / HLS / FLV / DASH 多格式播放',
          '✅  实时弹幕（WebSocket · 5 轨道滚动）',
          '✅  WBI 签名（无需外部依赖）',
          '✅  直播流（HLS + FLV 自适应）',
          '✅  全屏 / 横竖屏锁定',
          '✅  画质切换',
          '✅  弹幕开关',
        ].map((f) => (
          <Text key={f} style={styles.featureItem}>{f}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f0f' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#222' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabOn: { borderBottomWidth: 2, borderBottomColor: '#fb7299' },
  tabTxt: { color: '#888', fontSize: 14 },
  tabTxtOn: { color: '#fb7299', fontWeight: '600' },
  sec: { padding: 16 },
  heading: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 8, padding: 14, marginBottom: 10 },
  fmt: { color: '#fb7299', fontWeight: '700', fontSize: 12, width: 50, marginRight: 10 },
  label: { color: '#ddd', fontSize: 14, flex: 1 },
  input: { backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12, color: '#fff', fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  btn: { backgroundColor: '#fb7299', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  featureBox: { margin: 16, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 16 },
  featureTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 10 },
  featureItem: { color: '#bbb', fontSize: 13, paddingVertical: 4 },
});
