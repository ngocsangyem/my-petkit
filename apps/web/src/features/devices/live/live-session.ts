// What every live transport (WebRTC, MSE, HLS) shares: it is started on a
// <video>, reports back through callbacks, and stops synchronously, so a React
// effect cleanup can tear it down on unmount or on a mode change.

/** Why a session ended. `fallback` asks the player to try the next offered mode. */
export interface LiveFailure {
  message: string;
  fallback?: boolean;
}

export interface LiveCallbacks {
  /** The first frame is showing. */
  onPlaying: () => void;
  /** Fatal; the session has already cleaned up after itself. */
  onFailure: (failure: LiveFailure) => void;
}

export interface LiveSession {
  stop: () => void;
}

/**
 * Play without throwing. The video is muted, so autoplay rules allow it; a refusal (or an
 * engine without a media stack) is left to the session's own error path.
 */
export function playQuietly(video: HTMLVideoElement): void {
  try {
    void video.play().catch(() => undefined);
  } catch {
    // Engines that throw instead of rejecting.
  }
}

/** Detach whatever the element was playing, so it releases its decoder and buffers. */
export function clearVideo(video: HTMLVideoElement): void {
  try {
    video.pause();
  } catch {
    // jsdom has no media stack; nothing to release there.
  }
  video.srcObject = null;
  video.removeAttribute('src');
}

/** Calls `onPlaying` once, when the element first plays. Returns the unsubscribe. */
export function onFirstPlaying(video: HTMLVideoElement, onPlaying: () => void): () => void {
  const handler = () => {
    video.removeEventListener('playing', handler);
    onPlaying();
  };
  video.addEventListener('playing', handler);
  return () => {
    video.removeEventListener('playing', handler);
  };
}
