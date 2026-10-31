import { i18n } from '@/i18n';
import { ApiError, errorMessage } from '@/shared/api/errors';
import { postWebrtcOffer } from './live-api';
import {
  clearVideo,
  type LiveCallbacks,
  type LiveSession,
  onFirstPlaying,
  playQuietly,
} from './live-session';

// The server takes no trickle candidates: the offer must already hold them all.
// Gathering on a LAN finishes in milliseconds; the cap only matters when a
// network interface hangs, and an offer with the candidates found so far still works.
export const ICE_GATHER_TIMEOUT_MS = 3_000;

function iceGathered(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    const timer = setTimeout(done, timeoutMs);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

/** WebRTC straight from go2rtc: recvonly video and audio, one offer/answer round trip. */
export function startWebrtc(
  video: HTMLVideoElement,
  deviceId: number,
  { onPlaying, onFailure }: LiveCallbacks,
): LiveSession {
  let stopped = false;
  let pc: RTCPeerConnection | null = null;
  const unsubscribe = onFirstPlaying(video, onPlaying);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    unsubscribe();
    pc?.close();
    pc = null;
    clearVideo(video);
  };
  const fail = (message: string, fallback = false) => {
    if (stopped) return;
    stop();
    onFailure({ message, fallback });
  };

  if (typeof RTCPeerConnection === 'undefined') {
    // Not a server problem: the next offered mode may well work here.
    queueMicrotask(() => {
      fail(i18n.t('devices:live.fail.webrtcUnsupported'), true);
    });
    return { stop };
  }

  const peer = new RTCPeerConnection();
  pc = peer;
  peer.addTransceiver('video', { direction: 'recvonly' });
  peer.addTransceiver('audio', { direction: 'recvonly' });
  peer.addEventListener('track', event => {
    const [stream] = event.streams;
    if (stream && video.srcObject !== stream) {
      video.srcObject = stream;
      playQuietly(video);
    }
  });
  peer.addEventListener('connectionstatechange', () => {
    if (peer.connectionState === 'failed') {
      fail(i18n.t('devices:live.fail.webrtcDropped'));
    }
  });

  // Read through a function: TypeScript would otherwise narrow `stopped` to false across the awaits.
  const isStopped = () => stopped;
  void (async () => {
    try {
      await peer.setLocalDescription(await peer.createOffer());
      await iceGathered(peer, ICE_GATHER_TIMEOUT_MS);
      if (isStopped()) return;
      const sdp = peer.localDescription?.sdp;
      if (!sdp) throw new Error(i18n.t('devices:live.fail.noOffer'));
      const answer = await postWebrtcOffer(deviceId, sdp);
      if (isStopped()) return;
      await peer.setRemoteDescription({ type: 'answer', sdp: answer });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'webrtc_unavailable') {
        fail(i18n.t('devices:live.fail.webrtcUnavailable'), true);
      } else {
        fail(errorMessage(error));
      }
    }
  })();

  return { stop };
}
