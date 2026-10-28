// PetKit BLE provisioning: the pure, transport-free half of the protocol.
//
// TWO protocols, because PetKit uses two chips. Which one a device speaks is
// decided by asking it, not by a model table: connect, then look for whichever
// GATT service it exposes. A table would need updating for every codename and
// would be wrong the first time a model shipped a different board.
// 1. PetKit Ingenic devices (T5/T6/T7/D4H/D4SH/W7H): framed JSON written to
//    0xAAA2, answered on 0xAAA1.
// 2. PetKit ESP32 devices (T4, D4): PetKit JSON carried as BLUFI custom data
//    on service 0xFFFF, write 0xFF01, notify 0xFF02 (see `blufi-protocol.ts`).
//
// Nothing in this file touches React, the DOM or Web Bluetooth, so the same
// test vectors pin the iOS port.

export const BLE_SERVICE = '0000aaa0-0000-1000-8000-00805f9b34fb';
/** Device -> app, notify. Named from the device's side. */
export const BLE_TX = '0000aaa1-0000-1000-8000-00805f9b34fb';
/** App -> device, write. */
export const BLE_RX = '0000aaa2-0000-1000-8000-00805f9b34fb';

// Ingenic provisioning (0xAAA0): both directions use the FA FC FD 46
// envelope, type 0x18 for app writes and type 0x13 on notifications. The
// length field includes the JSON plus the two CRC bytes.
export const PK_MAGIC: readonly number[] = [0xfa, 0xfc, 0xfd, 0x46];
export const PK_TAIL = 0xfb;
export const PK_TYPE_OUT = 0x18;

/** One PetKit document: `{"key": <int>, "payload": {...}}`, payload optional. */
export interface PetkitMessage {
  key?: number;
  payload?: PetkitPayload;
}

/** What a device puts in a reply's payload; only `state` and `code` are read. */
export interface PetkitPayload {
  state?: number;
  code?: number;
  [field: string]: unknown;
}

/** CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflection, xorout 0. */
export function pkCrc16(bytes: Iterable<number>): number {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

/** Wrap one JSON object in the framed envelope. The CRC covers the JSON only, little-endian. */
export function pkFrame(seq: number, obj: unknown): Uint8Array<ArrayBuffer> {
  const json = new TextEncoder().encode(JSON.stringify(obj));
  const crc = pkCrc16(json);
  const len = json.length + 2;
  return new Uint8Array([
    ...PK_MAGIC,
    PK_TYPE_OUT,
    seq & 0xff,
    len & 0xff,
    (len >> 8) & 0xff,
    ...json,
    crc & 0xff,
    (crc >> 8) & 0xff,
    PK_TAIL,
  ]);
}

/** Anything a notification can arrive as. */
export type ByteSource = ArrayBufferView | ArrayBuffer | ArrayLike<number>;

// A view's bytes, and only its own: `view.buffer` is the whole underlying
// ArrayBuffer, which may be longer than the view and start before it. Chrome
// hands Web Bluetooth notifications out on their own buffers today, so reading
// it whole happens to work — which is exactly the kind of thing that stops
// working on one browser, on one platform, with no way to see why.
export function pkBytes(view: ByteSource): Uint8Array {
  if (ArrayBuffer.isView(view)) {
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  return new Uint8Array(view);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A parsed JSON value as a PetKit document, or null when it is not an object. */
function asMessage(value: unknown): PetkitMessage | null {
  if (!isRecord(value)) return null;
  const msg: PetkitMessage = {};
  if (typeof value.key === 'number') msg.key = value.key;
  if (isRecord(value.payload)) {
    const payload: PetkitPayload = { ...value.payload };
    if (typeof value.payload.state !== 'number') delete payload.state;
    if (typeof value.payload.code !== 'number') delete payload.code;
    msg.payload = payload;
  }
  return msg;
}

function parseJson(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

// Parse one inbound PetKit reply: the framed envelope, or bare JSON. Null when
// it is neither. Accepts raw bytes as well as a DataView, because ESP32 custom
// data carries the same PetKit document.
//
// The two hardware reports disagree about the length field: a T6's framed
// replies count the JSON alone, a D4H's count the JSON plus its two CRC
// bytes. Neither can be assumed, so both endings are tried. The CRC of an
// inbound frame is not checked, as the panel never did.
export function pkParse(view: ByteSource): PetkitMessage | null {
  const u = pkBytes(view);
  if (u.length >= 11 && u[0] === 0xfa && u[1] === 0xfc && u[2] === 0xfd && u[3] === 0x46) {
    const len = (u[6] ?? 0) | ((u[7] ?? 0) << 8);
    // len includes the trailing CRC; try that first, then fall back to
    // stripping the 8-byte header and the crc16 + tail (3 bytes).
    for (const end of [8 + len - 2, u.length - 3]) {
      try {
        return asMessage(parseJson(u.slice(8, end)));
      } catch {
        /* try the other reading */
      }
    }
    return null;
  }
  try {
    return asMessage(parseJson(u));
  } catch {
    return null;
  }
}

// Key 112 is the join report. The whole table is PetKit's app's own, read off
// the log lines it prints per state (`BleDeviceBindProgressPresenter`, 13.8.1)
// — including the four failures, which used to render as a bare number.
// Telling somebody their Wi-Fi password is wrong beats telling them "state 3".
export const PK_JOIN_STATES: Readonly<Record<number, string>> = {
  0: 'starting',
  1: 'looking for the network',
  2: 'connecting to the network',
  3: 'the Wi-Fi password is wrong',
  4: 'that Wi-Fi network was not found',
  5: 'could not connect to the Wi-Fi',
  6: 'on Wi-Fi, connecting to the server',
  7: 'connected to the server',
  8: 'could not connect to the server',
  9: 'connecting to MQTT',
  10: 'online',
};
/** The states that mean stop waiting and say why. */
export const PK_JOIN_FAILED: readonly number[] = [4, 5, 8];
/**
 * A wrong password is a warning, not a verdict: an ESP32 capture reported
 * state 3 / code 2, then recovered and reached the server with unchanged
 * credentials in the same session.
 */
export const PK_JOIN_WARN: readonly number[] = [3];
/** Connected to the server (7) or online (10). 9 is MQTT progress and keeps polling. */
export const PK_JOIN_DONE: readonly number[] = [7, 10];

function stateIn(payload: PetkitPayload | undefined, states: readonly number[]): boolean {
  return payload?.state !== undefined && states.includes(payload.state);
}

export function pkJoined(payload: PetkitPayload | undefined): boolean {
  return stateIn(payload, PK_JOIN_DONE);
}

export function pkJoinFailed(payload: PetkitPayload | undefined): boolean {
  return stateIn(payload, PK_JOIN_FAILED);
}

export function pkJoinWarn(payload: PetkitPayload | undefined): boolean {
  return stateIn(payload, PK_JOIN_WARN);
}

/** The join report in words: "the Wi-Fi password is wrong (code 2)". */
export function pkJoinState(payload: PetkitPayload | undefined): string {
  if (payload?.state === undefined) return 'never reported';
  const base = PK_JOIN_STATES[payload.state] ?? `state ${payload.state}`;
  return payload.code !== undefined ? `${base} (code ${payload.code})` : base;
}
