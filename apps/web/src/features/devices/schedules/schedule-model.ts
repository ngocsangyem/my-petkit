import type { components } from '@/api/schema';
import { i18n } from '@/i18n';
import { DAY_END, DAY_SECONDS, validDays } from './schedule-clock';

// The four schedule shapes as the editors hold them. Nothing here sorts, merges
// or "tidies" a schedule: an end below its start crosses midnight, a one-minute
// range is something PetKit's own app produced, and both are correct. The only
// refusals are the ones the server makes (features/schedules/routes.py), so a
// Save button that is enabled is a Save the server will accept.

export type ScheduleTarget = components['schemas']['DeviceScheduleTarget'];
export type DeviceDetail = components['schemas']['DeviceDetail'];

/** `[start, end]` in minutes since local midnight, 0..1440. */
export type Range = [number, number];

/** A weekly entry: ranges plus weekdays (`rpt`, Sunday is 1) and a switch. */
export interface WeeklyEntry {
  enable: number;
  rpt: string;
  time: Range[];
}

/** One litter-box job: `type` 0 is a cleaning, 1 a deodorizing; both share one array. */
export interface PointEntry {
  id: number;
  repeats: string;
  /** Minutes since local midnight, 0..1439. */
  time: number;
  type: number;
}

/** One meal: `t` is SECONDS since local midnight; `a2` is the second hopper. */
export interface FeedMeal {
  id: string | number;
  t: number;
  a1: number;
  a2: number;
}

/** Meals sharing weekdays: `re` is the days, `it` the meals. */
export interface FeedGroup {
  re: string;
  it: FeedMeal[];
  itemJsonString?: string;
}

/** The feeder's schedule object. Keys this editor does not own (`deferred`, `v`) ride along. */
export interface FeedValue {
  schedule: FeedGroup[];
  [key: string]: unknown;
}

export type ScheduleDraft =
  | { kind: 'ranges'; value: Range[] }
  | { kind: 'weekly'; value: WeeklyEntry[] }
  | { kind: 'points'; value: PointEntry[] }
  | { kind: 'feed'; value: FeedValue };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? (v as unknown[]) : []);
const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const text = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';

function parseRanges(v: unknown): Range[] {
  return list(v)
    .filter((p): p is unknown[] => Array.isArray(p) && p.length === 2)
    .map(p => [num(p[0]), num(p[1])]);
}

function parseMeal(v: unknown): FeedMeal {
  const m = isRecord(v) ? v : {};
  const id = typeof m.id === 'string' || typeof m.id === 'number' ? m.id : 0;
  return { id, t: num(m.t), a1: num(m.a1), a2: num(m.a2) };
}

/** The server's current value of a target as the editor's typed working copy. */
export function draftOf(target: ScheduleTarget): ScheduleDraft {
  const raw = target.value;
  switch (target.kind) {
    case 'ranges':
      return { kind: 'ranges', value: parseRanges(raw) };
    case 'weekly':
      return {
        kind: 'weekly',
        value: list(raw).map(e => {
          const r = isRecord(e) ? e : {};
          return { enable: num(r.enable, 1) ? 1 : 0, rpt: text(r.rpt), time: parseRanges(r.time) };
        }),
      };
    case 'points':
      return {
        kind: 'points',
        value: list(raw).map(e => {
          const r = isRecord(e) ? e : {};
          return { id: num(r.id), repeats: text(r.repeats), time: num(r.time), type: num(r.type) };
        }),
      };
    case 'feed': {
      const r = isRecord(raw) ? raw : {};
      const schedule = list(r.schedule).map(g => {
        const group = isRecord(g) ? g : {};
        return { re: text(group.re), it: list(group.it).map(parseMeal) };
      });
      return { kind: 'feed', value: { ...r, schedule } };
    }
  }
}

const isMinute = (m: number, max: number) => Number.isInteger(m) && m >= 0 && m <= max;
const validRanges = (ranges: Range[]) =>
  ranges.every(([s, e]) => isMinute(s, DAY_END) && isMinute(e, DAY_END));
const isPortion = (n: number) => Number.isInteger(n) && n >= 0 && n <= 255;

/** Why the server would refuse this draft, as one sentence; null when it is valid. */
export function validateDraft(draft: ScheduleDraft): string | null {
  switch (draft.kind) {
    case 'ranges':
      return validRanges(draft.value) ? null : i18n.t('devices:schedules.invalid.periodOutside');
    case 'weekly':
      if (draft.value.some(e => !validDays(e.rpt))) {
        return i18n.t('devices:schedules.invalid.entryDays');
      }
      return draft.value.every(e => validRanges(e.time))
        ? null
        : i18n.t('devices:schedules.invalid.periodOutside');
    case 'points':
      if (draft.value.some(e => !validDays(e.repeats))) {
        return i18n.t('devices:schedules.invalid.timeDays');
      }
      return draft.value.every(e => isMinute(e.time, DAY_END - 1))
        ? null
        : i18n.t('devices:schedules.invalid.timeOutside');
    case 'feed':
      if (draft.value.schedule.some(g => !validDays(g.re))) {
        return i18n.t('devices:schedules.invalid.mealDays');
      }
      if (draft.value.schedule.some(g => g.it.some(m => !isMinute(m.t, DAY_SECONDS - 1)))) {
        return i18n.t('devices:schedules.invalid.mealOutside');
      }
      return draft.value.schedule.every(g => g.it.every(m => isPortion(m.a1) && isPortion(m.a2)))
        ? null
        : i18n.t('devices:schedules.invalid.portions');
  }
}

/** A deep copy of `value` with `change` applied to it; drafts are never mutated in place. */
export function edited<T>(value: T, change: (copy: T) => void): T {
  const copy = structuredClone(value);
  change(copy);
  return copy;
}

/** One above the highest numeric id held, which cannot collide with an entry already on the device. */
export const nextId = (ids: readonly (string | number)[]): number =>
  ids.reduce<number>((max, id) => Math.max(max, Number(id) || 0), 0) + 1;
