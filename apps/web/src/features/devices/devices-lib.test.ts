import { describe, expect, it } from 'vitest';
import { buildStrip } from './lib/day-strip-lanes';
import { deviceZone, localDateKey, minuteOfDay, previousDateKey } from './lib/device-zone';
import { nextMealClock, todaysMeals } from './lib/feed-plan';
import { lastReport } from './lib/timestamps';
import { detail, NOW, summary } from './devices-fixtures';

describe('device zone', () => {
  it('uses the IANA name when the server took the offset from it, else the effective offset', () => {
    expect(
      deviceZone({
        effective: 1,
        override: null,
        reported: 0,
        locale: 'Europe/Warsaw',
        source: 'locale',
      }),
    ).toEqual({ kind: 'iana', name: 'Europe/Warsaw' });
    expect(
      deviceZone({
        effective: 5.75,
        override: 5.75,
        reported: null,
        locale: 'Asia/Kathmandu',
        source: 'override',
      }),
    ).toEqual({ kind: 'offset', hours: 5.75 });
    expect(
      deviceZone({
        effective: 0,
        override: null,
        reported: null,
        locale: 'Not/AZone',
        source: 'locale',
      }),
    ).toEqual({ kind: 'offset', hours: 0 });
  });

  it('reads minutes since the device midnight, DST included', () => {
    // 2026-07-01 10:00 UTC is 12:00 in Warsaw (CEST) and 15:45 at +5.75.
    const at = Date.UTC(2026, 6, 1, 10, 0) / 1000;
    expect(minuteOfDay(at, { kind: 'iana', name: 'Europe/Warsaw' })).toBe(720);
    expect(minuteOfDay(at, { kind: 'offset', hours: 5.75 })).toBe(945);
    // In January Warsaw is UTC+1.
    expect(
      minuteOfDay(Date.UTC(2026, 0, 1, 10, 0) / 1000, { kind: 'iana', name: 'Europe/Warsaw' }),
    ).toBe(660);
    expect(localDateKey(Date.UTC(2026, 0, 1, 23, 30) / 1000, { kind: 'offset', hours: 2 })).toBe(
      '2026-01-02',
    );
  });

  it('steps a date back across a month', () => {
    expect(previousDateKey('2026-03-01')).toBe('2026-02-28');
    expect(previousDateKey('bad')).toBeNull();
  });
});

describe('feed plan', () => {
  const feeder = detail(summary({ id: 2, type: 'd4sh', name: 'Feeder' }), {
    schedules: [
      {
        target: 'feed',
        name: 'Meals',
        kind: 'feed',
        dual: true,
        value: {
          schedule: [
            // Sunday = 1, so Wednesday is 4.
            {
              re: '4',
              it: [
                { id: 1, t: 7 * 3600, a1: 2, a2: 0 },
                { id: 2, t: 18 * 3600, a1: 1, a2: 1 },
              ],
            },
            { re: '1', it: [{ id: 3, t: 9 * 3600, a1: 1, a2: 0 }] },
          ],
        },
      },
    ],
  });

  it("keeps today's meals in the device day and finds the next one", () => {
    const zone = { kind: 'offset', hours: 7 } as const;
    const meals = todaysMeals(feeder, zone, NOW); // Wednesday 14:47
    expect(meals.map(m => m.minute)).toEqual([420, 1080]);
    expect(nextMealClock(meals, minuteOfDay(NOW, zone))).toBe('18:00');
  });
});

describe('day strip', () => {
  it('draws a quiet fountain as reporting until its last report, then a hatch', () => {
    const fountain = summary({
      id: 3,
      type: 'w7h',
      name: 'Water fountain',
      online: false,
      last_state_report: NOW - 8 * 3600 - 37 * 60, // 06:10 at UTC+7
      last_seen: 0,
      last_mqtt: 0,
    });
    const zone = { kind: 'offset', hours: 7 } as const;
    const strip = buildStrip({
      devices: [fountain],
      details: new Map(),
      accessories: [],
      sessions: [],
      pets: [],
      zoneOf: () => zone,
      homeZone: zone,
      nowSeconds: NOW,
    });
    const lane = strip.lanes[0];
    expect(lane?.kind).toBe('fountain');
    if (lane?.kind !== 'fountain') return;
    expect(lane.spans.map(s => [s.state, Math.round(s.start), Math.round(s.end)])).toEqual([
      ['reporting', 0, 370],
      ['no-report', 370, 887],
    ]);
    expect(lastReport(fountain)).toBe(NOW - 8 * 3600 - 37 * 60);
  });
});
