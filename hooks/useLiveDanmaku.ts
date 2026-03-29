/**
 * useLiveDanmaku – Bilibili live WebSocket danmaku client.
 *
 * Connects to wss://broadcastlv.chat.bilibili.com/sub and handles:
 *   - Heartbeat (every 30 s)
 *   - Authentication packet
 *   - Incoming operation packets (danmaku, gift, superchat, enter, online)
 *
 * Decoded messages are stored in the live Zustand store.
 *
 * Protocol reference:
 *   https://github.com/lovelyyoshino/Bilibili-Live-API/blob/master/API.WebSocket.md
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLiveStore } from '../store/playerStore';
import type { DanmakuItem } from '../services/types';

const WS_URL = 'wss://broadcastlv.chat.bilibili.com/sub';
const HEARTBEAT_INTERVAL = 30_000;

// ─── Packet encoding / decoding ───────────────────────────────────────────────

function encodePacket(op: number, body: string): ArrayBuffer {
  const bodyBytes = new TextEncoder().encode(body);
  const header = new DataView(new ArrayBuffer(16));
  header.setUint32(0, 16 + bodyBytes.byteLength, false); // total length
  header.setUint16(4, 16, false);                        // header length
  header.setUint16(6, 1, false);                         // ver
  header.setUint32(8, op, false);                        // operation
  header.setUint32(12, 1, false);                        // sequence
  const buf = new ArrayBuffer(16 + bodyBytes.byteLength);
  new Uint8Array(buf).set(new Uint8Array(header.buffer));
  new Uint8Array(buf).set(bodyBytes, 16);
  return buf;
}

interface PacketHeader {
  totalLen: number;
  headerLen: number;
  ver: number;
  op: number;
}

function decodeHeader(view: DataView): PacketHeader {
  return {
    totalLen: view.getUint32(0, false),
    headerLen: view.getUint16(4, false),
    ver: view.getUint16(6, false),
    op: view.getUint32(8, false),
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface Options {
  /** Bilibili live room ID */
  roomId: number;
  /** Bilibili user UID (0 for anonymous) */
  uid?: number;
  enabled?: boolean;
}

export function useLiveDanmaku({ roomId, uid = 0, enabled = true }: Options) {
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const addLiveDanmaku = useLiveStore((s) => s.addLiveDanmaku);
  const clearLiveDanmakus = useLiveStore((s) => s.clearLiveDanmakus);

  const sendHeartbeat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(encodePacket(2, '[object Object]'));
    }
  }, []);

  const handleMessage = useCallback(
    (ev: MessageEvent) => {
      try {
        const buffer =
          ev.data instanceof ArrayBuffer
            ? ev.data
            : (ev.data as Blob).arrayBuffer
            ? null // handled in blob branch below
            : null;

        if (buffer === null && ev.data instanceof Blob) {
          ev.data.arrayBuffer().then((ab) => parseBuffer(ab));
          return;
        }
        if (buffer) parseBuffer(buffer);
      } catch {
        // ignore malformed packets
      }
    },
    [addLiveDanmaku], // eslint-disable-line
  );

  function parseBuffer(ab: ArrayBuffer) {
    let offset = 0;
    const view = new DataView(ab);

    while (offset < ab.byteLength) {
      const header = decodeHeader(new DataView(ab, offset));
      const bodyLen = header.totalLen - header.headerLen;
      const bodyStart = offset + header.headerLen;

      if (header.op === 5) {
        // normal message packet (may be zlib compressed, ver 2)
        if (header.ver === 2) {
          // zlib compressed – handled if pako is available
          try {
            // dynamic import to avoid hard dependency in non-native env
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const pako = require('pako') as typeof import('pako');
            const compressed = new Uint8Array(ab, bodyStart, bodyLen);
            const inflated = pako.inflate(compressed).buffer;
            parseBuffer(inflated);
          } catch {
            // pako not available or decompression failed
          }
        } else if (header.ver === 3) {
          // brotli – unsupported, skip
        } else {
          const bodyText = new TextDecoder().decode(
            new Uint8Array(ab, bodyStart, bodyLen),
          );
          try {
            dispatchMsg(JSON.parse(bodyText));
          } catch {
            // invalid JSON
          }
        }
      }
      // op 3 = online count
      if (header.op === 3) {
        const count = new DataView(ab, bodyStart, 4).getUint32(0, false);
        useLiveStore.getState().setIsLive(count > 0);
      }

      offset += header.totalLen;
    }
  }

  function dispatchMsg(msg: { cmd?: string; data?: Record<string, unknown> }) {
    const cmd = msg.cmd ?? '';
    const data = msg.data ?? {};

    if (cmd === 'DANMU_MSG') {
      const info = (msg as { info?: unknown[] }).info ?? [];
      const meta = (info[0] ?? []) as unknown[];
      const text = (info[1] ?? '') as string;
      const user = (info[2] ?? []) as unknown[];
      const color = (meta[3] as number) || 16777215;
      const fontSize = (meta[2] as number) || 25;

      const item: DanmakuItem = {
        time: Date.now() / 1000, // use wall clock for live
        mode: 1,
        fontSize: Math.min(fontSize, 25),
        color,
        text,
        uid: (user[0] as number) ?? 0,
      };
      addLiveDanmaku(item);
      return;
    }

    if (cmd === 'SEND_GIFT') {
      const text = `${data.uname} 赠送了 ${data.giftName} ×${data.num}`;
      addLiveDanmaku({ time: Date.now() / 1000, mode: 5, fontSize: 20, color: 0xffcc00, text });
      return;
    }

    if (cmd === 'SUPER_CHAT_MESSAGE') {
      const text = `[SC ¥${data.price}] ${data.user_info ? (data.user_info as Record<string, string>).uname : ''}: ${data.message}`;
      addLiveDanmaku({ time: Date.now() / 1000, mode: 5, fontSize: 22, color: 0xff6600, text });
      return;
    }

    if (cmd === 'INTERACT_WORD') {
      // ignore enter messages to reduce noise
    }
  }

  useEffect(() => {
    if (!enabled || !roomId) return;

    clearLiveDanmakus();

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      // send auth packet
      const authBody = JSON.stringify({
        uid,
        roomid: roomId,
        protover: 2,
        platform: 'web',
        type: 2,
      });
      ws.send(encodePacket(7, authBody));

      // start heartbeat
      heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };

    ws.onerror = () => {
      ws.close();
    };

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      ws.close();
      wsRef.current = null;
    };
  }, [roomId, uid, enabled]);
}
