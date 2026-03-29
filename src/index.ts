// Components
export { VideoPlayer } from './components/VideoPlayer';
export { NativeVideoPlayer } from './components/NativeVideoPlayer';
export { LivePlayer } from './components/LivePlayer';
export { default as DanmakuOverlay } from './components/DanmakuOverlay';

// Hooks
export { useVideoPlayer } from './hooks/useVideoPlayer';
export { useLiveDanmaku } from './hooks/useLiveDanmaku';

// Stores
export { useVodStore, useLiveStore, useAuthStore } from './store/playerStore';

// Utilities
export { parseDanmakuXml, danmakuColorToCss } from './utils/danmaku';
export { buildMpdXml, buildDashMpdUri } from './utils/dash';
export { signWbi, getMixinKey, extractWbiKeys, md5 } from './utils/wbi';
export { formatDuration, formatViews } from './utils/format';

// Types
export type {
  VideoItem,
  VideoPage,
  VideoOwner,
  VideoQuality,
  PlayUrlResponse,
  DurlItem,
  DashData,
  DashVideoItem,
  DashAudioItem,
  DanmakuItem,
  Comment,
  CommentAuthor,
  LiveRoom,
  LiveRoomDetail,
  LiveAnchorInfo,
  LiveStreamInfo,
  LiveStreamQuality,
  LiveDanmakuMessage,
  SearchResult,
  SearchSuggestItem,
  HotSearchItem,
  QRCodeData,
  QRPollResult,
  UserInfo,
  WbiKeys,
} from './types';

export type { VideoPlayerProps } from './components/VideoPlayer';
export type { NativeVideoPlayerProps, NativeVideoPlayerRef } from './components/NativeVideoPlayer';
export type { LivePlayerProps } from './components/LivePlayer';
export type { DanmakuOverlayProps } from './components/DanmakuOverlay';
