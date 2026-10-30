// Calendar days as the server cuts them: at the reader's LOCAL midnight, written `YYYY-MM-DD`.
// Shared by every screen that asks the server for a day (Timeline, a pet's history).

/**
 * "Today" as the server means it when it cuts a day: at LOCAL midnight. `toISOString()` is UTC,
 * so east of Greenwich it would name tomorrow late in the evening and yesterday just after midnight.
 */
export function todayLocal(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** `YYYY-MM-DD` moved by `n` calendar days (calendar arithmetic, immune to DST). */
export function shiftDay(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
