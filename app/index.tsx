/**
 * Home screen – demonstrates the video player with demo content.
 *
 * Shows two tabs:
 *   • VOD  – sample MP4 / HLS / DASH playback
 *   • Live – sample live stream with danmaku
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

// ─── Demo content ─────────────────────────────────────────────────────────────

const DEMO_STREAMS = [
  {
    label: 'MP4 (Big Buck Bunny)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    format: 'mp4',
  },
  {
    label: 'HLS (m3u8)',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
    format: 'hls',
  },
  {
    label: 'DASH (mpd)',
    url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
    format: 'dash',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const [customUrl, setCustomUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'demo' | 'bilibili' | 'live'>('demo');
  const [bvidInput, setBvidInput] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');

  const openDemo = (url: string) => {
    router.push({ pathname: '/player/[bvid]', params: { bvid: '__demo__', demoUrl: url } });
  };

  const openBilibili = () => {
    const bvid = bvidInput.trim();
    if (!bvid) { Alert.alert('请输入 BV 号'); return; }
    router.push({ pathname: '/player/[bvid]', params: { bvid } });
  };

  const openLive = () => {
    const roomId = roomIdInput.trim();
    if (!roomId || isNaN(Number(roomId))) { Alert.alert('请输入直播间号'); return; }
    router.push({ pathname: '/live/[roomId]', params: { roomId } });
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Tab bar */}
      <View style={styles.tabs}>
        {(['demo', 'bilibili', 'live'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'demo' ? '演示' : t === 'bilibili' ? 'Bilibili' : '直播'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Demo tab */}
      {activeTab === 'demo' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>演示流</Text>
          {DEMO_STREAMS.map((s) => (
            <TouchableOpacity key={s.label} style={styles.card} onPress={() => openDemo(s.url)}>
              <Text style={styles.cardFormat}>{s.format.toUpperCase()}</Text>
              <Text style={styles.cardLabel}>{s.label}</Text>
            </TouchableOpacity>
          ))}

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>自定义 URL</Text>
          <TextInput
            style={styles.input}
            placeholder="输入视频 URL（mp4 / m3u8 / mpd / flv）"
            placeholderTextColor="#666"
            value={customUrl}
            onChangeText={setCustomUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => customUrl.trim() && openDemo(customUrl.trim())}
          >
            <Text style={styles.primaryBtnText}>播放</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bilibili tab */}
      {activeTab === 'bilibili' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bilibili 视频</Text>
          <Text style={styles.hint}>
            需要登录并持有 SESSDATA。在 services/api.ts 中实现真实 API 调用。
          </Text>
          <TextInput
            style={styles.input}
            placeholder="BV 号，如 BV1GJ411x7h7"
            placeholderTextColor="#666"
            value={bvidInput}
            onChangeText={setBvidInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={openBilibili}>
            <Text style={styles.primaryBtnText}>播放</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Live tab */}
      {activeTab === 'live' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>直播间</Text>
          <Text style={styles.hint}>输入 Bilibili 直播间号，实时弹幕通过 WebSocket 拉取。</Text>
          <TextInput
            style={styles.input}
            placeholder="直播间号，如 21452505"
            placeholderTextColor="#666"
            value={roomIdInput}
            onChangeText={setRoomIdInput}
            keyboardType="number-pad"
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={openLive}>
            <Text style={styles.primaryBtnText}>进入直播间</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Feature list */}
      <View style={styles.featureBox}>
        <Text style={styles.featureTitle}>功能特性</Text>
        {[
          '✅  MP4 / HLS / FLV / DASH 多格式播放',
          '✅  实时弹幕（WebSocket + 5 轨道滚动）',
          '✅  WBI 签名（Bilibili 接口鉴权）',
          '✅  直播流播放（HLS + FLV 自适应）',
          '✅  全屏 + 横竖屏切换',
          '✅  画质切换',
          '✅  弹幕开关',
          '✅  Zustand 全局状态管理',
        ].map((f) => (
          <Text key={f} style={styles.featureItem}>{f}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { paddingBottom: 40 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#222' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#fb7299' },
  tabText: { color: '#888', fontSize: 14 },
  tabTextActive: { color: '#fb7299', fontWeight: '600' },
  section: { padding: 16 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  hint: { color: '#888', fontSize: 12, marginBottom: 12, lineHeight: 18 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  cardFormat: {
    color: '#fb7299',
    fontWeight: '700',
    fontSize: 12,
    width: 50,
    marginRight: 10,
  },
  cardLabel: { color: '#ddd', fontSize: 14, flex: 1 },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  primaryBtn: {
    backgroundColor: '#fb7299',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  featureBox: {
    margin: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 16,
  },
  featureTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 10 },
  featureItem: { color: '#bbb', fontSize: 13, paddingVertical: 4 },
});
