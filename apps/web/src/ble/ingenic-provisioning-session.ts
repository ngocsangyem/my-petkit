// The PetKit Ingenic session (service 0xAAA0): framed JSON both ways.

import { writerFor, type GattServiceLike, type SessionDeps } from './gatt-types';
import type { ProvisionConfig } from './provisioning-payload';
import {
  BLE_RX,
  BLE_TX,
  pkFrame,
  pkJoined,
  pkJoinFailed,
  pkJoinState,
  pkJoinWarn,
  pkParse,
  type PetkitPayload,
} from './provisioning-protocol';
import { WRONG_PASSWORD_WARNING } from './session-messages';

// Inter-step delays transcribed from captures of the official app, each
// confirmed across two sessions. Do not round these.
/** Key 110 reply -> key 151 write (1.054 s, 1.048 s). */
export const DELAY_IDENT_TO_CREDENTIALS = 1045;
/** Key 151 ack -> first key 112 poll (3.344 s, 3.342 s). */
export const DELAY_ACK_TO_FIRST_POLL = 3340;
/** First joined state -> confirming key 112 poll (5.879 s, 5.792 s). */
export const DELAY_JOINED_TO_CONFIRM = 5780;
/** Confirmed joined -> key 101 (1.101 s, 1.038 s). */
export const DELAY_CONFIRM_TO_DONE = 1030;
const POLL_STEP = 250;
const POLL_STEPS = 20;
const JOIN_POLLS = 25;
const JOIN_POLL_INTERVAL = 3000;

/**
 * Runs the Ingenic exchange. True when the device took the credentials (and
 * usually joined); false when it never answered, refused, or gave up.
 */
export async function provisionIngenic(
  service: GattServiceLike,
  cfg: ProvisionConfig,
  { log, sleep }: SessionDeps,
): Promise<boolean> {
  const chars = await service.getCharacteristics();
  const byUuid = (uuid: string) => chars.find(c => c.uuid === uuid);
  // By property when the UUIDs are not the usual ones.
  const tx = byUuid(BLE_TX) ?? chars.find(c => c.properties?.notify || c.properties?.indicate);
  const rx =
    byUuid(BLE_RX) ?? chars.find(c => c.properties?.writeWithoutResponse || c.properties?.write);
  if (!tx || !rx) {
    const seen = chars.map(c => {
      const p = c.properties ?? {};
      const flags = (['notify', 'indicate', 'writeWithoutResponse', 'write'] as const).filter(
        k => p[k],
      );
      return `${c.uuid} [${flags.join(',')}]`;
    });
    log(`could not find PetKit write/notify characteristics. Seen: ${seen.join(', ')}`);
    return false;
  }
  log(`PetKit notify: ${tx.uuid}`);
  log(`PetKit write: ${rx.uuid}`);

  const replies: Record<number, PetkitPayload> = {};
  // The listener goes on before notifications start, so no early reply is lost.
  tx.addEventListener('characteristicvaluechanged', () => {
    if (!tx.value) return;
    const msg = pkParse(tx.value);
    if (msg?.key === undefined) return;
    const payload = msg.payload ?? {};
    replies[msg.key] = payload;
    log(`device: key ${msg.key} ${JSON.stringify(payload)}`);
  });
  await tx.startNotifications();

  const write = writerFor(rx);
  let seq = 0;
  const send = (obj: object) => write(pkFrame(seq++, obj));
  const waitFor = async (done: () => boolean) => {
    for (let i = 0; i < POLL_STEPS && !done(); i++) await sleep(POLL_STEP);
  };
  const acked = () => replies[151]?.state === 1;

  log('asking the device who it is (key 110)…');
  await send({ key: 110 });
  await waitFor(() => replies[110] !== undefined);
  if (!replies[110]) {
    // A device can drop the first write after a fresh connect.
    log('no identity reply yet — retrying key 110 once…');
    await send({ key: 110 });
    await waitFor(() => replies[110] !== undefined);
  }
  if (!replies[110]) {
    log('the device never answered — make sure it is still in pairing mode.');
    return false;
  }
  await sleep(DELAY_IDENT_TO_CREDENTIALS);

  // 151: Wi-Fi + where to phone home. Ack is { state: 1 }.
  log('sending Wi-Fi credentials and server address (key 151)…');
  await send({ key: 151, payload: cfg.payload });
  await waitFor(acked);
  if (!acked()) {
    log('the device did not accept the credentials (no state:1).');
    return false;
  }

  log('credentials accepted — waiting for the device to join the network…');
  let shown: number | undefined | null = null;
  for (let i = 0; i < JOIN_POLLS; i++) {
    await sleep(i === 0 ? DELAY_ACK_TO_FIRST_POLL : JOIN_POLL_INTERVAL);
    await send({ key: 112 });
    // Read right after the poll, so this is the answer to the previous one.
    const state = replies[112]?.state;
    // Only on change: polling would otherwise print the same line twenty-five
    // times and bury the one that matters.
    if (state !== shown) {
      shown = state;
      log(`device: ${pkJoinState(replies[112])}`);
      if (pkJoinWarn(replies[112])) log(WRONG_PASSWORD_WARNING);
    }
    if (pkJoined(replies[112])) {
      await sleep(DELAY_JOINED_TO_CONFIRM);
      await send({ key: 112 });
      await sleep(DELAY_CONFIRM_TO_DONE);
      if (pkJoined(replies[112])) {
        log('device joined — sending completion (key 101)…');
        await send({ key: 101 });
        return true;
      }
    }
    if (pkJoinFailed(replies[112])) {
      log(`the device gave up: ${pkJoinState(replies[112])}`);
      return false;
    }
  }
  // Not joined and not a failure either: the device took the credentials and
  // said so. Returning true without a word here reported a device that never
  // got onto Wi-Fi as provisioned; this line is what keeps that honest.
  log(
    `the device did not report joining within 25s (last status: ${pkJoinState(replies[112])}). ` +
      'It may still get there on its own — watch the device list.',
  );
  return true;
}
