/**
 * useLiveDanmaku
 *
 * WebSocket client for live danmaku. Handles auth handshake, periodic
 * heartbeat, and decoding of incoming message packets (including zlib-
 * compressed payloads). Decoded danmaku are written to the live store.
 *
 * Supported message types: danmaku, gift, super-chat.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLiveStore } from '../store/playerStore';
import type { DanmakuItem } from '../types';

const WS_URL = 'wss://broadcastlv.chat.bilibili.com/sub';
const HEARTBEAT_MS = 30_000;

// ─── Packet codec ─────────────────────────────────────────────────────────────

function encode(op: number, body: string): ArrayBuffer {
  const bodyBytes = new TextEncoder().encode(body);
  const buf = new ArrayBuffer(16 + bodyBytes.byteLength);
  const dv = new DataView(buf);
  dv.setUint32(0, buf.byteLength, false);
  dv.setUint16(4, 16, false);
  dv.setUint16(6, 1, false);
  dv.setUint32(8, op, false);
  dv.setUint32(12, 1, false);
  new Uint8Array(buf).set(bodyBytes, 16);
  return buf;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface Options {
  roomId: number;
  uid?: number;
  enabled?: boolean;
}

export function useLiveDanmaku({ roomId, uid = 0, enabled = true }: Options): void {
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const addLiveDanmaku = useLiveStore((s) => s.addLiveDanmaku);
  const clearLiveDanmakus = useLiveStore((s) => s.clearLiveDanmakus);

  const heartbeat = useCallback(() => {
    wsRef.current?.readyState === WebSocket.OPEN &&
      wsRef.current.send(encode(2, '[object Object]'));
  }, []);

  const dispatch = useCallback(
    (msg: { cmd?: string; info?: unknown[]; data?: Record<string, unknown> }) => {
      const cmd = msg.cmd ?? '';
      const now = Date.now() / 1000;

      if (cmd === 'DANMU_MSG') {
        const info = (msg.info ?? []) as unknown[];
        const meta = (info[0] ?? []) as number[];
        const text = (info[1] ?? '') as string;
        const user = (info[2] ?? []) as unknown[];
        if (!text) return;
        const item: DanmakuItem = {
          time: now,
          mode: 1,
          fontSize: Math.min((meta[2] as number) || 25, 25),
          color: (meta[3] as number) || 0xffffff,
          text,
          uid: (user[0] as number) ?? 0,
        };
        addLiveDanmaku(item);
        return;
      }

      if (cmd === 'SEND_GIFT') {
        const d = msg.data ?? {};
        addLiveDanmaku({
          time: now,
          mode: 5,
          fontSize: 20,
          color: 0xffcc00,
          text: `${d.uname} 赠送了 ${d.giftName} ×${d.num}`,
        });
        return;
      }

      if (cmd === 'SUPER_CHAT_MESSAGE') {
        const d = msg.data ?? {};
        const uname = ((d.user_info as Record<string, string>)?.uname) ?? '';
        addLiveDanmaku({
          time: now,
          mode: 5,
          fontSize: 22,
          color: 0xff6600,
          text: `[SC ¥${d.price}] ${uname}: ${d.message}`,
        });
      }
    },
    [addLiveDanmaku],
  );

  const parseBuffer = useCallback(
    (ab: ArrayBuffer) => {
      let offset = 0;
      while (offset < ab.byteLength) {
        const dv = new DataView(ab, offset);
        const totalLen = dv.getUint32(0, false);
        const headerLen = dv.getUint16(4, false);
        const ver = dv.getUint16(6, false);
        const op = dv.getUint32(8, false);
        const bodyLen = totalLen - headerLen;
        const bodyStart = offset + headerLen;

        if (op === 5) {
          if (ver === 2) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              const pako = require('pako') as typeof import('pako');
              parseBuffer(pako.inflate(new Uint8Array(ab, bodyStart, bodyLen)).buffer);
            } catch { /* pako unavailable or decompression error */ }
          } else if (ver !== 3) {
            try {
              dispatch(JSON.parse(new TextDecoder().decode(new Uint8Array(ab, bodyStart, bodyLen))));
            } catch { /* invalid JSON */ }
          }
        } else if (op === 3) {
          useLiveStore.getState().setIsLive(new DataView(ab, bodyStart, 4).getUint32(0, false) > 0);
        }

        offset += totalLen;
      }
    },
    [dispatch],
  );

  useEffect(() => {
    if (!enabled || !roomId) return;

    clearLiveDanmakus();
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      ws.send(encode(7, JSON.stringify({ uid, roomid: roomId, protover: 2, platform: 'web', type: 2 })));
      timerRef.current = setInterval(heartbeat, HEARTBEAT_MS);
    };

    ws.onmessage = (ev: MessageEvent) => {
      if (ev.data instanceof ArrayBuffer) {
        parseBuffer(ev.data);
      } else if (ev.data instanceof Blob) {
        ev.data.arrayBuffer().then(parseBuffer);
      }
    };

    ws.onclose = () => { if (timerRef.current) clearInterval(timerRef.current); };
    ws.onerror = () => ws.close();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      ws.close();
      wsRef.current = null;
    };
  }, [roomId, uid, enabled]);
}
