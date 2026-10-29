// What gets sent (the key-151 payload, the time-zone choices) and what is
// refused or warned about before anything is sent. Pure: environment facts
// come in as arguments, so the iOS port can share the vectors.

import type { PetkitPayload } from './provisioning-protocol';

/**
 * Advertised-name prefixes that can never be provisioned: BLE-only
 * accessories, which have no Wi-Fi to configure. They show up in the chooser
 * because the filter is a name prefix, and selecting one used to end in a raw
 * NotFoundError.
 */
export const BLE_ACCESSORY_PREFIXES: readonly string[] = [
  'Petkit_W5',
  'Petkit_W4X',
  'Petkit_CTW2',
  'Petkit_CTW3',
  'Petkit_K2',
  'Petkit_K3',
];

/** The chooser's filter: every PetKit device advertises a name with this prefix. */
export const PETKIT_NAME_PREFIX = 'Petkit';

export function isBleAccessory(name: string): boolean {
  return BLE_ACCESSORY_PREFIXES.some(p => name.startsWith(p));
}

/** One entry of the time-zone picker: hours east of UTC and its label. */
export interface TimezoneOption {
  hours: number;
  label: string;
}

/** "UTC+05:45" for 5.75. */
export function utcOffsetLabel(hours: number): string {
  const sign = hours < 0 ? '-' : '+';
  const abs = Math.abs(hours);
  const hh = String(Math.floor(abs)).padStart(2, '0');
  const mm = String(Math.round((abs % 1) * 60)).padStart(2, '0');
  return `UTC${sign}${hh}:${mm}`;
}

// Offsets are what the device actually stores: `ctrl` parses
// "…locale:%s timezone:%f" into a single float of hours east of UTC and reports
// it back as "&timezone=%.1f". A city list would imply a DST awareness it does
// not have, so the picker shows the thing being stored. Quarter-hour steps
// because Nepal (+5:45), Chatham (+12:45) and India (+5:30) exist.
export function timezoneOptions(): TimezoneOption[] {
  const out: TimezoneOption[] = [];
  for (let q = -48; q <= 56; q++) out.push({ hours: q / 4, label: utcOffsetLabel(q / 4) });
  return out;
}

/** The browser's current offset in hours east of UTC (`Date#getTimezoneOffset` is minutes west). */
export function detectedOffsetHours(minutesWest: number): number {
  return -minutesWest / 60;
}

/** What the form collected. */
export interface ProvisionInput {
  ssid: string;
  pwd: string;
  server: string;
  /** Hours east of UTC. */
  timezone: number;
  /** IANA zone name, e.g. "Europe/Amsterdam"; '' when the browser has none. */
  zoneName: string;
  /** Browser language tag, e.g. "en-US". */
  browserLanguage: string;
}

/** Everything a session needs: the key-151 payload plus the language key 114 sends. */
export interface ProvisionConfig {
  language: string;
  payload: PetkitPayload;
}

// The app's key-151 payload, field for field (`BleDeviceBindProgressPresenter.
// proceedNextStep`, PetKit 13.8.1): `hide` is the constant 1 rather than
// anything about the network, and the offset goes out as a STRING of hours.
//
// `locale` is a TIME ZONE NAME, not a language: PetKit's own app fills it with
// `TimeZone.getDefault().getID()`, and a real D4 echoes it back as
// `timezone=2.0&locale=Europe/Amsterdam`. It comes from the browser, because an
// offset names no single zone; the picker may then disagree with it, which is
// the right way round — the number runs the clock, the name is a label.
//
// The device has no timezone of its own (it burns UTC into video watermarks
// otherwise); this payload is the only path that sets one at provisioning.
// Key order is the app's and is kept; JSON.stringify does not escape `/`.
export function buildProvisionConfig(input: ProvisionInput): ProvisionConfig {
  return {
    language: (input.browserLanguage || 'en_US').replace('-', '_'),
    payload: {
      ssid: input.ssid,
      pwd: input.pwd,
      hide: 1,
      locale: input.zoneName,
      timezone: input.timezone.toFixed(1),
      apiServers: [input.server],
      ipServers: [input.server],
    },
  };
}

/** Why the form is switched off, if it is. */
export type EnvironmentBlock = 'insecure-context' | 'no-web-bluetooth' | null;

// THE INSECURE CHECK MUST COME FIRST. Web Bluetooth is a secure-context-only
// API, so on plain HTTP the browser does not expose `navigator.bluetooth` AT
// ALL — it is missing in Chrome exactly as it is in Firefox. Testing it first
// told two users their browser was unsupported while they were on Chrome and
// the only thing wrong was the page being HTTP. The browser message is only
// meaningful once the context is secure.
//
// A secure context is the ONLY gate: inside the Home Assistant Ingress iframe
// provisioning works as long as HA is served over a valid certificate.
export function environmentBlock(hasBluetooth: boolean, secure: boolean): EnvironmentBlock {
  if (!secure) return 'insecure-context';
  if (!hasBluetooth) return 'no-web-bluetooth';
  return null;
}

/** An advisory about the server URL: the page works, some hardware cannot use the URL. */
export type UrlWarning = 'mdns-host' | 'not-port-80';

// These hints are ADVISORY. They never switch the form off and never borrow
// the blocking colour: a user who can provision perfectly well should not be
// shown a stopped form. ESP32 devices (T4, D4) provisioned with another port
// reach Wi-Fi and then fail to reach the server.
export function provisionUrlWarning(value: string): UrlWarning[] {
  const out: UrlWarning[] = [];
  if (/\.local(?=[:/]|$)/i.test(value)) out.push('mdns-host');
  let url: URL | null = null;
  try {
    url = new URL(value);
  } catch {
    /* the field may still be half-typed */
  }
  if (url) {
    const port =
      url.port || (url.protocol === 'http:' ? '80' : url.protocol === 'https:' ? '443' : '');
    if (port && port !== '80') out.push('not-port-80');
  }
  return out;
}
