import type { components } from '@/api/schema';

// What the Setup screen knows about the server's live settings and their
// upstream. Pure data and helpers, no React.

export type LiveSettings = components['schemas']['SetupLiveSettings'];
export type ServerInfo = components['schemas']['SetupServerInfo'];
export type UpstreamChoice = components['schemas']['SetupUpstreamChoice'];

export type BoolSettingKey = {
  [K in keyof LiveSettings]: LiveSettings[K] extends boolean ? K : never;
}[keyof LiveSettings];

/** The edits not yet saved, keyed like the settings. */
export type SettingsDraft = Partial<LiveSettings>;

/** One on/off setting as the screen labels it. */
export interface ToggleDef {
  key: BoolSettingKey;
  label: string;
  description: string;
  /** Greyed out (still visible) while proxy mode is off. */
  needsProxy: boolean;
  /** Turning it OFF lets the real cloud reach the device: asks first. */
  offWarning?: string;
}

export const PROXY_TOGGLE: ToggleDef = {
  key: 'proxy_mode',
  label: "Proxy to PetKit's cloud",
  description:
    'Forwards every device request to the real PetKit cloud and answers with its reply. Only for adding a model nobody has captured yet.',
  needsProxy: false,
};

// Hiding "the RCE guard is on" while the proxy is off would be worse than
// showing it inactive, so the guards stay listed and grey out instead.
export const GUARD_TOGGLES: readonly ToggleDef[] = [
  {
    key: 'proxy_block_run_cmd',
    label: 'Block remote shell commands',
    description: 'Strips shell commands the cloud tries to run on the device.',
    needsProxy: true,
    offWarning:
      'While the proxy is on, the real PetKit cloud could run shell commands on your device as root.',
  },
  {
    key: 'proxy_block_ota',
    label: 'Block firmware updates',
    description: 'Answers the OTA endpoints locally and drops firmware images found anywhere else.',
    needsProxy: true,
    offWarning:
      'While the proxy is on, the real PetKit cloud could push a firmware image to your device.',
  },
  {
    key: 'proxy_block_log_upload',
    label: 'Block log uploads',
    description: 'Withholds the token the device needs to send its debug log to PetKit.',
    needsProxy: true,
    offWarning: 'While the proxy is on, your device could send its debug log to PetKit.',
  },
  {
    key: 'proxy_mqtt_bridge',
    label: 'Upstream MQTT bridge',
    description: "Also bridges the device's MQTT session to the real Aliyun broker.",
    needsProxy: true,
  },
  {
    key: 'proxy_media_real_oss',
    label: 'Media to the real OSS',
    description:
      'Lets the device upload recordings to PetKit instead of this server. Nothing lands locally.',
    needsProxy: true,
  },
  {
    key: 'proxy_local_cvr_window',
    label: 'Keep recording locally',
    description:
      "Ignores the cloud's subscription window and tells the camera its storage is active. A lapsed PetKit plan otherwise stops recording with no error anywhere.",
    needsProxy: true,
  },
];

export const CAPTURE_TOGGLE: ToggleDef = {
  key: 'capture',
  label: 'Save traffic',
  description:
    'Records every HTTP request and MQTT message to JSONL files, signing secrets included. Read them under Capture.',
  needsProxy: false,
};

/** The guards that refuse something outright; the finding line counts these. */
export const BLOCKING_GUARDS: readonly BoolSettingKey[] = [
  'proxy_block_run_cmd',
  'proxy_block_ota',
  'proxy_block_log_upload',
];

/**
 * Every `proxy_*` key and `capture` need a fresh step-up to write (the server's
 * `setting_key_tier`); every key this screen edits is one of them.
 */
export function needsStepUp(key: keyof LiveSettings): boolean {
  return key.startsWith('proxy_') || key === 'capture';
}

/** The preset an empty `proxy_upstream` resolves to, as the server flags it. */
export function defaultUpstream(presets: readonly UpstreamChoice[]): string {
  return (presets.find(u => u.default) ?? presets[0])?.key ?? '';
}

function sameValue<K extends keyof LiveSettings>(
  key: K,
  a: LiveSettings[K],
  b: LiveSettings[K],
  fallbackUpstream: string,
): boolean {
  if (key === 'proxy_upstream') return (a || fallbackUpstream) === (b || fallbackUpstream);
  return a === b;
}

/** The draft with `key` set, or with it dropped when it equals the saved value. */
export function withEdit<K extends keyof LiveSettings>(
  draft: SettingsDraft,
  saved: LiveSettings,
  key: K,
  value: LiveSettings[K],
  fallbackUpstream: string,
): SettingsDraft {
  const rest = Object.fromEntries(
    Object.entries(draft).filter(([k]) => k !== key),
  ) as SettingsDraft;
  return sameValue(key, value, saved[key], fallbackUpstream) ? rest : { ...rest, [key]: value };
}

/** `proxy_dns`: empty, or an IPv4 address with an optional port (hostnames refused). */
export function validDns(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  const [host = '', port, ...rest] = v.split(':');
  if (rest.length) return false;
  if (port !== undefined && !(/^\d+$/.test(port) && Number(port) > 0 && Number(port) < 65536)) {
    return false;
  }
  const octets = host.split('.');
  return octets.length === 4 && octets.every(o => /^\d{1,3}$/.test(o) && Number(o) < 256);
}

/** A typed upstream must at least be an http(s) URL; the server checks the host. */
export function validUpstream(value: string, presets: readonly UpstreamChoice[]): boolean {
  const v = value.trim();
  return !v || presets.some(p => p.key === v) || /^https?:\/\/[^/\s]+/i.test(v);
}

/** Why the draft cannot be saved, or null. */
export function draftProblem(
  draft: SettingsDraft,
  presets: readonly UpstreamChoice[],
): string | null {
  if (draft.proxy_dns !== undefined && !validDns(draft.proxy_dns)) {
    return 'The upstream resolver must be an IPv4 address, optionally with a port.';
  }
  if (draft.proxy_upstream !== undefined && !validUpstream(draft.proxy_upstream, presets)) {
    return 'The upstream host must be a preset or an http(s) URL.';
  }
  return null;
}

/** Proxied-call outcome counters (`ok`, `error_<code>`, `http_<status>`), summarised. */
export interface UpstreamSummary {
  total: number;
  ok: number;
  refused: { code: string; count: number }[];
  failed: { status: string; count: number }[];
}

export function summariseUpstream(counts: Record<string, number>): UpstreamSummary {
  const entries = Object.entries(counts);
  return {
    total: entries.reduce((sum, [, n]) => sum + n, 0),
    ok: counts.ok ?? 0,
    refused: entries
      .filter(([k]) => k.startsWith('error_'))
      .map(([k, count]) => ({ code: k.slice(6), count })),
    failed: entries
      .filter(([k]) => k.startsWith('http_'))
      .map(([k, count]) => ({ status: k.slice(5), count })),
  };
}
