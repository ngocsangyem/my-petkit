import { socketUrl } from '@/shared/api/base-path';
import {
  clearVideo,
  type LiveCallbacks,
  type LiveSession,
  onFirstPlaying,
  playQuietly,
} from './live-session';

/** The only codecs go2rtc's MSE output recognises (packages/contracts/ws-events.md). */
export const GO2RTC_CODECS = [
  'avc1.640029',
  'hvc1.1.6.L153.B0',
  'mp4a.40.2',
  'flac',
  'opus',
] as const;

// Seconds of media kept behind the playhead, and the most the buffer may hold
// before the oldest part is dropped: a live view never seeks back, so this is
// all the memory it needs.
const KEEP_BEHIND_S = 10;
const MAX_BUFFERED_S = 30;
// Further behind the live edge than this and the playhead jumps forward: a
// stall (a backgrounded tab, a slow network) must not leave the view minutes late.
const MAX_LAG_S = 3;
const CATCH_UP_TO_S = 0.5;

/** The codecs this browser's MediaSource accepts, as the comma list the server expects. */
export function supportedCodecs(isTypeSupported: (type: string) => boolean): string {
  return GO2RTC_CODECS.filter(c => isTypeSupported(`video/mp4; codecs="${c}"`)).join(',');
}

type SocketFactory = (url: string) => WebSocket;

/** MSE over the server's WebSocket bridge: codec handshake, then fMP4 appended in order. */
export function startMse(
  video: HTMLVideoElement,
  deviceId: number,
  { onPlaying, onFailure }: LiveCallbacks,
  openSocket: SocketFactory = url => new WebSocket(url),
): LiveSession {
  let stopped = false;
  let socket: WebSocket | null = null;
  let buffer: SourceBuffer | null = null;
  let objectUrl: string | null = null;
  const queue: ArrayBuffer[] = [];
  const unsubscribe = onFirstPlaying(video, onPlaying);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    unsubscribe();
    socket?.close();
    socket = null;
    queue.length = 0;
    clearVideo(video);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  };
  const fail = (message: string) => {
    if (stopped) return;
    stop();
    onFailure({ message });
  };

  // Append the next fragment, or trim first when the buffer has grown too long.
  // Called again on every `updateend`, so fragments go in strictly in order.
  const pump = () => {
    if (stopped || !buffer || buffer.updating) return;
    try {
      const { buffered } = buffer;
      if (buffered.length > 0) {
        const start = buffered.start(0);
        const end = buffered.end(buffered.length - 1);
        if (end - video.currentTime > MAX_LAG_S) video.currentTime = end - CATCH_UP_TO_S;
        if (end - start > MAX_BUFFERED_S) {
          buffer.remove(start, end - KEEP_BEHIND_S);
          return;
        }
      }
      const next = queue.shift();
      if (next) buffer.appendBuffer(next);
    } catch (error) {
      fail(
        error instanceof Error
          ? `The live video could not be decoded: ${error.message}`
          : 'The live video could not be decoded.',
      );
    }
  };

  const onText = (text: string, source: MediaSource) => {
    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      return; // not ours to act on
    }
    if (typeof message !== 'object' || message === null) return;
    const { type, value } = message as { type?: unknown; value?: unknown };
    if (type === 'error') {
      fail(typeof value === 'string' ? value : 'The live stream refused the connection.');
    } else if (type === 'mse' && typeof value === 'string' && !buffer) {
      try {
        // Exactly the server's string: it names the codecs the stream really carries.
        buffer = source.addSourceBuffer(value);
        buffer.mode = 'segments';
        buffer.addEventListener('updateend', pump);
        buffer.addEventListener('error', () => {
          fail('The live video could not be decoded.');
        });
        pump();
      } catch {
        fail(`This browser cannot play the stream's format (${value}).`);
      }
    }
  };

  const MediaSourceCtor = globalThis.MediaSource as typeof MediaSource | undefined;
  if (!MediaSourceCtor) {
    queueMicrotask(() => {
      fail('This browser cannot play MSE. Choose HLS instead.');
    });
    return { stop };
  }
  const codecs = supportedCodecs(type => MediaSourceCtor.isTypeSupported(type));
  if (!codecs) {
    queueMicrotask(() => {
      fail('This browser plays none of the codecs the stream offers. Choose HLS instead.');
    });
    return { stop };
  }

  const source = new MediaSourceCtor();
  objectUrl = URL.createObjectURL(source);
  video.src = objectUrl;
  source.addEventListener(
    'sourceopen',
    () => {
      if (stopped) return;
      try {
        const ws = openSocket(socketUrl(`api/live/${deviceId}/mse`));
        socket = ws;
        ws.binaryType = 'arraybuffer';
        ws.addEventListener('open', () => {
          ws.send(JSON.stringify({ type: 'mse', value: codecs }));
        });
        ws.addEventListener('message', (event: MessageEvent<unknown>) => {
          if (stopped) return;
          if (typeof event.data === 'string') {
            onText(event.data, source);
          } else if (event.data instanceof ArrayBuffer) {
            queue.push(event.data);
            pump();
            playQuietly(video);
          }
        });
        ws.addEventListener('close', () => {
          fail('The live stream closed. Press Watch to start it again.');
        });
      } catch {
        fail('Could not open the live stream connection.');
      }
    },
    { once: true },
  );

  return { stop };
}
