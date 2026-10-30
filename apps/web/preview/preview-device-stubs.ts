// Stand-ins for the two live links a real page has: the event stream (a socket
// that opens, pings and adds a log line now and then) and Web Bluetooth (a
// chooser that hands back the two devices of the provisioning artboard).
import { liveEvent } from './fixtures-server';

const PING_MS = 20_000;
const EVENT_MS = 15_000;

/** Enough of a WebSocket for `EventStream`: open, message, close. */
class PreviewSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  private readonly timers: ReturnType<typeof setInterval>[] = [];

  constructor() {
    setTimeout(() => {
      this.onopen?.();
      this.timers.push(
        setInterval(() => {
          this.send({ kind: 'ping', ts: Date.now() / 1000 });
        }, PING_MS),
        setInterval(() => {
          this.send(liveEvent());
        }, EVENT_MS),
      );
    }, 50);
  }

  private send(frame: unknown): void {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }

  close(): void {
    this.timers.forEach(clearInterval);
    this.onclose?.();
  }
}

export function installSocketStub(): void {
  // The stream only ever constructs, listens and closes; the rest of the
  // WebSocket surface is never touched, so the partial class stands in for it.
  globalThis.WebSocket = PreviewSocket as unknown as typeof WebSocket;
}

const ADVERTISED = [
  // Web Bluetooth ids are opaque per-origin tokens; these are shaped like Chrome's.
  { id: 'Ty1o8vM2xQ0FfLkqZ2Wd9A==', name: 'PETKIT_T6_8F2A' },
  { id: 'bG9jYWwtZDRzaC0zMWM3IQ==', name: 'PETKIT_D4SH_31C7' },
];

/** A chooser that picks the next advertised device; connecting is refused (no radio here). */
export function installBluetoothStub(): void {
  let next = 0;
  const bluetooth = {
    getAvailability: () => Promise.resolve(true),
    requestDevice: () => {
      const advert = ADVERTISED[next % ADVERTISED.length];
      next += 1;
      return Promise.resolve({
        ...advert,
        gatt: {
          connect: () =>
            Promise.reject(new DOMException('The preview has no Bluetooth radio.', 'NetworkError')),
        },
      });
    },
  };
  Object.defineProperty(navigator, 'bluetooth', { value: bluetooth, configurable: true });
}
