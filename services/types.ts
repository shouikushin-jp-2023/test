// ─── Video ───────────────────────────────────────────────────────────────────

export interface VideoOwner {
  uid: number;
  name: string;
  avatar: string;
}

export interface VideoItem {
  bvid: string;
  aid: number;
  title: string;
  desc: string;
  pic: string;
  owner: VideoOwner;
  duration: number;
  /** view count */
  view?: number;
  like?: number;
  coin?: number;
  favorite?: number;
  reply?: number;
  cid?: number;
  /** multi-part pages */
  pages?: VideoPage[];
  isLive?: boolean;
}

export interface VideoPage {
  cid: number;
  page: number;
  part: string;
  duration: number;
}

// ─── Playback ─────────────────────────────────────────────────────────────────

export interface DurlItem {
  url: string;
  backup_url?: string[];
  size?: number;
  length?: number;
}

export interface DashVideoItem {
  id: number;
  baseUrl: string;
  base_url?: string;
  backupUrl?: string[];
  bandwidth: number;
  mimeType: string;
  codecs: string;
  width: number;
  height: number;
  frameRate: string;
  sar?: string;
  startWithSap?: number;
  segmentBase?: { initialization: string; indexRange: string };
}

export interface DashAudioItem {
  id: number;
  baseUrl: string;
  base_url?: string;
  backupUrl?: string[];
  bandwidth: number;
  mimeType: string;
  codecs: string;
  segmentBase?: { initialization: string; indexRange: string };
}

export interface DashData {
  duration: number;
  video: DashVideoItem[];
  audio: DashAudioItem[];
  dolby?: { type: number; audio?: DashAudioItem[] };
  flac?: { display?: boolean; audio?: DashAudioItem };
}

export interface PlayUrlResponse {
  /** quality number of the current stream */
  quality: number;
  /** accepted quality numbers */
  accept_quality: number[];
  /** quality descriptions */
  accept_description: string[];
  /** progressive download (non-DASH) */
  durl?: DurlItem[];
  /** DASH streams */
  dash?: DashData;
  /** video format: mp4 | flv | dash */
  format?: string;
}

export interface VideoQuality {
  qn: number;
  desc: string;
}

// ─── Danmaku ──────────────────────────────────────────────────────────────────

/** mode 1=scrolling  4=bottom-fixed  5=top-fixed */
export interface DanmakuItem {
  time: number;
  mode: 1 | 4 | 5;
  fontSize: number;
  color: number;
  text: string;
  uid?: number;
  isAdmin?: boolean;
  badgeLevel?: number;
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export interface CommentAuthor {
  uid: number;
  name: string;
  avatar: string;
  level: number;
}

export interface Comment {
  rpid: number;
  content: { message: string };
  author: CommentAuthor;
  like: number;
  ctime: number;
  replies?: Comment[];
}

// ─── Live ─────────────────────────────────────────────────────────────────────

export interface LiveRoom {
  roomId: number;
  uid: number;
  title: string;
  coverUrl: string;
  keyframe: string;
  online: number;
  uname: string;
  uface: string;
  areaName: string;
  parentAreaName: string;
  liveStatus: 0 | 1;
}

export interface LiveRoomDetail {
  roomId: number;
  uid: number;
  title: string;
  description: string;
  coverUrl: string;
  keyframe: string;
  online: number;
  liveStatus: 0 | 1;
  liveStartTime?: number;
}

export interface LiveAnchorInfo {
  uid: number;
  uname: string;
  uface: string;
  follower: number;
}

export interface LiveStreamQuality {
  qn: number;
  desc: string;
}

export interface LiveStreamInfo {
  /** HLS stream URL */
  hls?: string;
  /** FLV stream URL */
  flv?: string;
  qualities: LiveStreamQuality[];
  currentQn: number;
}

// ─── Live Danmaku (WebSocket) ─────────────────────────────────────────────────

export type LiveDanmakuMessage =
  | { type: 'danmaku'; uid: number; uname: string; text: string; color: number; badge?: string; badgeLevel?: number }
  | { type: 'gift'; uname: string; giftName: string; num: number; coinType: string }
  | { type: 'superchat'; uname: string; message: string; price: number }
  | { type: 'enter'; uname: string }
  | { type: 'online'; count: number };

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchSuggestItem {
  value: string;
  ref: number;
  name: string;
  spid: number;
}

export interface HotSearchItem {
  keyword: string;
  hot_id: number;
  position: number;
}

export interface SearchResult {
  videos: VideoItem[];
  numResults: number;
  numPages: number;
  page: number;
}

// ─── Video Thumbnail Sprites ──────────────────────────────────────────────────

export interface VideoShotData {
  imgX: number;
  imgY: number;
  imgXLen: number;
  imgYLen: number;
  xLen: number;
  yLen: number;
  pvData: number[];
  images: string[];
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface QRCodeData {
  url: string;
  qrcode_key: string;
}

export interface QRPollResult {
  status: 'expired' | 'not_scanned' | 'scanned' | 'confirmed';
  sessdata?: string;
  bili_jct?: string;
}

export interface UserInfo {
  uid: number;
  uname: string;
  face: string;
  level: number;
  isLogin: boolean;
}
