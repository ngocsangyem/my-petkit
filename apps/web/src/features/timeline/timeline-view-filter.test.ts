import { describe, expect, it } from 'vitest';
import { day, session } from './timeline-fixtures';
import {
  applyViewFilter,
  isUnrecognisedVisit,
  kindChips,
  serverFilter,
} from './timeline-view-filter';
import { dayButtonLabel } from './components/timeline-day-nav';

const unknown = session({ id: 601, pet_id: null, pet_name: null, pet_source: null });
const passing = session({ id: 602, pet_id: null, pet_name: null, passing: true });

describe('timeline view filter', () => {
  it('asks the server for the unfiltered day when narrowing to unrecognised visits', () => {
    expect(serverFilter('unrecognised')).toBe('all');
    expect(serverFilter('passing')).toBe('passing');
  });

  it('counts a visit with no cat as unrecognised, but not a light one or another kind', () => {
    expect(isUnrecognisedVisit(unknown)).toBe(true);
    expect(isUnrecognisedVisit(passing)).toBe(false);
    expect(isUnrecognisedVisit(session())).toBe(false);
    expect(isUnrecognisedVisit(session({ kind: 'event', pet_id: null }))).toBe(false);
  });

  it('narrows only for the unrecognised chip', () => {
    const all = [unknown, session()];
    expect(applyViewFilter(all, 'unrecognised')).toEqual([unknown]);
    expect(applyViewFilter(all, 'toileting')).toEqual(all);
  });

  it('shows a kind chip only with something in it or while it is selected', () => {
    const counts = day().counts;
    expect(kindChips(counts, 0, 'all').map(c => c.key)).toEqual(['toileting', 'feeding']);
    expect(kindChips(counts, 2, 'fault').map(c => [c.key, c.count])).toEqual([
      ['toileting', 2],
      ['feeding', 1],
      ['fault', 0],
      ['unrecognised', 2],
    ]);
    expect(kindChips(undefined, undefined, 'unrecognised')).toEqual([
      { key: 'unrecognised', label: 'Not recognised', count: null },
    ]);
  });
});

describe('dayButtonLabel', () => {
  it('names today as such and any other day by its weekday', () => {
    expect(dayButtonLabel('2026-10-28', '2026-10-28')).toMatch(/^Today, /);
    expect(dayButtonLabel('2026-10-27', '2026-10-28')).not.toMatch(/^Today/);
    expect(dayButtonLabel('not-a-date', '2026-10-28')).toBe('not-a-date');
  });
});
