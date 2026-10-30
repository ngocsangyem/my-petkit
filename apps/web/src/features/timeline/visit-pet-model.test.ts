import { describe, expect, it } from 'vitest';
import { PETS, day, pet, session } from './timeline-fixtures';
import { clockTime, visibleFilters } from './timeline-model';
import {
  canChangeCat,
  changeCatContext,
  changeCatTitle,
  initialChoice,
  PASSING,
  petSourceTag,
  rankCandidates,
  visitPetBody,
} from './visit-pet-model';

const unrecognised = session({
  pet_id: null,
  pet_name: null,
  pet_photo_url: null,
  pet_source: null,
  weight: 5400,
  unbound_pet_ref: 7301552,
});

describe('change cat rules', () => {
  it('ranks the cats by closeness to the visit weight and marks only the nearest', () => {
    const tofu = pet(3, 'Tofu', [], null);
    const ranked = rankCandidates([tofu, ...PETS], 3900);
    expect(ranked.map(c => c.pet.name)).toEqual(['Mochi', 'Miso', 'Tofu']);
    expect(ranked.map(c => c.closest)).toEqual([true, false, false]);
    expect(ranked[0]?.registered).toBe('3.86 kg registered');
    expect(ranked[2]?.registered).toBeNull();
  });

  it('keeps the order and names nobody closest when the visit has no reading', () => {
    const ranked = rankCandidates(PETS, null);
    expect(ranked.map(c => c.pet.name)).toEqual(['Miso', 'Mochi']);
    expect(ranked.some(c => c.closest)).toBe(false);
  });

  it('builds the body for a cat, its weight and its identity', () => {
    expect(visitPetBody(unrecognised, '1', true, true)).toEqual({
      pet_id: 1,
      passing: false,
      use_weight: true,
      apply_to_ref: true,
    });
    expect(visitPetBody(unrecognised, '2', false, false)).toEqual({
      pet_id: 2,
      passing: false,
      use_weight: false,
      apply_to_ref: false,
    });
  });

  it('never sends options that cannot apply', () => {
    expect(visitPetBody(unrecognised, PASSING, true, true)).toEqual({
      pet_id: null,
      passing: true,
      use_weight: false,
      apply_to_ref: false,
    });
    // No reading on the visit and no reported identity: both options drop out.
    expect(visitPetBody(session({ weight: null }), '1', true, true)).toEqual({
      pet_id: 1,
      passing: false,
      use_weight: false,
      apply_to_ref: false,
    });
  });

  it('does not offer a reading the server would refuse as a weight', () => {
    expect(visitPetBody(session({ weight: 150 }), '1', true, false).use_weight).toBe(false);
    expect(visitPetBody(session({ weight: 25_000 }), '1', true, false).use_weight).toBe(false);
    expect(visitPetBody(session({ weight: 200 }), '1', true, false).use_weight).toBe(true);
  });

  it('opens on the visit pet, on "passing", or on nothing', () => {
    expect(initialChoice(session())).toBe('1');
    expect(initialChoice(unrecognised)).toBe('');
    expect(initialChoice(session({ pet_id: null, passing: true }))).toBe(PASSING);
  });

  it('asks about the visit time and says how the cat was decided', () => {
    expect(changeCatTitle(unrecognised)).toBe(
      `Who used the box at ${clockTime(unrecognised.display_ts) ?? ''}?`,
    );
    expect(changeCatContext(unrecognised)).toBe(
      'The camera did not recognise the cat. The scale read 5.40 kg.',
    );
    expect(changeCatContext(session())).toBe('The camera recognised Miso. The scale read 5.43 kg.');
    expect(changeCatContext(session({ pet_source: 'weight', weight: null }))).toBe(
      'The camera did not recognise the cat; the weight matched Miso. The scale reported no weight.',
    );
    expect(changeCatContext(session({ pet_source: 'manual' }))).toMatch(
      /^You assigned this visit to Miso\./,
    );
  });

  it('tags a visit by weight, unrecognised or just passing, and only visits', () => {
    expect(petSourceTag(session({ pet_source: 'weight' }))).toEqual({
      kind: 'badge',
      label: 'by weight',
    });
    expect(petSourceTag(unrecognised)).toEqual({ kind: 'text', label: 'not recognised' });
    expect(petSourceTag(session({ pet_id: null, passing: true }))?.label).toBe('just passing');
    expect(petSourceTag(session())).toBeNull();
    expect(petSourceTag(session({ kind: 'event', pet_id: null }))).toBeNull();
    expect(canChangeCat(session({ id: 'ep-1' }))).toBe(false);
    expect(canChangeCat(session())).toBe(true);
  });

  it('shows the light visits chip only when there are some or it is chosen', () => {
    expect(visibleFilters(day().counts, 'all').map(f => f.key)).not.toContain('passing');
    const counts = { ...day().counts, passing: 2 };
    expect(visibleFilters(counts, 'all').find(f => f.key === 'passing')?.label).toBe(
      'Light visits',
    );
  });
});
