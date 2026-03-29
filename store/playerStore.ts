import { create } from 'zustand';
import type { PlayUrlResponse, DanmakuItem, VideoItem, LiveStreamInfo } from '../services/types';

// ─── VOD player state ─────────────────────────────────────────────────────────

interface VodState {
  videoItem: VideoItem | null;
  playData: PlayUrlResponse | null;
  danmakus: DanmakuItem[];
  currentQn: number;
  currentTime: number;
  showDanmaku: boolean;

  setVideoItem: (v: VideoItem | null) => void;
  setPlayData: (p: PlayUrlResponse | null) => void;
  setDanmakus: (d: DanmakuItem[]) => void;
  setCurrentQn: (qn: number) => void;
  setCurrentTime: (t: number) => void;
  toggleDanmaku: () => void;
  reset: () => void;
}

export const useVodStore = create<VodState>((set) => ({
  videoItem: null,
  playData: null,
  danmakus: [],
  currentQn: 80,
  currentTime: 0,
  showDanmaku: true,

  setVideoItem: (videoItem) => set({ videoItem }),
  setPlayData: (playData) => set({ playData }),
  setDanmakus: (danmakus) => set({ danmakus }),
  setCurrentQn: (currentQn) => set({ currentQn }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  toggleDanmaku: () => set((s) => ({ showDanmaku: !s.showDanmaku })),
  reset: () =>
    set({
      videoItem: null,
      playData: null,
      danmakus: [],
      currentQn: 80,
      currentTime: 0,
      showDanmaku: true,
    }),
}));

// ─── Live player state ────────────────────────────────────────────────────────

interface LiveState {
  roomId: number | null;
  streamInfo: LiveStreamInfo | null;
  isLive: boolean;
  /** live danmaku messages rendered as DanmakuItem for the overlay */
  liveDanmakus: DanmakuItem[];
  showDanmaku: boolean;

  setRoomId: (id: number | null) => void;
  setStreamInfo: (info: LiveStreamInfo | null) => void;
  setIsLive: (v: boolean) => void;
  addLiveDanmaku: (d: DanmakuItem) => void;
  clearLiveDanmakus: () => void;
  toggleDanmaku: () => void;
  reset: () => void;
}

const MAX_LIVE_DANMAKUS = 200;

export const useLiveStore = create<LiveState>((set) => ({
  roomId: null,
  streamInfo: null,
  isLive: false,
  liveDanmakus: [],
  showDanmaku: true,

  setRoomId: (roomId) => set({ roomId }),
  setStreamInfo: (streamInfo) => set({ streamInfo }),
  setIsLive: (isLive) => set({ isLive }),
  addLiveDanmaku: (d) =>
    set((s) => {
      const next = [...s.liveDanmakus, d];
      return { liveDanmakus: next.slice(-MAX_LIVE_DANMAKUS) };
    }),
  clearLiveDanmakus: () => set({ liveDanmakus: [] }),
  toggleDanmaku: () => set((s) => ({ showDanmaku: !s.showDanmaku })),
  reset: () =>
    set({
      roomId: null,
      streamInfo: null,
      isLive: false,
      liveDanmakus: [],
      showDanmaku: true,
    }),
}));

// ─── Auth / user state ────────────────────────────────────────────────────────

interface AuthState {
  uid: number | null;
  uname: string;
  face: string;
  isLogin: boolean;

  setUser: (uid: number, uname: string, face: string) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  uid: null,
  uname: '',
  face: '',
  isLogin: false,

  setUser: (uid, uname, face) => set({ uid, uname, face, isLogin: true }),
  clearUser: () => set({ uid: null, uname: '', face: '', isLogin: false }),
}));
