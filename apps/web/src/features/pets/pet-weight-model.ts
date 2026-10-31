// Pure rules of a pet's registered weight and weight matching, and of the
// per-device cat limit. The bounds mirror the server's validation
// (features/pets/weight_and_device_limit.py), which has the last word.
import type { components } from '@/api/schema';
import { currentLocale, i18n } from '@/i18n';
import { ApiError, errorMessage } from '@/shared/api/errors';
import { parseIdList, type Pet } from './pet-model';

export type PetUpdateRequest = components['schemas']['PetUpdateRequest'];

/** A box recognises at most this many cats (the server's `MAX_PETS_PER_DEVICE`). */
export const MAX_PETS_PER_DEVICE = 15;
/** The tolerance a pet has while its own is unset. */
export const DEFAULT_TOLERANCE_G = 300;
export const WEIGHT_G_MIN = 200;
export const WEIGHT_G_MAX = 20_000;
export const TOLERANCE_G_MIN = 50;
export const TOLERANCE_G_MAX = 2_000;

/** Grams as the kilograms a weight field shows ("5.43"); '' when there is none. */
export function gramsToKgText(grams: number | null): string {
  return grams === null || !Number.isFinite(grams) ? '' : (grams / 1000).toFixed(2);
}

/** A parsed field: the value to send (null clears it), or the sentence saying what is wrong. */
export type Parsed = { ok: true; value: number | null } | { ok: false; error: string };

/** Kilograms as typed (a decimal comma is fine) to whole grams; empty clears the weight. */
export function parseKgText(text: string): Parsed {
  const raw = text.trim().replace(',', '.');
  if (raw === '') return { ok: true, value: null };
  const kg = Number(raw);
  const grams = Math.round(kg * 1000);
  if (
    !/^\d*\.?\d*$/.test(raw) ||
    !Number.isFinite(kg) ||
    grams < WEIGHT_G_MIN ||
    grams > WEIGHT_G_MAX
  ) {
    return {
      ok: false,
      error: i18n.t('pets:weight.invalidKg', {
        min: gramsToKgText(WEIGHT_G_MIN),
        max: gramsToKgText(WEIGHT_G_MAX),
      }),
    };
  }
  return { ok: true, value: grams };
}

/** A tolerance in whole grams; empty means the default. */
export function parseToleranceText(text: string): Parsed {
  const raw = text.trim();
  if (raw === '') return { ok: true, value: null };
  const grams = Number(raw);
  if (!/^\d+$/.test(raw) || grams < TOLERANCE_G_MIN || grams > TOLERANCE_G_MAX) {
    return {
      ok: false,
      error: i18n.t('pets:weight.invalidTolerance', { min: TOLERANCE_G_MIN, max: TOLERANCE_G_MAX }),
    };
  }
  return { ok: true, value: grams };
}

/**
 * The guard on matching by weight, with its real number: a visit goes to this cat only when no
 * other cat sits within twice this cat's tolerance of the reading.
 */
export function matchGuardSentence(toleranceG: number | null): string {
  return i18n.t('pets:weight.guard', { grams: 2 * (toleranceG ?? DEFAULT_TOLERANCE_G) });
}

/** "13:58" the same day, "28 Oct" before it; null when never set. */
export function weightUpdatedWhen(ts: number | null, now: Date = new Date()): string | null {
  if (ts === null || !Number.isFinite(ts) || ts <= 0) return null;
  const at = new Date(ts * 1000);
  const sameDay = at.toDateString() === now.toDateString();
  return sameDay
    ? at.toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' })
    : at.toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short' });
}

/** "updated 13:58" the same day, "updated 28 Oct" before it; null when never set. */
export function weightUpdatedText(ts: number | null, now: Date = new Date()): string | null {
  const when = weightUpdatedWhen(ts, now);
  return when === null ? null : i18n.t('pets:weight.updated', { when });
}

/** How many pets each device recognises, from every pet's device list. */
export function petsPerDevice(pets: readonly Pet[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const p of pets) {
    for (const id of new Set(parseIdList(p.device_ids_json))) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

export function isDeviceFull(counts: ReadonlyMap<number, number>, deviceId: number): boolean {
  return (counts.get(deviceId) ?? 0) >= MAX_PETS_PER_DEVICE;
}

/** "2 of 15 cats on this box". */
export function deviceLoadText(count: number): string {
  return i18n.t('pets:weight.load', { n: count, max: MAX_PETS_PER_DEVICE });
}

/** The sentence for a refused create or update; the per-box limit gets words of its own. */
export function petSaveError(error: unknown): string {
  if (error instanceof ApiError && error.code === 'too_many_pets') {
    return i18n.t('pets:weight.tooMany', { max: MAX_PETS_PER_DEVICE });
  }
  return errorMessage(error);
}

/** The weight form as typed. */
export interface WeightDraft {
  weightKg: string;
  toleranceG: string;
  match: boolean;
}

export function weightDraft(pet: Pet): WeightDraft {
  return {
    weightKg: gramsToKgText(pet.weight_g),
    toleranceG: pet.weight_tolerance_g === null ? '' : String(pet.weight_tolerance_g),
    // Unset is on: the column defaults to 1.
    match: pet.weight_match !== 0,
  };
}

/**
 * Only what changed, because sending `weight_g` at all restamps `weight_updated_at`. Null when
 * a field is invalid (the form shows why); an empty object when nothing changed.
 */
export function weightUpdateBody(pet: Pet, draft: WeightDraft): PetUpdateRequest | null {
  const weight = parseKgText(draft.weightKg);
  const tolerance = parseToleranceText(draft.toleranceG);
  if (!weight.ok || !tolerance.ok) return null;
  const body: PetUpdateRequest = {};
  // Compared as shown: a stored 5432 g reads "5.43", and leaving it alone must not round it.
  if (draft.weightKg.trim() !== gramsToKgText(pet.weight_g)) body.weight_g = weight.value;
  if (tolerance.value !== pet.weight_tolerance_g) body.weight_tolerance_g = tolerance.value;
  if (draft.match !== weightDraft(pet).match) body.weight_match = draft.match;
  return body;
}
