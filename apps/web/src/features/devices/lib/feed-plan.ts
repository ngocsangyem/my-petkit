import type { components } from '@/api/schema';
import { i18n } from '@/i18n';
import { formatMinute } from '@/shared/ui';
import { type DeviceZone, zoneParts } from './device-zone';

type Detail = components['schemas']['DeviceDetail'];

/** One planned meal today: minutes since the device's midnight and its portions. */
export interface PlannedMeal {
  minute: number;
  a1: number;
  a2: number;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * Today's meals from a feeder's `feed` schedule target, in the device's day.
 *
 * Wire shape (read out of a D4SH `ctrl`): `{schedule: [{re, it: [{id, t, a1, a2}]}]}`,
 * where `re` is a comma list of weekdays with SUNDAY = 1 and a meal's `t` counts
 * SECONDS since local midnight (every other schedule counts minutes).
 */
export function todaysMeals(detail: Detail, zone: DeviceZone, nowSeconds: number): PlannedMeal[] {
  const target = detail.schedules.find(s => s.kind === 'feed');
  if (!target || typeof target.value !== 'object' || target.value === null) return [];
  const groups = (target.value as { schedule?: unknown }).schedule;
  if (!Array.isArray(groups)) return [];
  const weekday = zoneParts(nowSeconds, zone).weekday + 1;
  const meals: PlannedMeal[] = [];
  for (const group of groups as unknown[]) {
    if (typeof group !== 'object' || group === null) continue;
    const g = group as { re?: unknown; it?: unknown };
    const days = (typeof g.re === 'string' || typeof g.re === 'number' ? String(g.re) : '')
      .split(',')
      .map(Number);
    if (!days.includes(weekday) || !Array.isArray(g.it)) continue;
    for (const item of g.it as unknown[]) {
      if (typeof item !== 'object' || item === null) continue;
      const m = item as { t?: unknown; a1?: unknown; a2?: unknown };
      const t = num(m.t);
      if (t < 0 || t >= 86400) continue;
      meals.push({ minute: t / 60, a1: num(m.a1), a2: num(m.a2) });
    }
  }
  return meals.sort((a, b) => a.minute - b.minute);
}

/** "HH:MM" of the next meal after `nowMinute`, or null. */
export function nextMealClock(meals: readonly PlannedMeal[], nowMinute: number): string | null {
  const next = meals.find(m => m.minute > nowMinute);
  return next ? formatMinute(next.minute) : null;
}

/** "2 portions" / "2 + 1 portions" for a meal. */
export function portionsText(meal: PlannedMeal, dual: boolean): string {
  if (dual) return i18n.t('devices:meal.dualPortions', { a1: meal.a1, a2: meal.a2 });
  return i18n.t('devices:meal.portions', { count: meal.a1 });
}
