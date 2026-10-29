// Pure geometry for the household day strip. Inputs are minutes since local
// midnight already computed in the DEVICE's timezone by the caller; nothing
// here reads a clock or a timezone.

/** Minutes in the strip's 24-hour axis. */
export const MINUTES_PER_DAY = 1440;

/** Clamps minutes since midnight into the day, treating non-finite input as 0. */
export function clampMinute(minute: number): number {
  if (!Number.isFinite(minute)) return 0;
  return Math.min(MINUTES_PER_DAY, Math.max(0, minute));
}

/** X position on the strip, in percent of its width (0 at 00:00, 100 at 24:00). */
export function minuteToPercent(minute: number): number {
  return (clampMinute(minute) / MINUTES_PER_DAY) * 100;
}

/** CSS `left` for a mark at `minute`. */
export function leftAt(minute: number): string {
  return `${minuteToPercent(minute)}%`;
}

/** CSS `left` and `width` for a span from `start` to `end`; an inverted span is empty. */
export function spanAt(start: number, end: number): { left: string; width: string } {
  const a = minuteToPercent(start);
  const b = minuteToPercent(end);
  return { left: `${a}%`, width: `${Math.max(0, b - a)}%` };
}

/** "HH:MM" for minutes since midnight (24:00 stays 24:00). */
export function formatMinute(minute: number): string {
  const m = Math.round(clampMinute(minute));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
