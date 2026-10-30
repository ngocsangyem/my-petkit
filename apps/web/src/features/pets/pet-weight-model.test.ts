import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api/errors';
import { pet } from './pets-fixtures';
import {
  deviceLoadText,
  gramsToKgText,
  isDeviceFull,
  matchGuardSentence,
  parseKgText,
  parseToleranceText,
  petSaveError,
  petsPerDevice,
  weightDraft,
  weightUpdateBody,
  weightUpdatedText,
} from './pet-weight-model';

describe('pet weight rules', () => {
  it('converts grams to kilograms and back', () => {
    expect(gramsToKgText(5430)).toBe('5.43');
    expect(gramsToKgText(null)).toBe('');
    expect(parseKgText('5.43')).toEqual({ ok: true, value: 5430 });
    expect(parseKgText(' 4,8 ')).toEqual({ ok: true, value: 4800 });
    expect(parseKgText('')).toEqual({ ok: true, value: null });
  });

  it('refuses weights outside 0.20 to 20.00 kg and anything that is not a number', () => {
    for (const text of ['0.1', '20.5', '5430', 'abc', '-3', '1e1']) {
      expect(parseKgText(text).ok, text).toBe(false);
    }
    expect(parseKgText('0.2').ok).toBe(true);
    expect(parseKgText('20').ok).toBe(true);
  });

  it('takes a tolerance in whole grams from 50 to 2000, empty for the default', () => {
    expect(parseToleranceText('250')).toEqual({ ok: true, value: 250 });
    expect(parseToleranceText('')).toEqual({ ok: true, value: null });
    for (const text of ['49', '2001', '12.5', 'x']) {
      expect(parseToleranceText(text).ok, text).toBe(false);
    }
  });

  it('prints the real guard distance, twice the tolerance', () => {
    expect(matchGuardSentence(null)).toBe('Only when no other cat is within 600 g.');
    expect(matchGuardSentence(250)).toBe('Only when no other cat is within 500 g.');
  });

  it('says when the weight changed: a time today, a date before', () => {
    const now = new Date(2026, 9, 28, 15, 0);
    const today = new Date(2026, 9, 28, 13, 58).getTime() / 1000;
    const earlier = new Date(2026, 9, 20, 9, 0).getTime() / 1000;
    const time = new Date(today * 1000).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    expect(weightUpdatedText(today, now)).toBe(`updated ${time}`);
    expect(weightUpdatedText(earlier, now)).toMatch(/^updated .*20/);
    expect(weightUpdatedText(null, now)).toBeNull();
  });

  it('sends only what changed, so an untouched weight keeps its timestamp', () => {
    const miso = pet({ weight_g: 5432, weight_tolerance_g: null, weight_match: null });
    const draft = weightDraft(miso);
    expect(draft).toEqual({ weightKg: '5.43', toleranceG: '', match: true });
    expect(weightUpdateBody(miso, draft)).toEqual({});
    expect(weightUpdateBody(miso, { ...draft, toleranceG: '250', match: false })).toEqual({
      weight_tolerance_g: 250,
      weight_match: false,
    });
    expect(weightUpdateBody(miso, { ...draft, weightKg: '' })).toEqual({ weight_g: null });
    expect(weightUpdateBody(miso, { ...draft, weightKg: '99' })).toBeNull();
  });

  it('counts cats per box against the limit of 15', () => {
    const pets = Array.from({ length: 15 }, (_, i) =>
      pet({ id: i + 1, device_ids_json: i < 14 ? '[1, 2]' : '[1]' }),
    );
    const load = petsPerDevice(pets);
    expect(load.get(1)).toBe(15);
    expect(isDeviceFull(load, 1)).toBe(true);
    expect(isDeviceFull(load, 2)).toBe(false);
    expect(deviceLoadText(14)).toBe('14 of 15 cats on this box');
  });

  it('names the per-box limit when the server refuses a cat', () => {
    expect(petSaveError(new ApiError(409, 'too_many_pets', 'device 1 already has 15'))).toMatch(
      /already recognises 15 cats/,
    );
    expect(petSaveError(new ApiError(400, 'invalid_body', 'Bad weight.'))).toBe('Bad weight.');
  });
});
