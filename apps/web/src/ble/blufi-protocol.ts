// PetKit ESP32 provisioning: PetKit JSON carried as BLUFI custom data.
//
// Only custom data is ever sent. The native BLUFI Wi-Fi frames (opmode, STA
// SSID/password, connect) make the ESP-IDF layer join Wi-Fi on its own while
// PetKit's firmware never reads `apiServers`, so a T4 came online on PetKit's
// cloud without ever calling this server. Pure, transport-free.

import { pkBytes, pkParse, type ByteSource, type PetkitPayload } from './provisioning-protocol';

export const BLUFI_SERVICE = '0000ffff-0000-1000-8000-00805f9b34fb';
/** App -> device, write. */
export const BLUFI_P2E = '0000ff01-0000-1000-8000-00805f9b34fb';
/** Device -> app, notify. */
export const BLUFI_E2P = '0000ff02-0000-1000-8000-00805f9b34fb';
export const BLUFI_TYPE_DATA = 0x01;
export const BLUFI_DATA_CUSTOM = 0x13;
export const BLUFI_FC_FRAG = 0x10;
// Read, never sent. Provisioning is driven entirely by the PetKit keys inside
// custom data, so nothing here decides anything — but a device that fails at
// the BLUFI layer says so in one of these two, and without them that arrives
// as "ignored ESP32 packet subtype 0x12". Values from ESP-IDF's own
// `btc_blufi_prf.h`.
export const BLUFI_DATA_WIFI_REP = 0x0f;
export const BLUFI_DATA_ERROR_INFO = 0x12;
/**
 * PetKit's ESP32 firmware receives custom data in 12-byte JSON chunks. A
 * larger write went out as an ATT long write, which the ESP-IDF GATT server
 * swallowed in silence.
 */
export const BLUFI_FRAG_LEN = 12;

/**
 * One custom-data frame: a 4-byte header (type|subtype, frame control, seq,
 * data length), then the data. A fragment that is not the last carries a
 * 2-byte little-endian remaining length before its chunk, counted in the data
 * length. No encryption, no checksum.
 */
export function blufiFrame(
  seq: number,
  data: ArrayLike<number>,
  frag: boolean,
  totalLen: number,
): Uint8Array<ArrayBuffer> {
  const bytes = Array.from(data);
  const head = [
    BLUFI_TYPE_DATA | (BLUFI_DATA_CUSTOM << 2),
    frag ? BLUFI_FC_FRAG : 0x00,
    seq & 0xff,
    frag ? bytes.length + 2 : bytes.length,
  ];
  const body = frag ? [totalLen & 0xff, (totalLen >> 8) & 0xff, ...bytes] : bytes;
  return new Uint8Array([...head, ...body]);
}

/** Session-wide frame counter, shared by every frame the app writes. */
export interface BlufiCounter {
  seq: number;
}

/** Split one custom-data message into the frames to write, in order; advances `ctr.seq`. */
export function blufiFrames(ctr: BlufiCounter, bytes: Uint8Array): Uint8Array<ArrayBuffer>[] {
  if (bytes.length <= BLUFI_FRAG_LEN) return [blufiFrame(ctr.seq++, bytes, false, 0)];
  const frames: Uint8Array<ArrayBuffer>[] = [];
  for (let off = 0; off < bytes.length; off += BLUFI_FRAG_LEN) {
    const chunk = bytes.slice(off, off + BLUFI_FRAG_LEN);
    // `total_len` is what REMAINS including this chunk, which is what the
    // device reassembles against — not the length of the whole message.
    const remaining = bytes.length - off;
    const last = off + BLUFI_FRAG_LEN >= bytes.length;
    frames.push(blufiFrame(ctr.seq++, chunk, !last, remaining));
  }
  return frames;
}

/** Reassembly state for one session: pending fragments and the PetKit replies by key. */
export interface BlufiContext {
  frag: Uint8Array[];
  replies: Record<number, PetkitPayload>;
}

export function newBlufiContext(): BlufiContext {
  return { frag: [], replies: {} };
}

// Turn one notification from 0xFF02 into something worth putting in the log,
// recording any PetKit document it carries into `ctx.replies`. Each fragment
// carries two bytes of remaining length before its content, so a fragment is
// not JSON on its own and the pieces mean nothing apart.
export function blufiExplain(view: ByteSource, ctx: BlufiContext): string {
  const b = pkBytes(view);
  if (b.length < 4) return `short frame (${b.length}B)`;
  const b0 = b[0] ?? 0;
  const pktType = b0 & 0x03;
  const subtype = b0 >> 2;
  const fc = b[1] ?? 0;
  const data = b.slice(4, 4 + (b[3] ?? 0));

  if (pktType === BLUFI_TYPE_DATA && subtype === BLUFI_DATA_CUSTOM) {
    if (fc & BLUFI_FC_FRAG) {
      ctx.frag.push(data.slice(2));
      return `custom data, partial (${data.length - 2}B)`;
    }
    ctx.frag.push(data);
    const whole = new Uint8Array(ctx.frag.reduce((n, part) => n + part.length, 0));
    let at = 0;
    for (const part of ctx.frag) {
      whole.set(part, at);
      at += part.length;
    }
    ctx.frag.length = 0;
    const msg = pkParse(whole);
    if (msg?.key === undefined) {
      return `custom data, not a PetKit document: ${new TextDecoder().decode(whole)}`;
    }
    const payload = msg.payload ?? {};
    ctx.replies[msg.key] = payload;
    return `key ${msg.key} ${JSON.stringify(payload)}`;
  }
  if (pktType === BLUFI_TYPE_DATA && subtype === BLUFI_DATA_WIFI_REP) {
    // opmode, sta_conn_state, softap_conn_num, then TLVs
    const conn = data[1];
    return `wifi status: ${conn === 0 ? 'CONNECTED' : `not connected (${String(conn)})`}`;
  }
  if (pktType === BLUFI_TYPE_DATA && subtype === BLUFI_DATA_ERROR_INFO) {
    return `BLUFI error report, code ${String(data[0])}`;
  }
  return `ignored ESP32 packet type ${pktType} subtype 0x${subtype.toString(16)}`;
}
