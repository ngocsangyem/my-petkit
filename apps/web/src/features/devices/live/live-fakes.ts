// Minimal stand-ins for the browser media APIs jsdom lacks (RTCPeerConnection,
// MediaSource, WebSocket), each recording what the live view did to it so a
// test can assert on the handshake. Only the members the live code touches.
import { vi } from 'vitest';

export class FakePeerConnection extends EventTarget {
  static instances: FakePeerConnection[] = [];
  transceivers: { kind: string; direction: string | undefined }[] = [];
  iceGatheringState: RTCIceGatheringState = 'new';
  connectionState: RTCPeerConnectionState = 'new';
  localDescription: { type: string; sdp: string } | null = null;
  remoteDescription: { type: string; sdp: string } | null = null;
  closed = false;

  constructor() {
    super();
    FakePeerConnection.instances.push(this);
  }
  addTransceiver(kind: string, init?: { direction?: string }) {
    this.transceivers.push({ kind, direction: init?.direction });
  }
  createOffer() {
    return Promise.resolve({ type: 'offer', sdp: 'v=0 offer' });
  }
  setLocalDescription(description: { type: string; sdp: string }) {
    this.localDescription = description;
    // Gathering finishes after the offer is set, as in a browser.
    queueMicrotask(() => {
      this.iceGatheringState = 'complete';
      this.dispatchEvent(new Event('icegatheringstatechange'));
    });
    return Promise.resolve();
  }
  setRemoteDescription(description: { type: string; sdp: string }) {
    this.remoteDescription = description;
    return Promise.resolve();
  }
  close() {
    this.closed = true;
  }
}

export class FakeSourceBuffer extends EventTarget {
  updating = false;
  mode = 'segments';
  buffered = { length: 0, start: () => 0, end: () => 0 };
  appended: ArrayBuffer[] = [];
  appendBuffer(data: ArrayBuffer) {
    this.appended.push(data);
  }
  remove() {
    // Nothing is buffered in these tests.
  }
}

export class FakeMediaSource extends EventTarget {
  static instances: FakeMediaSource[] = [];
  // HEVC and FLAC refused, to prove the request carries only what the browser plays.
  static isTypeSupported = (type: string) => !/hvc1|flac/.test(type);
  readyState = 'closed';
  mimes: string[] = [];
  buffers: FakeSourceBuffer[] = [];

  constructor() {
    super();
    FakeMediaSource.instances.push(this);
  }
  addSourceBuffer(mime: string) {
    this.mimes.push(mime);
    const buffer = new FakeSourceBuffer();
    this.buffers.push(buffer);
    return buffer;
  }
  open() {
    this.readyState = 'open';
    this.dispatchEvent(new Event('sourceopen'));
  }
}

export class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];
  binaryType = 'blob';
  sent: string[] = [];
  closed = false;

  constructor(readonly url: string) {
    super();
    FakeWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.dispatchEvent(new Event('close'));
  }
  serverOpens() {
    this.dispatchEvent(new Event('open'));
  }
  serverSends(data: string | ArrayBuffer) {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }
}

/** Install every fake, plus inert media-element methods, for one test. */
export function installLiveFakes() {
  FakePeerConnection.instances = [];
  FakeMediaSource.instances = [];
  FakeWebSocket.instances = [];
  const revoked: string[] = [];
  vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
  vi.stubGlobal('MediaSource', FakeMediaSource);
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:live');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(url => {
    revoked.push(url);
  });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  // No native HLS unless a test says so, so the default path is hls.js.
  const canPlayType = vi
    .spyOn(HTMLMediaElement.prototype, 'canPlayType')
    .mockImplementation(() => '');
  return { revoked, canPlayType };
}
