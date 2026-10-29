// The PetKit ESP32 session (service 0xFFFF): PetKit JSON as BLUFI custom data.

import {
  BLUFI_E2P,
  BLUFI_P2E,
  blufiExplain,
  blufiFrames,
  newBlufiContext,
  type BlufiCounter,
} from './blufi-protocol';
import { writerFor, type GattServiceLike, type SessionDeps } from './gatt-types';
import type { ProvisionConfig } from './provisioning-payload';
import { pkJoined, pkJoinFailed, pkJoinState, pkJoinWarn } from './provisioning-protocol';
import { WRONG_PASSWORD_WARNING } from './session-messages';

// Timeouts from real captures. Observed worst cases: 110 reply 161 ms, 151 ack
// 270 ms, credentials-ack to state 7 ~11 s (to state 10, which is not waited
// for, 114 s).
export const T_IDENT = 5000;
export const T_ACK = 10000;
export const T_JOIN = 120000;
const IDENT_RETRY_AFTER = 2000;
const POLL_STEP = 250;
const JOIN_STEP = 1000;

/** Runs the ESP32 exchange. True only once the device reports joining. */
export async function provisionBlufi(
  service: GattServiceLike,
  cfg: ProvisionConfig,
  { log, sleep, now }: SessionDeps,
): Promise<boolean> {
  const p2e = await service.getCharacteristic(BLUFI_P2E);
  const e2p = await service.getCharacteristic(BLUFI_E2P);

  const ctx = newBlufiContext();
  await e2p.startNotifications();
  e2p.addEventListener('characteristicvaluechanged', () => {
    if (e2p.value) log(`device: ${blufiExplain(e2p.value, ctx)}`);
  });

  const write = writerFor(p2e);
  const ctr: BlufiCounter = { seq: 0 };
  const enc = new TextEncoder();
  const send = async (obj: { key: number; payload?: object }) => {
    const bytes = enc.encode(JSON.stringify(obj));
    log(`ESP32: key ${obj.key} custom data (${bytes.length} bytes)`);
    // One frame at a time, each awaited: the device reassembles in order.
    for (const frame of blufiFrames(ctr, bytes)) await write(frame);
  };
  // An object, so the disconnect listener's write is visible to the checks below.
  const link = { live: true };
  service.device?.addEventListener('gattserverdisconnected', () => {
    link.live = false;
  });
  const until = (ms: number) => {
    const end = now() + ms;
    return () => link.live && now() < end;
  };
  const replies = ctx.replies;
  const acked = () => replies[151]?.state === 1;

  log('asking the device who it is (key 110)…');
  await send({ key: 110 });
  await sleep(IDENT_RETRY_AFTER);
  if (link.live && !replies[110]) {
    log('no identity reply yet — retrying key 110 once…');
    await send({ key: 110 });
  }
  const identing = until(T_IDENT);
  while (identing() && !replies[110]) await sleep(POLL_STEP);
  if (!replies[110]) {
    log(
      link.live
        ? 'timed out waiting for the device identity.'
        : 'the device disconnected before identifying itself.',
    );
    return false;
  }

  log('sending Wi-Fi credentials and server address (key 151)…');
  await send({ key: 151, payload: cfg.payload });
  const acking = until(T_ACK);
  while (acking() && !acked()) {
    if (pkJoinFailed(replies[151])) {
      log(`the device refused the credentials: ${pkJoinState(replies[151])}`);
      return false;
    }
    await sleep(POLL_STEP);
  }
  if (!acked()) {
    log(
      link.live
        ? 'timed out waiting for the device to accept the credentials.'
        : 'the device disconnected before accepting the credentials.',
    );
    return false;
  }

  log('credentials accepted — waiting for the device to join the network…');
  await send({ key: 112 });
  let shown: number | undefined | null = null;
  let askedWifiDetails = false;
  const joining = until(T_JOIN);
  while (joining()) {
    await sleep(JOIN_STEP);
    const state = replies[112]?.state;
    if (state !== shown) {
      shown = state;
      log(`device: ${pkJoinState(replies[112])}`);
      if (pkJoinWarn(replies[112])) log(WRONG_PASSWORD_WARNING);
    }
    if (pkJoinFailed(replies[112])) {
      log(`the device gave up: ${pkJoinState(replies[112])}`);
      return false;
    }
    if (pkJoined(replies[112])) {
      await send({ key: 114, payload: { language: cfg.language } });
      log('device joined — sending completion (key 101)…');
      await send({ key: 101 });
      return true;
    }
    if (state === 6 && !askedWifiDetails) {
      askedWifiDetails = true;
      await send({ key: 111 });
    } else {
      await send({ key: 112 });
    }
  }
  const last = pkJoinState(replies[112]);
  log(
    link.live
      ? `timed out waiting for the device to join (last status: ${last}).`
      : `the device disconnected before joining (last status: ${last}).`,
  );
  return false;
}
