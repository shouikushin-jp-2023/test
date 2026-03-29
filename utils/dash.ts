import * as FileSystem from 'expo-file-system';
import type { PlayUrlResponse, DashVideoItem, DashAudioItem } from '../services/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isDolbyVision(codecs: string): boolean {
  return /^(dvhe|dvh1)/.test(codecs);
}

function baseUrl(item: DashVideoItem | DashAudioItem): string {
  return item.baseUrl ?? (item as { base_url?: string }).base_url ?? '';
}

// ─── MPD builder ──────────────────────────────────────────────────────────────

/**
 * Build an MPD XML string from a Bilibili DASH response.
 *
 * @param playData  The PlayUrlResponse containing dash streams
 * @param qn        The requested quality number
 */
export function buildMpdXml(playData: PlayUrlResponse, qn: number): string {
  const dash = playData.dash!;
  const totalDuration = dash.duration;

  // select video track – prefer exact qn, fallback to first
  const videoTrack: DashVideoItem =
    dash.video.find((v) => v.id === qn) ?? dash.video[0];

  // select audio track – prefer Dolby Atmos, then highest-bandwidth standard
  let audioTrack: DashAudioItem | undefined;
  if (dash.dolby?.audio?.length) {
    audioTrack = dash.dolby.audio[0];
  } else if (dash.flac?.audio) {
    audioTrack = dash.flac.audio;
  } else {
    audioTrack = dash.audio.reduce<DashAudioItem | undefined>(
      (best, a) => (!best || a.bandwidth > best.bandwidth ? a : best),
      undefined,
    );
  }

  const durationStr = formatIsoDuration(totalDuration);
  const isDV = isDolbyVision(videoTrack.codecs);

  // SegmentBase helper
  const segBase = (item: DashVideoItem | DashAudioItem): string => {
    const sb = item.segmentBase;
    if (!sb) return '';
    return `
        <SegmentBase indexRange="${sb.indexRange}">
          <Initialization range="${sb.initialization}"/>
        </SegmentBase>`;
  };

  const videoSet = `
    <AdaptationSet
      id="1"
      mimeType="${videoTrack.mimeType}"
      frameRate="${videoTrack.frameRate}"
      segmentAlignment="true"
      subsegmentAlignment="true"
      subsegmentStartsWithSAP="1">
      <Representation
        id="v${videoTrack.id}"
        bandwidth="${videoTrack.bandwidth}"
        codecs="${isDV ? videoTrack.codecs : videoTrack.codecs}"
        width="${videoTrack.width}"
        height="${videoTrack.height}"
        sar="${videoTrack.sar ?? '1:1'}">
        <BaseURL>${escapeXml(baseUrl(videoTrack))}</BaseURL>${segBase(videoTrack)}
      </Representation>
    </AdaptationSet>`;

  const audioSet = audioTrack
    ? `
    <AdaptationSet
      id="2"
      mimeType="${audioTrack.mimeType}"
      lang="zh"
      segmentAlignment="true">
      <Representation
        id="a${audioTrack.id}"
        bandwidth="${audioTrack.bandwidth}"
        codecs="${audioTrack.codecs}">
        <BaseURL>${escapeXml(baseUrl(audioTrack))}</BaseURL>${segBase(audioTrack)}
      </Representation>
    </AdaptationSet>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<MPD
  xmlns="urn:mpeg:dash:schema:mpd:2011"
  profiles="urn:mpeg:dash:profile:isoff-on-demand:2011"
  type="static"
  mediaPresentationDuration="${durationStr}"
  minBufferTime="PT4S">
  <Period duration="${durationStr}">${videoSet}${audioSet}
  </Period>
</MPD>`;
}

/**
 * Write an MPD file to the app's cache directory and return a `file://` URI
 * suitable for react-native-video / ExoPlayer.
 */
export async function buildDashMpdUri(
  playData: PlayUrlResponse,
  qn: number,
): Promise<string> {
  const xml = buildMpdXml(playData, qn);
  const cacheDir = FileSystem.cacheDirectory!;
  const path = `${cacheDir}dash_${qn}_${Date.now()}.mpd`;
  await FileSystem.writeAsStringAsync(path, xml, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return path; // expo-file-system paths are already file:// URIs
}

// ─── ISO 8601 duration ────────────────────────────────────────────────────────

function formatIsoDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(3);
  return `PT${h}H${m}M${s}S`;
}
