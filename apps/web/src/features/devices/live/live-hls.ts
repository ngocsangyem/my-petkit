import type Hls from 'hls.js';
import { i18n } from '@/i18n';
import { errorMessage } from '@/shared/api/errors';
import { clearVideo, type LiveCallbacks, type LiveSession, playQuietly } from './live-session';

const HLS_TYPE = 'application/vnd.apple.mpegurl';
// A dropped go2rtc session answers 404 and a signed link expires: either way a
// fresh link from `/live` fixes it. Past this many refreshes without a frame
// shown in between, the stream itself is the problem.
const MAX_REFRESHES = 2;

/**
 * HLS: native where the browser can (Safari, iOS), hls.js elsewhere. `freshUrl` asks `/live`
 * for a newly signed playlist link; it is called to start and again after every fatal error.
 */
export function startHls(
  video: HTMLVideoElement,
  freshUrl: () => Promise<string>,
  { onPlaying, onFailure }: LiveCallbacks,
): LiveSession {
  let stopped = false;
  let hls: Hls | null = null;
  let refreshes = 0;

  const detach = () => {
    hls?.destroy();
    hls = null;
    clearVideo(video);
  };
  const onNativeError = () => {
    void reload();
  };
  // Every `playing`, not just the first: a frame after a refresh resets the count.
  const playing = () => {
    refreshes = 0;
    onPlaying();
  };
  video.addEventListener('playing', playing);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    video.removeEventListener('playing', playing);
    video.removeEventListener('error', onNativeError);
    detach();
  };
  const fail = (message: string) => {
    if (stopped) return;
    stop();
    onFailure({ message });
  };

  const attach = async (url: string) => {
    if (video.canPlayType(HLS_TYPE)) {
      // Only the native player reports through the element; hls.js has its own error event.
      video.addEventListener('error', onNativeError, { once: true });
      video.src = url;
      playQuietly(video);
      return;
    }
    const { default: HlsCtor } = await import('hls.js');
    if (stopped) return;
    if (!HlsCtor.isSupported()) {
      fail(i18n.t('devices:live.fail.hlsUnsupported'));
      return;
    }
    const player = new HlsCtor({ lowLatencyMode: true, liveSyncDurationCount: 2 });
    hls = player;
    player.on(HlsCtor.Events.ERROR, (_event, data) => {
      if (data.fatal && hls === player) void reload();
    });
    player.loadSource(url);
    player.attachMedia(video);
    playQuietly(video);
  };

  async function reload(): Promise<void> {
    if (stopped) return;
    if (refreshes >= MAX_REFRESHES) {
      fail(i18n.t('devices:live.fail.hlsStopped'));
      return;
    }
    refreshes += 1;
    detach();
    await load();
  }

  async function load(): Promise<void> {
    try {
      const url = await freshUrl();
      if (stopped) return;
      await attach(url);
    } catch (error) {
      fail(errorMessage(error));
    }
  }

  void load();
  return { stop };
}
