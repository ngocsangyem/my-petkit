// PetKit has one scheduling model and four shapes of it, and all but one count
// MINUTES SINCE LOCAL MIDNIGHT with Sunday as weekday 1. The exception is a
// feeder meal's `t`, which counts SECONDS since local midnight: the cloud's
// `n_46560` fires at 12:56:00 (D4SH capture). "Local" is the device's own
// clock, never the browser's.

/** Minutes in a day. 1440 is the end of the day and appears only in `[0, 1440]`. */
export const DAY_END = 1440;
/** Seconds in a day, the unit of a feeder meal's `t`. */
export const DAY_SECONDS = 86_400;
/** Weekday names in wire order: index 0 is weekday 1, Sunday. */
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
/** Every day of the week, as a new entry starts. */
export const EVERY_DAY = '1,2,3,4,5,6,7';

/** `[0, 1440]` is PetKit's own "entire day"; it is the only place 1440 appears. */
export const isAllDay = (pair: readonly [number, number]): boolean =>
  pair[0] === 0 && pair[1] === DAY_END;

/** Minutes since midnight as "HH:MM", or '' when it is not a minute of the day. */
export function minToClock(m: number): string {
  if (!Number.isFinite(m) || m < 0 || m > DAY_END) return '';
  const h = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(Math.floor(m) % 60).padStart(2, '0');
  return `${h}:${mm}`;
}

/** "HH:MM" as minutes since midnight, or null for anything else. */
export function clockToMin(s: string): number | null {
  const parts = s.split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59)
    return null;
  return h * 60 + m;
}

/** Feeder meals only: seconds since midnight as "HH:MM". */
export const secToClock = (s: number): string => minToClock(Math.floor(s / 60));

/** Feeder meals only: "HH:MM" as seconds since midnight, or null. */
export function clockToSec(s: string): number | null {
  const m = clockToMin(s);
  return m === null ? null : m * 60;
}

/** The weekday numbers (1..7) in a comma list; anything else is dropped. */
export function parseDays(days: string): Set<number> {
  return new Set(
    days
      .split(',')
      .map(Number)
      .filter(d => Number.isInteger(d) && d >= 1 && d <= 7),
  );
}

/** A day set as the wire's sorted comma list. */
export const formatDays = (days: ReadonlySet<number>): string =>
  [...days].sort((a, b) => a - b).join(',');

/** True when a comma list holds at least one day and only days 1..7, as the server requires. */
export function validDays(days: string): boolean {
  const parts = days.split(',');
  return (
    parts.length > 0 &&
    parts.every(p => {
      const d = Number(p.trim());
      return p.trim() !== '' && Number.isInteger(d) && d >= 1 && d <= 7;
    })
  );
}

// --- the device's time zone --------------------------------------------------

/** A wall clock shifted to the device's offset; read it with the UTC getters only. */
const shifted = (unixMs: number, offsetHours: number): Date =>
  new Date(unixMs + offsetHours * 3_600_000);

/** Today's date ("YYYY-MM-DD") on the device's clock. */
export function deviceToday(offsetHours: number, nowMs = Date.now()): string {
  return shifted(nowMs, offsetHours).toISOString().slice(0, 10);
}

const FIRE_AT_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC',
});

/** A unix-seconds moment as the device's own date and time. */
export function formatDeviceMoment(unixSeconds: number, offsetHours: number): string {
  return FIRE_AT_FORMAT.format(shifted(unixSeconds * 1000, offsetHours));
}

/** An hour offset as "UTC+7", "UTC+5:45", "UTC-3:30". */
export function formatOffset(offsetHours: number): string {
  const sign = offsetHours < 0 ? '-' : '+';
  const total = Math.round(Math.abs(offsetHours) * 60);
  const minutes = total % 60;
  const hours = Math.floor(total / 60);
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}
