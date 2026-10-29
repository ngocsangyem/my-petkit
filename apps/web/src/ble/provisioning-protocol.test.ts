// The provisioning decoders, against the exact frames the hardware reports
// describe. They decode a binary protocol off real devices, three reports
// disagree about the details, and a wrong offset here reads as "your device
// never answered" rather than as an error. The iOS port shares these vectors.

import {
  BLUFI_DATA_CUSTOM,
  BLUFI_DATA_ERROR_INFO,
  BLUFI_DATA_WIFI_REP,
  BLUFI_FC_FRAG,
  BLUFI_TYPE_DATA,
  blufiExplain,
  newBlufiContext,
} from './blufi-protocol';
import {
  PK_JOIN_FAILED,
  PK_MAGIC,
  PK_TAIL,
  PK_TYPE_OUT,
  pkCrc16,
  pkFrame,
  pkJoined,
  pkJoinFailed,
  pkJoinState,
  pkJoinWarn,
  pkParse,
} from './provisioning-protocol';

const enc = new TextEncoder();

/** `{"key":151,"payload":{"state":1}}`: the credentials ack every model sends. */
const ackJson = enc.encode('{"key":151,"payload":{"state":1}}');
const ackCrc = pkCrc16(ackJson);
/** An inbound (type 0x13) frame of the ack, with the given length field. */
const framedAck = (len: number) =>
  new Uint8Array([
    0xfa,
    0xfc,
    0xfd,
    0x46,
    0x13,
    0,
    len & 0xff,
    (len >> 8) & 0xff,
    ...ackJson,
    ackCrc & 0xff,
    (ackCrc >> 8) & 0xff,
    0xfb,
  ]);
const blufiPkt = (sub: number, fc: number, data: ArrayLike<number>) =>
  new Uint8Array([1 | (sub << 2), fc, 0, data.length, ...Array.from(data)]);

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

describe('Ingenic framing', () => {
  it('uses the CRC the devices use (CRC-16/CCITT-FALSE check value)', () => {
    // A merely plausible CRC produces frames a device drops in silence.
    expect(pkCrc16(enc.encode('123456789'))).toBe(0x29b1);
  });

  it('computes CRC 0x3234 for {"key":110}, the first frame of every session', () => {
    expect(pkCrc16(enc.encode(JSON.stringify({ key: 110 })))).toBe(0x3234);
  });

  it('frames {"key":110} at seq 0 byte for byte, CRC little-endian', () => {
    expect(hex(pkFrame(0, { key: 110 }))).toBe(
      'FA FC FD 46 18 00 0D 00 7B 22 6B 65 79 22 3A 31 31 30 7D 34 32 FB',
    );
  });

  it('builds an outbound frame with type 0x18, the seq, and a length counting the CRC', () => {
    const frame = pkFrame(0, { key: 110 });
    expect(pkParse(frame)?.key).toBe(110);
    expect(frame[4]).toBe(PK_TYPE_OUT);
    expect(frame[4]).toBe(0x18);
    expect(frame[5]).toBe(0);
    expect(frame[6]! | (frame[7]! << 8)).toBe('{"key":110}'.length + 2);
    expect(Array.from(frame.slice(0, 4))).toEqual(PK_MAGIC);
    expect(frame[frame.length - 1]).toBe(PK_TAIL);
  });

  it('wraps the sequence number at one byte', () => {
    expect(pkFrame(257, { key: 112 })[5]).toBe(1);
  });

  it('accepts both readings of the length field, bare JSON, and rejects garbage', () => {
    // A T6 counts the JSON alone; a D4H counts the JSON plus its two CRC bytes.
    expect(pkParse(framedAck(ackJson.length + 2))?.payload?.state).toBe(1);
    expect(pkParse(framedAck(ackJson.length))?.payload?.state).toBe(1);
    expect(pkParse(ackJson)?.key).toBe(151);
    expect(pkParse(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('reads a notification from its own offset, not the whole underlying buffer', () => {
    const body = framedAck(ackJson.length + 2);
    const big = new Uint8Array(64);
    big.set(body, 8);
    const view = new DataView(big.buffer, 8, body.length);
    expect(pkParse(view)?.payload?.state).toBe(1);
  });
});

describe('join report (key 112)', () => {
  it('counts server-connected (7) and online (10) as joined', () => {
    expect(pkJoined({ state: 7 })).toBe(true);
    expect(pkJoined({ state: 10 })).toBe(true);
    expect(pkJoined({ state: 6 })).toBe(false);
    expect(pkJoined(undefined)).toBe(false);
    expect(pkJoinState(undefined)).toBe('never reported');
    expect(pkJoinState({ state: 6 })).toContain('connecting to the server');
  });

  it('treats a wrong password as a warning, not terminal', () => {
    // An ESP32 reported 3/2, then recovered with unchanged credentials.
    expect(pkJoinFailed({ state: 3, code: 2 })).toBe(false);
    expect(pkJoinWarn({ state: 3, code: 2 })).toBe(true);
    expect(pkJoinState({ state: 3, code: 2 })).toBe('the Wi-Fi password is wrong (code 2)');
    expect(PK_JOIN_FAILED).not.toContain(3);
  });

  it('names a reported failure rather than numbering it', () => {
    expect([pkJoinWarn({ state: 3 }), pkJoinState({ state: 3 })]).toEqual([
      true,
      'the Wi-Fi password is wrong',
    ]);
    expect([pkJoinFailed({ state: 4 }), pkJoinState({ state: 4 })]).toEqual([
      true,
      'that Wi-Fi network was not found',
    ]);
    expect(pkJoinFailed({ state: 5 })).toBe(true);
    expect(pkJoinFailed({ state: 8 })).toBe(true);
    expect(pkJoinState({ state: 8 })).toContain('could not connect to the server');
    // 9 is "connecting to MQTT": progress, not a verdict.
    expect(pkJoinFailed({ state: 7 })).toBe(false);
    expect(pkJoinFailed({ state: 9 })).toBe(false);
    expect(pkJoinFailed(undefined)).toBe(false);
  });

  it('falls back to the number for a state outside the table', () => {
    expect(pkJoinState({ state: 42 })).toBe('state 42');
  });
});

describe('BLUFI notifications', () => {
  it('reassembles a fragmented custom-data reply', () => {
    // Each fragment carries two bytes of remaining length before its content.
    const ctx = newBlufiContext();
    const parts = [ackJson.slice(0, 12), ackJson.slice(12, 24), ackJson.slice(24)];
    let line = '';
    parts.forEach((p, i) => {
      const last = i === parts.length - 1;
      const data = last
        ? p
        : new Uint8Array([ackJson.length & 0xff, (ackJson.length >> 8) & 0xff, ...p]);
      line = blufiExplain(blufiPkt(BLUFI_DATA_CUSTOM, last ? 0 : BLUFI_FC_FRAG, data), ctx);
    });
    expect(ctx.replies[151]?.state).toBe(1);
    expect(line.startsWith('key 151')).toBe(true);
    expect(ctx.frag).toHaveLength(0);
  });

  it('names a BLUFI-level Wi-Fi report or error rather than numbering it', () => {
    const ctx = newBlufiContext();
    const pkt = (sub: number, data: number[]) => blufiPkt(sub, 0, data);
    expect(blufiExplain(pkt(BLUFI_DATA_WIFI_REP, [1, 0, 0]), ctx)).toContain('CONNECTED');
    expect(blufiExplain(pkt(BLUFI_DATA_WIFI_REP, [1, 2, 0]), ctx)).toContain('not connected (2)');
    expect(blufiExplain(pkt(BLUFI_DATA_ERROR_INFO, [7]), ctx)).toContain('error report, code 7');
  });

  it('logs a short frame, a non-PetKit document, and an unknown subtype', () => {
    const ctx = newBlufiContext();
    expect(blufiExplain(new Uint8Array([1, 0]), ctx)).toBe('short frame (2B)');
    expect(blufiExplain(blufiPkt(BLUFI_DATA_CUSTOM, 0, enc.encode('hi')), ctx)).toBe(
      'custom data, not a PetKit document: hi',
    );
    expect(blufiExplain(new Uint8Array([BLUFI_TYPE_DATA | (0x05 << 2), 0, 0, 0]), ctx)).toBe(
      'ignored ESP32 packet type 1 subtype 0x5',
    );
  });
});
