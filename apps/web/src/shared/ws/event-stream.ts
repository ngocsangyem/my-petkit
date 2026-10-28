import { socketUrl } from '@/shared/api/base-path';
import { type HubEvent, parseFrame } from './hub-event';

export type StreamStatus = 'connecting' | 'live' | 'offline';

// Retry delay, doubled per attempt. The cap is a whole Home Assistant restart
// long: a tab left open overnight must not keep knocking at the base delay.
export const RETRY_MIN_MS = 2_000;
export const RETRY_MAX_MS = 30_000;
// The server pings every 25 s when idle; two missed pings mean the link is dead
// even if the socket has not noticed yet.
const SILENCE_MS = 60_000;

type SocketFactory = (url: string) => WebSocket;

/** The live event stream: one socket, reconnecting with backoff, many listeners. */
export class EventStream {
  private socket: WebSocket | null = null;
  private retry = RETRY_MIN_MS;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private status: StreamStatus = 'offline';
  private readonly events = new Set<(event: HubEvent) => void>();
  private readonly pings = new Set<() => void>();
  private readonly statuses = new Set<(status: StreamStatus) => void>();

  constructor(
    private readonly url: () => string = () => socketUrl('api/ws'),
    private readonly open: SocketFactory = url => new WebSocket(url),
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    const socket = this.socket;
    this.socket = null; // its late `close` is now ignored (see `connect`)
    socket?.close();
    this.setStatus('offline');
  }

  get currentStatus(): StreamStatus {
    return this.status;
  }

  onEvent(listener: (event: HubEvent) => void): () => void {
    this.events.add(listener);
    return () => this.events.delete(listener);
  }

  /** Fired on every server ping: a cue to refresh slow-changing views. */
  onPing(listener: () => void): () => void {
    this.pings.add(listener);
    return () => this.pings.delete(listener);
  }

  onStatus(listener: (status: StreamStatus) => void): () => void {
    this.statuses.add(listener);
    return () => this.statuses.delete(listener);
  }

  private connect(): void {
    this.setStatus('connecting');
    let socket: WebSocket;
    try {
      socket = this.open(this.url());
    } catch {
      // A URL the constructor cannot parse never fires `close`; re-arm here.
      this.scheduleRetry();
      return;
    }
    this.socket = socket;
    // Every handler checks it still belongs to the current socket: a socket that
    // was stopped (or replaced) may still deliver `close` or a last message.
    const current = () => this.socket === socket;
    socket.onopen = () => {
      if (!current()) return;
      this.retry = RETRY_MIN_MS;
      this.setStatus('live');
      this.armSilence();
    };
    socket.onclose = () => {
      if (!current()) return;
      this.socket = null;
      this.scheduleRetry();
    };
    socket.onmessage = message => {
      if (!current()) return;
      this.armSilence();
      const frame = parseFrame(message.data);
      if (!frame) return;
      if (frame.kind === 'ping')
        this.pings.forEach(l => {
          l();
        });
      else
        this.events.forEach(l => {
          l(frame as HubEvent);
        });
    };
  }

  private armSilence(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => this.socket?.close(), SILENCE_MS);
  }

  private scheduleRetry(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.stopped) return;
    this.setStatus('offline');
    const delay = this.retry;
    this.retry = Math.min(this.retry * 2, RETRY_MAX_MS);
    this.retryTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private setStatus(next: StreamStatus): void {
    if (next === this.status) return;
    this.status = next;
    this.statuses.forEach(l => {
      l(next);
    });
  }
}

/** The app's one stream; started by the app root once signed in. */
export const eventStream = new EventStream();
