import { describe, expect, it } from 'vitest';
import {
  historyDates,
  localDay,
  petDay,
  shiftLocalDay,
  visitsPerDay,
  weightPoints,
  weightScale,
  weightTrendText,
  type HistoryDay,
  type PetDay,
} from './pet-history-model';

function day(sessions: { pet_id: number | null; weight: number | null; kind?: string }[]) {
  return {
    date: '2026-10-28',
    tz_offset: 0,
    counts: { toileting: sessions.length },
    sessions: sessions.map(s => ({ kind: 'visit', ...s })),
  } as unknown as HistoryDay;
}

const d = (date: string, visits: number | null, weightG: number | null): PetDay => ({
  date,
  visits,
  weightG,
});

describe('pet history', () => {
  it('asks for the last days on the local calendar, oldest first, across a month end', () => {
    expect(localDay(new Date(2026, 9, 28, 23, 30))).toBe('2026-10-28');
    expect(shiftLocalDay('2026-11-01', -1)).toBe('2026-10-31');
    expect(historyDates('2026-11-02', 3)).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
    expect(historyDates('2026-10-28')).toHaveLength(14);
  });

  it("reads a day as the pet's visits and the median of its own weighed visits", () => {
    const one = day([
      { pet_id: 1, weight: 5400 },
      { pet_id: 1, weight: 5440 },
      { pet_id: 1, weight: 9000 },
      { pet_id: 2, weight: 3800 },
      { pet_id: 1, weight: null },
      { pet_id: 1, weight: 5000, kind: 'event' },
    ]);
    expect(petDay('2026-10-28', one, 1)).toEqual({
      date: '2026-10-28',
      visits: 6,
      weightG: 5440,
    });
    expect(
      petDay(
        '2026-10-28',
        day([
          { pet_id: 1, weight: 5400 },
          { pet_id: 1, weight: 5440 },
        ]),
        1,
      ).weightG,
    ).toBe(5420);
    expect(petDay('2026-10-28', undefined, 1)).toEqual({
      date: '2026-10-28',
      visits: null,
      weightG: null,
    });
  });

  it('plots only weighed days of the span and words the change over it', () => {
    const days = [d('a', 1, 5380), d('b', 2, null), d('c', 3, 5420)];
    expect(weightPoints(days, 7)).toEqual([
      { date: 'a', grams: 5380 },
      { date: 'c', grams: 5420 },
    ]);
    expect(weightTrendText(weightPoints(days, 7), 7)).toBe('+0.04 kg over 7 days');
    expect(weightTrendText([{ grams: 5420 }, { grams: 5380 }], 14)).toBe('−0.04 kg over 14 days');
    expect(weightTrendText([{ grams: 5420 }], 14)).toBeNull();
  });

  it('keeps a flat line readable and averages only the days that loaded', () => {
    expect(weightScale([{ grams: 5420 }])).toEqual({ min: 5370, max: 5470 });
    expect(visitsPerDay([d('a', 2, null), d('b', null, null), d('c', 4, null)])).toBe(3);
    expect(visitsPerDay([d('a', null, null)])).toBeNull();
  });
});
