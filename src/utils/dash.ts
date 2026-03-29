import * as FileSystem from 'expo-file-system';
import type { PlayUrlResponse, DashVideoItem, DashAudioItem } from '../types';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isDolbyVision(codecs: string): boolean {
  return /^(dvhe|dvh1)/.test(codecs);
}

function resolveBaseUrl(item: DashVideoItem | DashAudioItem): string {
  return item.baseUrl ?? (item as { base_url?: string }).base_url ?? '';
}

function isoDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(3);
  return `PT${h}H${m}M${s}S`;
}

/**
 * Build an MPD XML string from a DASH play-url response.
 *
 * Selects the video track matching `qn` (falls back to the first track) and
 * picks the best audio track: Dolby Atmos → FLAC → highest-bandwidth standard.
 */
export function buildMpdXml(playData: PlayUrlResponse, qn: number): string {
  const dash = playData.dash!;
  const dur = isoDuration(dash.duration);

  const video: DashVideoItem = dash.video.find((v) => v.id === qn) ?? dash.video[0];

  let audio: DashAudioItem | undefined;
  if (dash.dolby?.audio?.length) audio = dash.dolby.audio[0];
  else if (dash.flac?.audio) audio = dash.flac.audio;
  else audio = dash.audio.reduce<DashAudioItem | undefined>(
    (best, a) => (!best || a.bandwidth > best.bandwidth ? a : best),
    undefined,
  );

  const segBase = (item: DashVideoItem | DashAudioItem): string => {
    const sb = item.segmentBase;
    return sb
      ? `\n        <SegmentBase indexRange="${sb.indexRange}"><Initialization range="${sb.initialization}"/></SegmentBase>`
      : '';
  };

  const videoSet = `
    <AdaptationSet id="1" mimeType="${video.mimeType}" frameRate="${video.frameRate}" segmentAlignment="true" subsegmentAlignment="true" subsegmentStartsWithSAP="1">
      <Representation id="v${video.id}" bandwidth="${video.bandwidth}" codecs="${video.codecs}" width="${video.width}" height="${video.height}" sar="${video.sar ?? '1:1'}">
        <BaseURL>${escapeXml(resolveBaseUrl(video))}</BaseURL>${segBase(video)}
      </Representation>
    </AdaptationSet>`;

  const audioSet = audio ? `
    <AdaptationSet id="2" mimeType="${audio.mimeType}" lang="zh" segmentAlignment="true">
      <Representation id="a${audio.id}" bandwidth="${audio.bandwidth}" codecs="${audio.codecs}">
        <BaseURL>${escapeXml(resolveBaseUrl(audio))}</BaseURL>${segBase(audio)}
      </Representation>
    </AdaptationSet>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" type="static" mediaPresentationDuration="${dur}" minBufferTime="PT4S">
  <Period duration="${dur}">${videoSet}${audioSet}
  </Period>
</MPD>`;
}

/**
 * Write an MPD file to the app cache directory and return a `file://` URI
 * ready for ExoPlayer / AVPlayer via react-native-video.
 */
export async function buildDashMpdUri(playData: PlayUrlResponse, qn: number): Promise<string> {
  const xml = buildMpdXml(playData, qn);
  const path = `${FileSystem.cacheDirectory}dash_${qn}_${Date.now()}.mpd`;
  await FileSystem.writeAsStringAsync(path, xml, { encoding: FileSystem.EncodingType.UTF8 });
  return path;
}

