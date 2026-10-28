import { EventStream, RETRY_MIN_MS } from './event-stream';

/** A WebSocket stand-in the test drives by hand. */
class FakeSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((m: { data: unknown }) => void) | null = null;
  closed = false;
  close() {
    this.closed = true;
  }
}

function harness() {
  const sockets: FakeSocket[] = [];
  const stream = new EventStream(
    () => 'ws://test/api/ws',
    () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s as unknown as WebSocket;
    },
  );
  return { stream, sockets };
}

const frame = (seq: number) =>
  JSON.stringify({ seq, ts: 1, kind: 'http', device_id: 1, summary: 'GET /x -> 200' });

describe('EventStream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('delivers events once after a quick stop and start, and ignores the old socket', () => {
    const { stream, sockets } = harness();
    const events = vi.fn();
    stream.onEvent(events);
    stream.start();
    stream.stop();
    stream.start();
    const [old, current] = sockets;
    current!.onopen?.();
    // The stopped socket's late close and message must change nothing.
    old!.onclose?.();
    old!.onmessage?.({ data: frame(1) });
    current!.onmessage?.({ data: frame(2) });
    vi.advanceTimersByTime(RETRY_MIN_MS * 4);
    expect(sockets).toHaveLength(2);
    expect(events).toHaveBeenCalledTimes(1);
    expect(stream.currentStatus).toBe('live');
    stream.stop();
  });

  it('reconnects with a doubling delay after the connection drops', () => {
    const { stream, sockets } = harness();
    stream.start();
    sockets[0]!.onclose?.();
    expect(stream.currentStatus).toBe('offline');
    vi.advanceTimersByTime(RETRY_MIN_MS);
    expect(sockets).toHaveLength(2);
    sockets[1]!.onclose?.();
    vi.advanceTimersByTime(RETRY_MIN_MS);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(RETRY_MIN_MS);
    expect(sockets).toHaveLength(3);
    stream.stop();
  });

  it('skips a malformed frame and keeps going', () => {
    const { stream, sockets } = harness();
    const events = vi.fn();
    stream.onEvent(events);
    stream.start();
    sockets[0]!.onopen?.();
    sockets[0]!.onmessage?.({ data: '{not json' });
    sockets[0]!.onmessage?.({ data: frame(3) });
    expect(events).toHaveBeenCalledTimes(1);
    stream.stop();
  });
});
