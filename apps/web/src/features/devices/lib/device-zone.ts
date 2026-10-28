import type { components } from '@/api/schema';

type TimezoneView = components['schemas']['DeviceTimezoneView'];

// Where a device's day starts and ends. The server decides a device's zone in
// `Device.timezone_offset` (override, then the IANA name the device reported,
// then the number it reported, then the server clock) and sends the outcome as
// `timezoneInfo`. We follow the same rung:
//
// - `source === 'locale'` means the offset came from the zone NAME the device
//   sent, so the name is used as an IANA zone: it is DST-correct, which a frozen
//   offset is not for half the year.
// - Anything else (an override, the device's number, the server clock) is a
//   fixed offset in hours, used as `effective`.
//
// The browser's own zone is never consulted.

/** A device's local zone: an IANA name, or a fixed offset east of UTC in hours. */
export type DeviceZone = { kind: 'iana'; name: string } | { kind: 'offset'; hours: number };

/** Calendar fields of an instant in a zone; `weekday` is 0 for Sunday. */
export interface ZoneParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** True when the runtime knows `name` as an IANA zone. */
export function isIanaZone(name: string): boolean {
  if (!name.includes('/') && name !== 'UTC') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/** The zone a device's local times are read in, or null when the view is missing. */
export function deviceZone(view: TimezoneView | null | undefined): DeviceZone | null {
  if (!view) return null;
  if (view.source === 'locale' && isIanaZone(view.locale)) {
    return { kind: 'iana', name: view.locale };
  }
  return Number.isFinite(view.effective) ? { kind: 'offset', hours: view.effective } : null;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
      hourCycle: 'h23',
    });
    formatters.set(zone, f);
  }
  return f;
}

/** Calendar fields of `epochSeconds` in `zone`. */
export function zoneParts(epochSeconds: number, zone: DeviceZone): ZoneParts {
  if (zone.kind === 'offset') {
    const d = new Date((epochSeconds + zone.hours * 3600) * 1000);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
      weekday: d.getUTCDay(),
    };
  }
  const fields: Record<string, string> = {};
  for (const part of formatterFor(zone.name).formatToParts(new Date(epochSeconds * 1000))) {
    fields[part.type] = part.value;
  }
  const num = (key: string) => Number(fields[key] ?? 0);
  return {
    year: num('year'),
    month: num('month'),
    day: num('day'),
    hour: num('hour') % 24,
    minute: num('minute'),
    second: num('second'),
    weekday: WEEKDAY_INDEX[fields.weekday ?? 'Sun'] ?? 0,
  };
}

/** Minutes since local midnight in `zone` (fractional). */
export function minuteOfDay(epochSeconds: number, zone: DeviceZone): number {
  const p = zoneParts(epochSeconds, zone);
  return p.hour * 60 + p.minute + p.second / 60;
}

/** The local calendar day of an instant, as YYYY-MM-DD. */
export function localDateKey(epochSeconds: number, zone: DeviceZone): string {
  const p = zoneParts(epochSeconds, zone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "HH:MM" of an instant in `zone`. */
export function localClock(epochSeconds: number, zone: DeviceZone): string {
  const p = zoneParts(epochSeconds, zone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Tue 28 Oct" for an instant in `zone`. */
export function localDayLabel(epochSeconds: number, zone: DeviceZone): string {
  const p = zoneParts(epochSeconds, zone);
  return `${DAYS[p.weekday] ?? ''} ${p.day} ${MONTHS[p.month - 1] ?? ''}`.trim();
}

/** "Asia/Saigon", or "UTC+7" / "UTC-3.5" for a fixed offset. */
export function zoneLabel(zone: DeviceZone): string {
  if (zone.kind === 'iana') return zone.name;
  return `UTC${zone.hours >= 0 ? '+' : ''}${zone.hours}`;
}

/** The YYYY-MM-DD before `date` (pure calendar arithmetic; no zone involved). */
export function previousDateKey(date: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - 1));
  return d.toISOString().slice(0, 10);
}
