/**
 * API service layer.
 *
 * All functions use axios with a shared instance that automatically injects
 * SESSDATA cookies and WBI-signed parameters where required.
 *
 * Replace the BASE_URL / NAV_URL constants and implement real network calls
 * for production use. The mock implementations here return sample data so the
 * UI can be developed and tested without a live Bilibili session.
 */

import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { signWbi, extractWbiKeys, type WbiKeys } from '../utils/wbi';
import type {
  VideoItem,
  PlayUrlResponse,
  DanmakuItem,
  Comment,
  LiveRoom,
  LiveRoomDetail,
  LiveAnchorInfo,
  LiveStreamInfo,
  SearchResult,
  HotSearchItem,
  SearchSuggestItem,
  QRCodeData,
  QRPollResult,
  UserInfo,
  VideoQuality,
} from './types';
import { parseDanmakuXml } from '../utils/danmaku';

// ─── Axios instance ───────────────────────────────────────────────────────────

const BASE_URL = 'https://api.bilibili.com';

const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Referer: 'https://www.bilibili.com',
  },
});

// inject SESSDATA from secure storage on each request
http.interceptors.request.use(async (config) => {
  const sessdata = await SecureStore.getItemAsync('sessdata');
  if (sessdata) {
    config.headers['Cookie'] = `SESSDATA=${sessdata}`;
  }
  return config;
});

// ─── WBI key cache (24-hour TTL) ──────────────────────────────────────────────

let wbiCache: { keys: WbiKeys; fetchedAt: number } | null = null;

async function getWbiKeys(): Promise<WbiKeys> {
  const now = Date.now();
  if (wbiCache && now - wbiCache.fetchedAt < 24 * 60 * 60 * 1000) {
    return wbiCache.keys;
  }
  const { data } = await http.get('/x/web-interface/nav');
  const keys = extractWbiKeys(data.data.wbi_img);
  wbiCache = { keys, fetchedAt: now };
  return keys;
}

/** Build a signed query string and return as URLSearchParams-ready object */
async function wbiParams(
  params: Record<string, string | number>,
): Promise<Record<string, string>> {
  const { imgKey, subKey } = await getWbiKeys();
  return signWbi(params, imgKey, subKey);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function generateQRCode(): Promise<QRCodeData> {
  const { data } = await http.get(
    '/x/passport-login/web/qrcode/generate',
  );
  return { url: data.data.url, qrcode_key: data.data.qrcode_key };
}

export async function pollQRCode(qrcodeKey: string): Promise<QRPollResult> {
  const { data, headers } = await http.get(
    '/x/passport-login/web/qrcode/poll',
    { params: { qrcode_key: qrcodeKey } },
  );
  const code: number = data.data.code;

  if (code === 86101) return { status: 'not_scanned' };
  if (code === 86090) return { status: 'scanned' };
  if (code === 86038) return { status: 'expired' };

  // code === 0 → confirmed
  const cookies: string[] = (headers['set-cookie'] ?? []) as string[];
  let sessdata: string | undefined;
  let biliJct: string | undefined;
  for (const c of cookies) {
    const sd = /SESSDATA=([^;]+)/.exec(c);
    const bj = /bili_jct=([^;]+)/.exec(c);
    if (sd) sessdata = sd[1];
    if (bj) biliJct = bj[1];
  }
  if (sessdata) await SecureStore.setItemAsync('sessdata', sessdata);
  if (biliJct) await SecureStore.setItemAsync('bili_jct', biliJct);

  return { status: 'confirmed', sessdata, bili_jct: biliJct };
}

export async function getUserInfo(): Promise<UserInfo> {
  const { data } = await http.get('/x/web-interface/nav');
  const d = data.data;
  return {
    uid: d.mid ?? 0,
    uname: d.uname ?? '',
    face: d.face ?? '',
    level: d.level_info?.current_level ?? 0,
    isLogin: d.isLogin ?? false,
  };
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync('sessdata');
  await SecureStore.deleteItemAsync('bili_jct');
}

// ─── Videos ───────────────────────────────────────────────────────────────────

export async function getRecommendFeed(fresh_idx = 0): Promise<VideoItem[]> {
  const params = await wbiParams({ fresh_idx, fresh_type: 3 });
  const { data } = await http.get('/x/web-interface/index/top/rcmd', {
    params,
  });
  return (data.data?.item ?? []).map(mapVideoItem);
}

export async function getPopularVideos(pn = 1, ps = 20): Promise<VideoItem[]> {
  const { data } = await http.get('/x/web-interface/popular', {
    params: { pn, ps },
  });
  return (data.data?.list ?? []).map(mapVideoItem);
}

export async function getVideoDetail(bvid: string): Promise<VideoItem> {
  const params = await wbiParams({ bvid });
  const { data } = await http.get('/x/web-interface/view', { params });
  return mapVideoItem(data.data);
}

export async function getPlayUrl(
  bvid: string,
  cid: number,
  qn = 80,
): Promise<PlayUrlResponse> {
  const params = await wbiParams({
    bvid,
    cid,
    qn,
    fnval: 4048, // enable DASH + HDR + 4K + Dolby
    fnver: 0,
    fourk: 1,
  });
  const { data } = await http.get('/x/player/playurl', { params });
  return data.data as PlayUrlResponse;
}

export function getVideoQualities(
  playData: PlayUrlResponse,
): VideoQuality[] {
  return (playData.accept_quality ?? []).map((qn, i) => ({
    qn,
    desc: playData.accept_description?.[i] ?? String(qn),
  }));
}

export async function getDanmaku(
  cid: number,
): Promise<DanmakuItem[]> {
  const { data } = await http.get(
    `https://comment.bilibili.com/${cid}.xml`,
    { baseURL: '' },
  );
  return parseDanmakuXml(typeof data === 'string' ? data : String(data));
}

export async function getComments(
  oid: number,
  type = 1,
  pn = 1,
  ps = 20,
): Promise<Comment[]> {
  const params = await wbiParams({ oid, type, pn, ps, mode: 3 });
  const { data } = await http.get('/x/v2/reply/main', { params });
  return (data.data?.replies ?? []).map(mapComment);
}

export async function getVideoRelated(bvid: string): Promise<VideoItem[]> {
  const { data } = await http.get('/x/web-interface/archive/related', {
    params: { bvid },
  });
  return (data.data ?? []).map(mapVideoItem);
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchVideos(
  keyword: string,
  page = 1,
  pageSize = 20,
): Promise<SearchResult> {
  const params = await wbiParams({
    search_type: 'video',
    keyword,
    page,
    page_size: pageSize,
  });
  const { data } = await http.get('/x/web-interface/wbi/search/type', {
    params,
  });
  const d = data.data ?? {};
  return {
    videos: (d.result ?? []).map(mapSearchItem),
    numResults: d.numResults ?? 0,
    numPages: d.numPages ?? 1,
    page,
  };
}

export async function getHotSearch(): Promise<HotSearchItem[]> {
  const { data } = await http.get('/x/web-interface/search/square', {
    params: { limit: 10 },
  });
  return (data.data?.trending?.list ?? []).map((item: Record<string, unknown>) => ({
    keyword: item.keyword,
    hot_id: item.icon,
    position: item.position,
  })) as HotSearchItem[];
}

export async function getSearchSuggest(
  term: string,
): Promise<SearchSuggestItem[]> {
  const { data } = await http.get('/x/web-interface/search/suggest', {
    params: { term },
  });
  return (data.result?.tag ?? []) as SearchSuggestItem[];
}

// ─── Live ─────────────────────────────────────────────────────────────────────

export async function getLiveList(
  areaId = 0,
  page = 1,
  pageSize = 30,
): Promise<LiveRoom[]> {
  const { data } = await http.get(
    'https://api.live.bilibili.com/xlive/web-interface/v1/second/getList',
    {
      baseURL: '',
      params: { platform: 'web', parent_area_id: areaId, area_id: 0, sort_type: '', page, page_size: pageSize },
    },
  );
  return (data.data?.list ?? []).map(mapLiveRoom);
}

export async function getLiveRoomDetail(
  roomId: number,
): Promise<{ room: LiveRoomDetail; anchor: LiveAnchorInfo }> {
  const [roomRes, anchorRes] = await Promise.all([
    http.get(
      'https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo',
      {
        baseURL: '',
        params: { room_id: roomId, protocol: '0,1', format: '0,2', codec: '0,1', qn: 150, platform: 'web' },
      },
    ),
    http.get('https://api.live.bilibili.com/live_user/v1/UserInfo/get_anchor_in_room', {
      baseURL: '',
      params: { roomid: roomId },
    }),
  ]);

  const r = roomRes.data.data;
  const a = anchorRes.data.data?.info ?? {};

  return {
    room: {
      roomId: r.room_id,
      uid: r.uid,
      title: r.title ?? '',
      description: r.description ?? '',
      coverUrl: r.user_cover ?? '',
      keyframe: r.keyframe ?? '',
      online: r.online ?? 0,
      liveStatus: r.live_status === 1 ? 1 : 0,
      liveStartTime: r.live_time,
    },
    anchor: {
      uid: a.uid ?? 0,
      uname: a.uname ?? '',
      uface: a.face ?? '',
      follower: a.follower_num ?? 0,
    },
  };
}

export async function getLiveStreamUrl(
  roomId: number,
  qn = 150,
): Promise<LiveStreamInfo> {
  const { data } = await http.get(
    'https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo',
    {
      baseURL: '',
      params: { room_id: roomId, protocol: '0,1', format: '0,2', codec: '0,1', qn, platform: 'web' },
    },
  );
  const d = data.data;
  const streams = d.playurl_info?.playurl?.stream ?? [];

  let hls: string | undefined;
  let flv: string | undefined;

  for (const st of streams) {
    for (const fmt of st.format ?? []) {
      for (const codec of fmt.codec ?? []) {
        const url = `${codec.url_info?.[0]?.host ?? ''}${codec.base_url}${codec.url_info?.[0]?.extra ?? ''}`;
        if (fmt.format_name === 'hls' && !hls) hls = url;
        if (fmt.format_name === 'flv' && !flv) flv = url;
      }
    }
  }

  const qualityList = d.playurl_info?.playurl?.g_qn_desc ?? [];
  const qualities = qualityList.map((q: { qn: number; desc: string }) => ({
    qn: q.qn,
    desc: q.desc,
  }));

  return { hls, flv, qualities, currentQn: qn };
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapVideoItem(d: Record<string, unknown>): VideoItem {
  const owner = (d.owner ?? d.author ?? {}) as Record<string, unknown>;
  const stat = (d.stat ?? {}) as Record<string, unknown>;
  return {
    bvid: (d.bvid ?? '') as string,
    aid: (d.aid ?? 0) as number,
    title: ((d.title as string) ?? '').replace(/<[^>]*>/g, ''),
    desc: (d.desc ?? d.description ?? '') as string,
    pic: (d.pic ?? d.cover ?? '') as string,
    owner: {
      uid: (owner.mid ?? owner.uid ?? 0) as number,
      name: (owner.name ?? '') as string,
      avatar: (owner.face ?? '') as string,
    },
    duration: (d.duration ?? 0) as number,
    view: stat.view as number | undefined,
    like: stat.like as number | undefined,
    coin: stat.coin as number | undefined,
    favorite: stat.favorite as number | undefined,
    reply: stat.reply as number | undefined,
    cid: d.cid as number | undefined,
    pages: d.pages as VideoItem['pages'],
  };
}

function mapSearchItem(d: Record<string, unknown>): VideoItem {
  return mapVideoItem({
    ...d,
    pic: ('https:' + (d.pic ?? '')) as string,
    owner: { mid: d.mid, name: d.author, face: d.upic },
    stat: { view: d.play, like: d.like, reply: d.review },
  });
}

function mapComment(d: Record<string, unknown>): Comment {
  const member = (d.member ?? {}) as Record<string, unknown>;
  const content = (d.content ?? {}) as Record<string, unknown>;
  return {
    rpid: d.rpid as number,
    content: { message: (content.message ?? '') as string },
    author: {
      uid: (member.mid ?? 0) as number,
      name: (member.uname ?? '') as string,
      avatar: (member.avatar ?? '') as string,
      level: ((member.level_info as Record<string, number>)?.current_level ?? 0),
    },
    like: (d.like ?? 0) as number,
    ctime: (d.ctime ?? 0) as number,
    replies: ((d.replies ?? []) as Record<string, unknown>[]).map(mapComment),
  };
}

function mapLiveRoom(d: Record<string, unknown>): LiveRoom {
  return {
    roomId: (d.roomid ?? 0) as number,
    uid: (d.uid ?? 0) as number,
    title: (d.title ?? '') as string,
    coverUrl: (d.cover ?? '') as string,
    keyframe: (d.keyframe ?? '') as string,
    online: (d.online ?? 0) as number,
    uname: (d.uname ?? '') as string,
    uface: (d.face ?? '') as string,
    areaName: (d.area_name ?? '') as string,
    parentAreaName: (d.parent_area_name ?? '') as string,
    liveStatus: ((d.live_status ?? 0) === 1 ? 1 : 0) as 0 | 1,
  };
}
