// Pure rules of the "Change cat" sheet: who the candidates are, in which order, what the
// sheet says about the visit, and the body the server takes. Nothing here touches the network.
import type { TimelinePet, VisitPetRequest } from './api';
import { clockTime, formatWeight, type TimelineSession } from './timeline-model';

/** What the radio group holds: a pet's id as a string, or the "just passing" choice. */
export const PASSING = 'passing';

/** One row of the radio group, with what it says under the name. */
export interface VisitCandidate {
  pet: TimelinePet;
  /** "5.43 kg registered", or null when the pet has no registered weight. */
  registered: string | null;
  /** True on the one pet whose registered weight sits nearest the visit's reading. */
  closest: boolean;
}

/**
 * Every pet, nearest registered weight first. Pets with no registered weight keep their order
 * after the weighed ones; with no reading on the visit nobody is "closest" and the order is kept.
 */
export function rankCandidates(
  pets: readonly TimelinePet[],
  visitGrams: number | null,
): VisitCandidate[] {
  const reading = visitGrams !== null && visitGrams > 0 ? visitGrams : null;
  const distance = (p: TimelinePet) =>
    reading === null || p.weight_g === null ? Infinity : Math.abs(p.weight_g - reading);
  const ranked = pets
    .map((pet, index) => ({ pet, index, d: distance(pet) }))
    .sort((a, b) => a.d - b.d || a.index - b.index);
  return ranked.map(({ pet, d }, i) => ({
    pet,
    registered: pet.weight_g === null ? null : `${formatWeight(pet.weight_g) ?? ''} registered`,
    closest: i === 0 && Number.isFinite(d),
  }));
}

/** The radio value the sheet opens on: the visit's pet, "passing", or nothing chosen yet. */
export function initialChoice(s: TimelineSession): string {
  if (s.pet_id !== null) return String(s.pet_id);
  return s.passing ? PASSING : '';
}

/** The question the sheet asks. */
export function changeCatTitle(s: TimelineSession): string {
  const at = clockTime(s.display_ts ?? s.ts);
  return at ? `Who used the box at ${at}?` : 'Who used the box?';
}

/** One line on how the visit was attributed so far, and what the scale read. */
export function changeCatContext(s: TimelineSession): string {
  const weight = formatWeight(s.weight);
  const scale = weight ? `The scale read ${weight}.` : 'The scale reported no weight.';
  let who: string;
  if (s.passing) {
    who =
      s.pet_source === 'manual'
        ? 'You marked this as no cat.'
        : 'This looked too light to be any registered cat.';
  } else if (!s.pet_name) {
    who =
      s.pet_source === 'manual'
        ? 'You cleared the cat of this visit.'
        : 'The camera did not recognise the cat.';
  } else if (s.pet_source === 'weight') {
    who = `The camera did not recognise the cat; the weight matched ${s.pet_name}.`;
  } else if (s.pet_source === 'manual') {
    who = `You assigned this visit to ${s.pet_name}.`;
  } else {
    who = `The camera recognised ${s.pet_name}.`;
  }
  return `${who} ${scale}`;
}

/** The registered weights the server accepts, in grams; a reading outside them is refused. */
const PLAUSIBLE_G = { min: 200, max: 20_000 } as const;

/**
 * True when the visit's reading could become a pet's registered weight. A reading outside what
 * the server accepts (`implausible_weight`) is not offered at all.
 */
export function hasVisitWeight(s: TimelineSession): boolean {
  return (
    s.weight !== null &&
    Number.isFinite(s.weight) &&
    s.weight >= PLAUSIBLE_G.min &&
    s.weight <= PLAUSIBLE_G.max
  );
}

/** What the sheet sends for the chosen row and options. Options that do not apply go as false. */
export function visitPetBody(
  s: TimelineSession,
  choice: string,
  useWeight: boolean,
  applyToRef: boolean,
): VisitPetRequest {
  if (choice === PASSING) {
    return { pet_id: null, passing: true, use_weight: false, apply_to_ref: false };
  }
  const petId = Number(choice);
  if (choice === '' || !Number.isInteger(petId)) {
    return { pet_id: null, passing: false, use_weight: false, apply_to_ref: false };
  }
  return {
    pet_id: petId,
    passing: false,
    use_weight: useWeight && hasVisitWeight(s),
    apply_to_ref: applyToRef && s.unbound_pet_ref !== null,
  };
}

/** How a visit's pet was decided, as the short tag beside it; null when nothing needs saying. */
export function petSourceTag(s: TimelineSession): { kind: 'badge' | 'text'; label: string } | null {
  if (s.kind !== 'visit') return null;
  if (s.passing) return { kind: 'text', label: 'just passing' };
  if (s.pet_id === null) return { kind: 'text', label: 'not recognised' };
  if (s.pet_source === 'weight') return { kind: 'badge', label: 'by weight' };
  return null;
}

/** Whether the sheet can be opened for this session: a visit with a numeric event id. */
export function canChangeCat(s: TimelineSession): s is TimelineSession & { id: number } {
  return s.kind === 'visit' && typeof s.id === 'number';
}
