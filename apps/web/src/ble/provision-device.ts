// One provisioning attempt on a chosen device: connect, ask which protocol it
// speaks, run that session, and always disconnect.

import { i18n } from '@/i18n';
import { BLUFI_SERVICE } from './blufi-protocol';
import { provisionBlufi } from './blufi-provisioning-session';
import type { BleDeviceLike, GattServerLike, GattServiceLike, SessionDeps } from './gatt-types';
import { provisionIngenic } from './ingenic-provisioning-session';
import { isBleAccessory, PETKIT_NAME_PREFIX, type ProvisionConfig } from './provisioning-payload';
import { BLE_SERVICE } from './provisioning-protocol';

/** The `requestDevice` options: a name-prefix filter, both services reachable. */
export const REQUEST_DEVICE_OPTIONS = {
  filters: [{ namePrefix: PETKIT_NAME_PREFIX }],
  optionalServices: [BLE_SERVICE, BLUFI_SERVICE],
};

/** How an attempt ended; the page words the status line from it. */
export type ProvisionOutcome =
  | 'accessory' // a Bluetooth-only accessory: nothing to configure
  | 'unknown-device' // neither provisioning service answered
  | 'provisioned' // the device answered (and usually joined)
  | 'unanswered'; // written, but the device never said it took it

/** Progress for the status line while an attempt runs. */
export type ProvisionPhase = 'connecting' | 'sending';

export function deviceLabel(device: BleDeviceLike): string {
  return device.name ?? device.id;
}

/** Log the refusal for a Bluetooth-only accessory; true when the device is one. */
export function refuseAccessory(device: BleDeviceLike, log: (line: string) => void): boolean {
  const name = deviceLabel(device);
  if (!isBleAccessory(name)) return false;
  log(
    `${name} is a Bluetooth-only accessory — there is no WiFi on it to configure. ` +
      'Pair it instead from the Devices tab, on the panel of the litter box ' +
      'or feeder that will relay for it.',
  );
  return true;
}

export async function provisionDevice(
  device: BleDeviceLike,
  cfg: ProvisionConfig,
  deps: SessionDeps & { onPhase: (phase: ProvisionPhase) => void },
): Promise<ProvisionOutcome> {
  const { log } = deps;
  if (refuseAccessory(device, log)) return 'accessory';
  if (!device.gatt) throw new DOMException('This device offers no GATT server.', 'NotFoundError');
  let gatt: GattServerLike | null = null;
  try {
    deps.onPhase('connecting');
    gatt = await device.gatt.connect();
    const server = gatt;
    // Ask for each service BY NAME, never by enumerating: the enumeration
    // lists what the browser has already discovered for this device, and a
    // D4SH that provisions through `getPrimaryService(0xAAA0)` can be missing
    // from it. Ingenic first, ESP32 as the fallback; the enumeration only
    // writes the error message, where an incomplete answer costs nothing.
    const open = async (uuid: string): Promise<GattServiceLike | null> => {
      try {
        return await server.getPrimaryService(uuid);
      } catch {
        return null;
      }
    };
    deps.onPhase('sending');
    const petkit = await open(BLE_SERVICE);
    const blufi = petkit ? null : await open(BLUFI_SERVICE);
    let heard: boolean;
    if (petkit) {
      log('protocol: PetKit (0xAAA0)');
      heard = await provisionIngenic(petkit, cfg, deps);
    } else if (blufi) {
      log('protocol: BLUFI (0xFFFF)');
      heard = await provisionBlufi(blufi, cfg, deps);
    } else {
      let seen: string[];
      try {
        seen = (await server.getPrimaryServices()).map(s => s.uuid);
      } catch (e) {
        seen = [`(could not be listed: ${asNamedError(e)?.name ?? 'Error'})`];
      }
      log(
        "This device answered to neither PetKit's provisioning service (0xAAA0) " +
          'nor PetKit ESP32 provisioning (0xFFFF), so there is nothing here that can configure it. ' +
          'Older models such as the Feeder Mini have no Bluetooth setup at all — ' +
          `those are pointed here with a DNS redirect instead. Services seen: ${seen.join(', ')}`,
      );
      return 'unknown-device';
    }
    // "Provisioned" means the device answered, not that a write returned: a
    // payload the firmware never understood must not read like a success.
    if (heard) {
      log('done. watching for the device to connect…');
      return 'provisioned';
    }
    log(
      'The payload was written and acknowledged at the Bluetooth level, but the ' +
        'device said nothing back. It may still join — watching — but if it does ' +
        'not, this log is what to report.',
    );
    return 'unanswered';
  } finally {
    try {
      gatt?.disconnect();
    } catch {
      /* already gone */
    }
  }
}

// The Web Bluetooth failures a person can fix, explained in the active language. Session log
// lines stay English: they are what gets pasted into a bug report.
const EXPLAINED_ERRORS = ['NotFoundError', 'SecurityError', 'NotAllowedError'] as const;
type ExplainedError = (typeof EXPLAINED_ERRORS)[number];

function isExplained(name: string): name is ExplainedError {
  return (EXPLAINED_ERRORS as readonly string[]).includes(name);
}

interface NamedError {
  name: string;
  message: string;
}

// Not `instanceof Error`: a DOMException is not an Error in every runtime.
function asNamedError(err: unknown): NamedError | null {
  if (typeof err !== 'object' || err === null) return null;
  const { name, message } = err as Partial<NamedError>;
  return typeof name === 'string'
    ? { name, message: typeof message === 'string' ? message : '' }
    : null;
}

/** The status-line sentence for a failed Web Bluetooth call. */
export function bluetoothErrorText(err: unknown): string {
  const e = asNamedError(err);
  if (!e) return String(err);
  return isExplained(e.name) ? i18n.t(`ble:error.${e.name}`) : `${e.name}: ${e.message}`;
}

/** The raw log line for a failed attempt. */
export function bluetoothErrorLogLine(err: unknown): string {
  const e = asNamedError(err);
  return e ? `ERROR ${e.name}: ${e.message}` : `ERROR ${String(err)}`;
}
