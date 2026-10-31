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

/** The guards that refuse something outright; the finding line counts these. */
export const BLOCKING_GUARDS = [
  'proxy_block_run_cmd',
  'proxy_block_ota',
  'proxy_block_log_upload',
] as const satisfies readonly BoolSettingKey[];

/** A guard whose OFF lets the real cloud reach the device, so turning it off asks first. */
export type GuardKey = (typeof BLOCKING_GUARDS)[number];

/** The on/off settings this screen shows; each has its label and description in `setup:toggle`. */
export type ToggleKey =
  | GuardKey
  | 'proxy_mode'
  | 'proxy_mqtt_bridge'
  | 'proxy_media_real_oss'
  | 'proxy_local_cvr_window'
  | 'capture';

/** One on/off setting; its words come from `setup:toggle.{key}`. */
export interface ToggleDef {
  key: ToggleKey;
  /** Greyed out (still visible) while proxy mode is off. */
  needsProxy: boolean;
}

export function isBlockingGuard(key: ToggleKey): key is GuardKey {
  return (BLOCKING_GUARDS as readonly string[]).includes(key);
}

export const PROXY_TOGGLE: ToggleDef = { key: 'proxy_mode', needsProxy: false };

// Hiding "the RCE guard is on" while the proxy is off would be worse than
// showing it inactive, so the guards stay listed and grey out instead.
export const GUARD_TOGGLES: readonly ToggleDef[] = [
  { key: 'proxy_block_run_cmd', needsProxy: true },
  { key: 'proxy_block_ota', needsProxy: true },
  { key: 'proxy_block_log_upload', needsProxy: true },
  { key: 'proxy_mqtt_bridge', needsProxy: true },
  { key: 'proxy_media_real_oss', needsProxy: true },
  { key: 'proxy_local_cvr_window', needsProxy: true },
];

export const CAPTURE_TOGGLE: ToggleDef = { key: 'capture', needsProxy: false };

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

/** Which field keeps the draft from being saved (its sentence is `setup:problem.{field}`), or null. */
export type DraftProblem = 'dns' | 'upstream';

export function draftProblem(
  draft: SettingsDraft,
  presets: readonly UpstreamChoice[],
): DraftProblem | null {
  if (draft.proxy_dns !== undefined && !validDns(draft.proxy_dns)) return 'dns';
  if (draft.proxy_upstream !== undefined && !validUpstream(draft.proxy_upstream, presets)) {
    return 'upstream';
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
