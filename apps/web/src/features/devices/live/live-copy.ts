import { i18n } from '@/i18n';
import type { LiveMode, LiveReason } from './live-api';

// Mode names are protocol names, the same in every language.
export const MODE_LABEL: Record<LiveMode, string> = {
  webrtc: 'WebRTC',
  mse: 'MSE',
  hls: 'HLS',
};

// The sentences below are getters, so every read is in the active language; the component that
// renders one subscribes to language changes.

/** One plain sentence per mode: what it costs and when to pick it. */
export const MODE_SENTENCE: Readonly<Record<LiveMode, string>> = {
  get webrtc() {
    return i18n.t('devices:live.mode.webrtc');
  },
  get mse() {
    return i18n.t('devices:live.mode.mse');
  },
  get hls() {
    return i18n.t('devices:live.mode.hls');
  },
};

/** Why nothing can be watched, one sentence per server reason. */
export const REASON_SENTENCE: Readonly<Record<LiveReason, string>> = {
  get not_a_camera() {
    return i18n.t('devices:live.reason.notACamera');
  },
  get device_unreachable() {
    return i18n.t('devices:live.reason.deviceUnreachable');
  },
  get no_stream() {
    return i18n.t('devices:live.reason.noStream');
  },
  get sidecar_down() {
    return i18n.t('devices:live.reason.sidecarDown');
  },
};

/** A reason the client does not know yet still gets a sentence. */
export function reasonSentence(reason: LiveReason | null): string {
  return reason && reason in REASON_SENTENCE
    ? REASON_SENTENCE[reason]
    : i18n.t('devices:live.reason.unknown');
}
