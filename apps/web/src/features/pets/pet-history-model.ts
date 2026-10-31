// Pure rules of a pet's recent history: which days to ask for, what one day says about the pet
// (its visits and its weighed reading), and the trend the weight chart draws. The days come from
// the timeline's own day route, narrowed to the pet; nothing here touches the network.
import type { components } from '@/api/schema';
import { currentLocale, i18n } from '@/i18n';
import { shiftDay } from '@/shared/format/local-day';

export type HistoryDay = components['schemas']['TimelineDay'];

/** The longest span the weight chart offers; the visits chart uses the last seven of it. */
export const HISTORY_DAYS = 14;
export const VISIT_DAYS = 7;

/** The span of the weight chart, in days. */
export type WeightRange = 7 | 14;

/** The last `count` days ending today, oldest first. */
export function historyDates(today: string, count: number = HISTORY_DAYS): string[] {
  return Array.from({ length: count }, (_, i) => shiftDay(today, i - count + 1));
}

/** One day of a pet: how often it used the box, and the middle of its weighed visits. */
export interface PetDay {
  date: string;
  /** Null while the day is loading or when it could not be read. */
  visits: number | null;
  /** Grams; null when no visit of this pet carried a reading. */
  weightG: number | null;
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted.at(mid) ?? 0;
  return sorted.length % 2 ? hi : ((sorted.at(mid - 1) ?? hi) + hi) / 2;
}

/**
 * What one day says about the pet. The day was asked for narrowed to the pet, so its toileting
 * count is the pet's visits; the reading is the median, so one odd weighing does not move it.
 */
export function petDay(date: string, day: HistoryDay | undefined, petId: number): PetDay {
  if (!day) return { date, visits: null, weightG: null };
  const readings = day.sessions
    .filter(s => s.kind === 'visit' && s.pet_id === petId)
    .map(s => s.weight)
    .filter((w): w is number => w !== null && Number.isFinite(w) && w > 0);
  return { date, visits: day.counts.toileting, weightG: median(readings) };
}

/** The weighed days of the last `range` days, oldest first. */
export function weightPoints(
  days: readonly PetDay[],
  range: WeightRange,
): { date: string; grams: number }[] {
  return days
    .slice(-range)
    .flatMap(d => (d.weightG === null ? [] : [{ date: d.date, grams: d.weightG }]));
}

/** "+0.04 kg over 14 days"; null with fewer than two weighed days. */
export function weightTrendText(
  points: readonly { grams: number }[],
  range: WeightRange,
): string | null {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || points.length < 2) return null;
  const delta = (last.grams - first.grams) / 1000;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  return i18n.t('pets:history.trend', {
    sign,
    delta: Math.abs(delta).toFixed(2),
    days: range,
  });
}

/** The chart's vertical span in grams: the readings with a margin, never narrower than 100 g. */
export function weightScale(points: readonly { grams: number }[]): { min: number; max: number } {
  const grams = points.map(p => p.grams);
  const lo = Math.min(...grams);
  const hi = Math.max(...grams);
  const pad = Math.max(50, (hi - lo) * 0.25);
  return { min: lo - pad, max: hi + pad };
}

/** Average visits a day over the days that loaded; null when none did. */
export function visitsPerDay(days: readonly PetDay[]): number | null {
  const known = days.flatMap(d => (d.visits === null ? [] : [d.visits]));
  if (!known.length) return null;
  return known.reduce((a, b) => a + b, 0) / known.length;
}

/** "15 Oct", the calendar date as written under a chart. */
export function shortDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "W", the one-letter weekday under a bar. */
export function weekdayLetter(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(currentLocale(), { weekday: 'narrow', timeZone: 'UTC' });
}
