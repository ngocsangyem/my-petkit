import { describe, expect, it } from 'vitest';
import { shiftDay, todayLocal } from './local-day';

describe('local day', () => {
  it('names today by the local calendar, not UTC', () => {
    expect(todayLocal(new Date(2026, 9, 28, 23, 59))).toBe('2026-10-28');
    expect(todayLocal(new Date(2026, 9, 29, 0, 1))).toBe('2026-10-29');
  });

  it('shifts days by calendar date across month ends', () => {
    expect(shiftDay('2026-11-01', -1)).toBe('2026-10-31');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('nonsense', 1)).toBe('nonsense');
  });
});
