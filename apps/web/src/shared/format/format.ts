// Values rendered the way the old panel (and Home Assistant) rendered them,
// as plain strings: components put them in text nodes, never markup.

export const MISSING = '—';

export function formatTime(unixSeconds: number | null | undefined): string {
  return unixSeconds ? new Date(unixSeconds * 1000).toLocaleTimeString() : MISSING;
}

export function relativeTime(unixSeconds: number | null | undefined, now = Date.now()): string {
  if (!unixSeconds) return 'never';
  const s = Math.max(0, Math.floor(now / 1000 - unixSeconds));
  if (s < 2) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return MISSING;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

/** A second count as a person reads it: `1d 15h`, `3h 2m`, `45s`. */
export function formatDuration(seconds: unknown): string | null {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n < 0) return null;
  const d = Math.floor(n / 86400);
  const h = Math.floor((n % 86400) / 3600);
  const m = Math.floor((n % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${Math.floor(n)}s`;
}

export function formatDateTime(value: unknown): string {
  const t = typeof value === 'number' ? value * 1000 : Date.parse(String(value));
  return Number.isFinite(t) ? new Date(t).toLocaleString() : String(value);
}

/** Text of a scalar as JavaScript prints it; JSON for anything else. */
function plain(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value); // values come from JSON, so never a function
}

/** A raw value: `—` for missing, on/off for booleans, JSON for objects. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return MISSING;
  if (value === true) return 'on';
  if (value === false) return 'off';
  return plain(value);
}

export interface EntityLike {
  value?: unknown;
  unit?: string | null;
  options?: readonly unknown[] | null;
  option_values?: readonly unknown[] | null;
  component?: string | null;
  device_class?: string | null;
}

/** One entity's value as Home Assistant shows it, split from its unit. */
export function formatEntityValue(entity: EntityLike): { text: string; unit: string | null } {
  const v = entity.value;
  const unit = entity.unit ?? null;
  if (v === null || v === undefined) return { text: MISSING, unit: null };
  if (entity.options?.length && entity.component !== 'event') {
    const values = entity.option_values?.length ? entity.option_values : entity.options;
    const i = values.findIndex(x => plain(x) === plain(v));
    // An unmapped value stays visible as itself: blanking it would hide a real state.
    if (i >= 0) return { text: plain(entity.options.at(i)), unit: null };
  }
  if (entity.component === 'binary_sensor') {
    return { text: v === 0 || v === '0' || v === false ? 'off' : 'on', unit: null };
  }
  // These carry their own units ("1d 15h", a date): appending the raw one reads "1d 15h s".
  if (entity.device_class === 'duration' && unit === 's') {
    const pretty = formatDuration(v);
    if (pretty) return { text: pretty, unit: null };
  }
  if (entity.device_class === 'timestamp') return { text: formatDateTime(v), unit: null };
  return { text: formatValue(v), unit };
}
