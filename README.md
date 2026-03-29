# react-native-video-suite

> Expo / React Native 视频播放器组件库，支持 MP4、HLS (m3u8)、FLV、DASH 多格式播放，内置实时弹幕（WebSocket）、WBI 签名、直播流等功能。

[![npm version](https://img.shields.io/npm/v/react-native-video-suite)](https://www.npmjs.com/package/react-native-video-suite)
[![license](https://img.shields.io/npm/l/react-native-video-suite)](LICENSE)
[![platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS%20%7C%20Web-blue)](#)

---

## 目录

- [功能特性](#功能特性)
- [安装](#安装)
- [快速开始](#快速开始)
- [组件](#组件)
  - [VideoPlayer](#videoplayer)
  - [LivePlayer](#liveplayer)
  - [DanmakuOverlay](#danmakuoverlay)
  - [NativeVideoPlayer](#nativevideoplayer)
- [Hooks](#hooks)
  - [useVideoPlayer](#usevideoplayer)
  - [useLiveDanmaku](#uselivedanmaku)
- [工具函数](#工具函数)
  - [WBI 签名](#wbi-签名)
  - [弹幕解析](#弹幕解析)
  - [DASH MPD 构建](#dash-mpd-构建)
  - [格式化](#格式化)
- [状态管理（Store）](#状态管理store)
- [类型定义](#类型定义)
- [Peer Dependencies](#peer-dependencies)
- [示例应用](#示例应用)
- [注意事项](#注意事项)
- [License](#license)

---

## 功能特性

| 功能 | 说明 |
|------|------|
| **MP4** | 直接 HTTP/HTTPS 播放 |
| **HLS (m3u8)** | 自适应码率流，iOS AVPlayer / Android ExoPlayer |
| **FLV** | ExoPlayer 原生支持（Android），常用于直播 |
| **DASH** | 将服务端返回的 DASH 数据构建为本地 `.mpd` 文件，支持 4K / HDR / Dolby |
| **实时弹幕** | WebSocket 连接，5 轨道滚动动画，zlib 解压，支持礼物 / SuperChat |
| **VOD 弹幕** | XML 解析，按视频时间轴同步渲染 |
| **WBI 签名** | 内置完整实现（混淆密钥推导 + MD5），无额外依赖 |
| **直播流** | iOS 优先 HLS，Android 优先 FLV，画质切换 |
| **全屏** | `expo-screen-orientation` 横屏锁定，无法使用时自动 CSS 旋转降级 |
| **画质切换** | 切换时保留当前播放时间 |
| **弹幕开关** | 可随时开/关弹幕覆盖层 |
| **Zustand Store** | VOD / 直播 / 认证三个独立 store |

---

## 安装

```bash
# npm
npm install react-native-video-suite

# yarn
yarn add react-native-video-suite

# pnpm
pnpm add react-native-video-suite
```

### 安装 Peer Dependencies

```bash
npx expo install \
  react-native-video \
  expo-file-system \
  expo-screen-orientation \
  pako \
  zustand
```

> `expo-screen-orientation` 和 `pako` 为可选依赖：
> - 不安装 `expo-screen-orientation` 时，全屏会降级为 CSS `rotate(90deg)` 实现。
> - 不安装 `pako` 时，WebSocket 直播弹幕的 zlib 压缩包会被跳过（普通文本弹幕仍然正常）。

### Expo Dev Build（必须）

DASH 播放和 FLV 直播需要 **Expo Dev Build**（不支持 Expo Go）：

```bash
npx expo run:android
# 或
npx expo run:ios
```

---

## 快速开始

### 播放一个 MP4 / HLS / DASH 视频

```tsx
import React from 'react';
import { ScrollView } from 'react-native';
import { VideoPlayer, useVideoPlayer } from 'react-native-video-suite';

export default function PlayerScreen() {
  const { playData, danmakus, currentQn, qualities, changeQuality, setCurrentTime } =
    useVideoPlayer({
      videoKey: 'my-video-001',
      initialQn: 80,
      fetchPlayUrl: async (qn) => {
        // 替换为你自己的接口
        const res = await fetch(`https://your-api.com/play?id=001&qn=${qn}`);
        return res.json();
      },
      fetchDanmaku: async () => {
        const res = await fetch('https://your-api.com/danmaku?id=001');
        return res.text(); // 返回 XML 字符串，或直接返回 DanmakuItem[]
      },
      getQualities: (playData) =>
        playData.accept_quality.map((qn, i) => ({
          qn,
          desc: playData.accept_description[i],
        })),
    });

  return (
    <ScrollView>
      <VideoPlayer
        playData={playData}
        qualities={qualities}
        currentQn={currentQn}
        onQualityChange={changeQuality}
        danmakus={danmakus}
        onTimeUpdate={setCurrentTime}
      />
    </ScrollView>
  );
}
```

### 播放直播流（含实时弹幕）

```tsx
import React from 'react';
import { ScrollView } from 'react-native';
import { LivePlayer } from 'react-native-video-suite';

const streamInfo = {
  hls: 'https://your-live-server.com/live/room123.m3u8',
  flv: 'https://your-live-server.com/live/room123.flv',
  qualities: [
    { qn: 150, desc: '蓝光' },
    { qn: 80,  desc: '高清' },
  ],
  currentQn: 150,
};

export default function LiveScreen() {
  return (
    <ScrollView>
      <LivePlayer
        roomId={123}
        streamInfo={streamInfo}
        onQualityChange={(qn) => console.log('切换画质', qn)}
      />
    </ScrollView>
  );
}
```

---

## 组件

### VideoPlayer

顶层 VOD 播放器。自动处理竖屏 / 全屏模式切换，同一时间只挂载一个解码器。

```tsx
import { VideoPlayer } from 'react-native-video-suite';

<VideoPlayer
  playData={playData}         // PlayUrlResponse | null，为 null 时显示加载占位
  qualities={qualities}       // VideoQuality[]
  currentQn={currentQn}       // number
  onQualityChange={changeQuality}  // (qn: number) => void
  danmakus={danmakus}         // DanmakuItem[]（可选）
  onTimeUpdate={setCurrentTime}    // (seconds: number) => void（可选）
/>
```

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `playData` | `PlayUrlResponse \| null` | ✅ | 播放地址数据 |
| `qualities` | `VideoQuality[]` | ✅ | 可选画质列表 |
| `currentQn` | `number` | ✅ | 当前画质 qn 值 |
| `onQualityChange` | `(qn: number) => void` | ✅ | 画质切换回调 |
| `danmakus` | `DanmakuItem[]` | — | VOD 弹幕列表 |
| `onTimeUpdate` | `(seconds: number) => void` | — | 播放进度回调 |

---

### LivePlayer

直播播放器，内部自动连接 WebSocket 弹幕。

```tsx
import { LivePlayer } from 'react-native-video-suite';

<LivePlayer
  roomId={21452505}           // 直播间 ID
  streamInfo={streamInfo}     // LiveStreamInfo
  uid={0}                     // 用户 UID，0 为匿名（可选）
  onQualityChange={(qn) => reloadStream(qn)}  // 可选
/>
```

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `roomId` | `number` | ✅ | 直播间 ID，用于 WebSocket 认证 |
| `streamInfo` | `LiveStreamInfo` | ✅ | 含 hls/flv URL 及画质列表 |
| `uid` | `number` | — | 用户 UID（默认 0，匿名） |
| `onQualityChange` | `(qn: number) => void` | — | 画质切换回调 |

**LiveStreamInfo 结构：**

```ts
interface LiveStreamInfo {
  hls?: string;          // HLS 地址（m3u8）
  flv?: string;          // FLV 地址
  qualities: { qn: number; desc: string }[];
  currentQn: number;
}
```

---

### DanmakuOverlay

弹幕覆盖层，可独立使用在任意视频组件上。

```tsx
import { DanmakuOverlay } from 'react-native-video-suite';

<DanmakuOverlay
  danmakus={danmakus}         // DanmakuItem[]
  currentTime={currentTime}   // number（VOD 当前播放时间，秒）
  screenWidth={screenWidth}   // number
  screenHeight={screenHeight} // number
  visible={showDanmaku}       // boolean
  liveMode={false}            // 直播模式时传 true
/>
```

| Prop | 类型 | 默认 | 说明 |
|------|------|------|------|
| `danmakus` | `DanmakuItem[]` | — | 弹幕数据 |
| `currentTime` | `number` | — | 当前播放时间（VOD 模式使用） |
| `screenWidth` | `number` | — | 视频宽度（px） |
| `screenHeight` | `number` | — | 视频高度（px） |
| `visible` | `boolean` | — | 是否显示 |
| `liveMode` | `boolean` | `false` | `true`=直播（立即渲染新弹幕），`false`=VOD（按时间轴触发） |

---

### NativeVideoPlayer

底层原生播放器，已通过 `VideoPlayer` 封装，一般不需要直接使用。支持通过 `ref` 调用 `seek` / `setPaused`。

```tsx
import { NativeVideoPlayer, type NativeVideoPlayerRef } from 'react-native-video-suite';

const ref = useRef<NativeVideoPlayerRef>(null);

// 跳转到 30 秒
ref.current?.seek(30);

// 暂停
ref.current?.setPaused(true);

<NativeVideoPlayer
  ref={ref}
  playData={playData}
  qualities={qualities}
  currentQn={80}
  onQualityChange={changeQuality}
  onFullscreen={handleFullscreen}
  isFullscreen={false}
  initialTime={0}
  onTimeUpdate={(t) => console.log(t)}
  style={{ width: 375, height: 211 }}
/>
```

---

## Hooks

### useVideoPlayer

管理 VOD 视频的播放数据、弹幕加载和画质切换。与任何 API 解耦，通过回调注入数据。

```tsx
import { useVideoPlayer } from 'react-native-video-suite';

const {
  playData,        // PlayUrlResponse | null
  danmakus,        // DanmakuItem[]
  currentQn,       // number
  currentTime,     // number
  showDanmaku,     // boolean
  qualities,       // VideoQuality[]
  changeQuality,   // (qn: number) => void
  setCurrentTime,  // (t: number) => void
  toggleDanmaku,   // () => void
} = useVideoPlayer({
  videoKey: 'unique-video-id',   // 改变时触发全量重新加载
  initialQn: 80,
  fetchPlayUrl: async (qn) => { /* 返回 PlayUrlResponse */ },
  fetchDanmaku:  async ()  => { /* 返回 XML 字符串 或 DanmakuItem[] */ },
  getQualities:  (playData) => { /* 返回 VideoQuality[] */ },
});
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `videoKey` | `string` | ✅ | 视频唯一标识，变化时重新拉取所有数据 |
| `initialQn` | `number` | — | 初始画质（默认 80） |
| `fetchPlayUrl` | `(qn: number) => Promise<PlayUrlResponse>` | ✅ | 拉取播放地址 |
| `fetchDanmaku` | `() => Promise<DanmakuItem[] \| string>` | — | 拉取弹幕（XML 字符串或已解析数组） |
| `getQualities` | `(p: PlayUrlResponse) => VideoQuality[]` | — | 从播放数据中提取画质列表 |

---

### useLiveDanmaku

连接直播 WebSocket，将收到的弹幕写入 `useLiveStore`。由 `LivePlayer` 内部调用，也可单独使用。

```tsx
import { useLiveDanmaku, useLiveStore } from 'react-native-video-suite';

// 在组件中连接
useLiveDanmaku({
  roomId: 21452505,
  uid: 0,           // 0 = 匿名
  enabled: true,
});

// 读取弹幕
const liveDanmakus = useLiveStore((s) => s.liveDanmakus);
```

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `roomId` | `number` | — | 直播间 ID |
| `uid` | `number` | `0` | 用户 UID |
| `enabled` | `boolean` | `true` | `false` 时不建立连接 |

---

## 工具函数

### WBI 签名

```ts
import { signWbi, extractWbiKeys, getMixinKey, md5 } from 'react-native-video-suite';

// 从 nav 接口响应中提取 key
const { imgKey, subKey } = extractWbiKeys(navData.wbi_img);

// 对参数进行签名，返回含 wts 和 w_rid 的新对象
const signed = signWbi({ mid: 12345, ps: 20 }, imgKey, subKey);
// { mid: '12345', ps: '20', wts: '1710000000', w_rid: 'abc123...' }

// 构建请求 URL
const params = new URLSearchParams(signed).toString();
const url = `https://api.bilibili.com/x/space/wbi/acc/info?${params}`;
```

**函数说明：**

| 函数 | 签名 | 说明 |
|------|------|------|
| `signWbi` | `(params, imgKey, subKey) => Record<string, string>` | 对参数签名，返回含 `wts`、`w_rid` 的对象 |
| `extractWbiKeys` | `(wbiImg) => WbiKeys` | 从 nav 接口的 `wbi_img` 字段中提取 imgKey/subKey |
| `getMixinKey` | `(imgKey, subKey) => string` | 根据置换表推导 32 字符混淆密钥 |
| `md5` | `(s: string) => string` | 纯 JS MD5，无外部依赖 |

---

### 弹幕解析

```ts
import { parseDanmakuXml, danmakuColorToCss } from 'react-native-video-suite';

// 解析 XML 字符串为 DanmakuItem[]（已按时间排序）
const items = parseDanmakuXml(xmlString);

// 颜色数值转 CSS 十六进制字符串
danmakuColorToCss(16776960); // → '#ffff00'
danmakuColorToCss(16777215); // → '#ffffff'
```

---

### DASH MPD 构建

```ts
import { buildMpdXml, buildDashMpdUri } from 'react-native-video-suite';

// 仅生成 XML 字符串（不写文件）
const xml = buildMpdXml(playData, 80);

// 写入 expo-file-system 缓存目录，返回 file:// URI
const uri = await buildDashMpdUri(playData, 80);
// 'file:///data/user/0/com.app/cache/dash_80_1710000000000.mpd'
```

---

### 格式化

```ts
import { formatDuration, formatViews } from 'react-native-video-suite';

formatDuration(125);        // → '02:05'
formatDuration(3725);       // → '1:02:05'

formatViews(9999);          // → '9999'
formatViews(12345);         // → '1.2万'
formatViews(123456789);     // → '1.2亿'
```

---

## 状态管理（Store）

库内置三个 Zustand store，可在任意组件中订阅。

### useVodStore

```ts
import { useVodStore } from 'react-native-video-suite';

const playData    = useVodStore((s) => s.playData);
const showDanmaku = useVodStore((s) => s.showDanmaku);
const toggle      = useVodStore((s) => s.toggleDanmaku);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `playData` | `PlayUrlResponse \| null` | 当前播放数据 |
| `danmakus` | `DanmakuItem[]` | 弹幕列表 |
| `currentQn` | `number` | 当前画质 |
| `currentTime` | `number` | 当前播放时间（秒） |
| `showDanmaku` | `boolean` | 弹幕是否可见 |
| `setPlayData` | `fn` | 设置播放数据 |
| `setDanmakus` | `fn` | 设置弹幕列表 |
| `setCurrentQn` | `fn` | 设置画质 |
| `setCurrentTime` | `fn` | 更新播放时间 |
| `toggleDanmaku` | `fn` | 切换弹幕显示 |
| `reset` | `fn` | 重置所有状态 |

### useLiveStore

```ts
import { useLiveStore } from 'react-native-video-suite';

const liveDanmakus = useLiveStore((s) => s.liveDanmakus);
const isLive       = useLiveStore((s) => s.isLive);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `liveDanmakus` | `DanmakuItem[]` | 实时弹幕列表（最多保留 200 条） |
| `isLive` | `boolean` | 直播是否开播 |
| `showDanmaku` | `boolean` | 弹幕是否可见 |
| `addLiveDanmaku` | `fn` | 追加一条弹幕 |
| `clearLiveDanmakus` | `fn` | 清空弹幕列表 |
| `toggleDanmaku` | `fn` | 切换弹幕显示 |

### useAuthStore

```ts
import { useAuthStore } from 'react-native-video-suite';

const isLogin = useAuthStore((s) => s.isLogin);
const setUser = useAuthStore((s) => s.setUser);

// 登录后写入用户信息
setUser(uid, uname, face);

// 退出登录
useAuthStore.getState().clearUser();
```

---

## 类型定义

常用类型均从主入口导出：

```ts
import type {
  PlayUrlResponse,   // 播放地址（含 durl / dash）
  DashData,          // DASH 流数据
  DanmakuItem,       // 弹幕条目（time / mode / color / text）
  VideoItem,         // 视频元数据
  VideoQuality,      // 画质选项 { qn, desc }
  LiveStreamInfo,    // 直播流信息 { hls?, flv?, qualities, currentQn }
  LiveRoomDetail,    // 直播间详情
  WbiKeys,           // WBI 密钥对 { imgKey, subKey }
} from 'react-native-video-suite';
```

完整类型定义见 [`src/types.ts`](src/types.ts)。

---

## Peer Dependencies

| 包 | 版本要求 | 是否必须 |
|----|---------|---------|
| `react` | `>=18` | ✅ |
| `react-native` | `>=0.73` | ✅ |
| `react-native-video` | `>=6` | ✅ |
| `expo-file-system` | `>=14` | ✅（DASH 写 MPD 文件） |
| `zustand` | `>=4` | ✅ |
| `expo-screen-orientation` | `>=4` | 可选（全屏旋转锁定） |
| `pako` | `>=2` | 可选（WebSocket 弹幕 zlib 解压） |

---

## 示例应用

`example/` 目录包含一个完整的 Expo 应用，演示所有功能：

```bash
cd example
npm install
npx expo run:android   # 或 ios
```

示例应用结构：

```
example/
├── app/
│   ├── index.tsx           # 首页（演示 / Bilibili / 直播 三个 Tab）
│   ├── player/[bvid].tsx   # VOD 播放页
│   └── live/[roomId].tsx   # 直播页
└── services/
    └── api.ts              # Bilibili API 调用层（含 WBI 签名）
```

---

## 注意事项

**DASH 播放**
- 需要 Expo Dev Build，不支持 Expo Go。
- 原理：将服务端返回的 DASH JSON 构建为 `.mpd` 文件写入本地缓存，再由 ExoPlayer / AVPlayer 解码。
- MPD 文件会在 `expo-file-system` 缓存目录生成，应用更新后自动清理。

**FLV 直播**
- Android：ExoPlayer 原生支持 FLV，开箱即用。
- iOS：AVPlayer 不支持 FLV，`LivePlayer` 会自动切换到 HLS 地址。

**弹幕 zlib 解压**
- Bilibili WebSocket 协议版本 2 使用 zlib 压缩。需安装 `pako` 才能解压，否则该版本数据包会被静默跳过（不影响未压缩的数据包）。

**WBI 签名**
- 签名密钥需要从接口 `GET /x/web-interface/nav` 中获取，建议本地缓存 24 小时。
- `signWbi` 内部已自动添加 `wts` 时间戳字段，调用方无需手动添加。

**Web 平台**
- `VideoPlayer` 在 Web 平台会降级为原生 `<video>` 元素，不支持弹幕和 DASH。

---

## License

[MIT](LICENSE)
