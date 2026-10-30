import type { LiveMode, LiveReason } from './live-api';

export const MODE_LABEL: Record<LiveMode, string> = {
  webrtc: 'WebRTC',
  mse: 'MSE',
  hls: 'HLS',
};

/** One plain sentence per mode: what it costs and when to pick it. */
export const MODE_SENTENCE: Record<LiveMode, string> = {
  webrtc: 'WebRTC: lowest delay, straight from the server.',
  mse: 'MSE: about a second behind, over the same connection as this page.',
  hls: 'HLS: works everywhere, a few seconds behind.',
};

/** Why nothing can be watched, one sentence per server reason. */
export const REASON_SENTENCE: Record<LiveReason, string> = {
  not_a_camera: 'This device has no camera.',
  device_unreachable:
    'The camera has not reported its network address yet, so it cannot be reached.',
  no_stream:
    'The camera has no live stream yet. Apply Local Camera Streaming on the Patchers screen.',
  sidecar_down: 'The video relay (go2rtc) is not running on the server. Restart the add-on.',
};

/** A reason the client does not know yet still gets a sentence. */
export function reasonSentence(reason: LiveReason | null): string {
  return reason && reason in REASON_SENTENCE
    ? REASON_SENTENCE[reason]
    : 'The live stream is not available right now.';
}
