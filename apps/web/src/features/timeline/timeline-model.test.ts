import { describe, expect, it } from 'vitest';
import { buildStripLanes } from './components/timeline-day-strip';
import { DAY_START, DEVICES, PETS, day, session, slots } from './timeline-fixtures';
import {
  dayStartSeconds,
  formatVisitDuration,
  formatWeight,
  hasMedia,
  minuteOfDay,
  splitFact,
  stillGroups,
  videoSources,
  visibleFilters,
} from './timeline-model';
import { visitSummary } from './timeline-summary';

describe('timeline model', () => {
  it('shows a zero chip only while it is selected', () => {
    const counts = day().counts;
    expect(visibleFilters(counts, 'all').map(f => f.key)).toEqual(['all', 'toileting', 'feeding']);
    expect(visibleFilters(counts, 'fault').map(f => f.key)).toContain('fault');
  });

  it('formats visit facts', () => {
    expect(formatVisitDuration(45)).toBe('45 s');
    expect(formatVisitDuration(115)).toBe('1 min 55 s');
    expect(formatVisitDuration(null)).toBeNull();
    expect(formatWeight(5430)).toBe('5.43 kg');
    expect(formatWeight(0)).toBe('0.00 kg');
    expect(splitFact('waste 42 g')).toEqual({ label: 'waste', value: '42 g' });
    expect(splitFact('yowled')).toEqual({ label: 'yowled', value: null });
  });

  it('orders video sources clip, timelapse, playback and counts a pending recording as media', () => {
    const m = slots({ playback_url: 'p.mp4', preview_url: 't.mp4', highlight_url: 'c.mp4' });
    expect(videoSources(m).map(s => s.label)).toEqual(['Clip', 'Timelapse', 'Playback']);
    expect(hasMedia(slots())).toBe(false);
    expect(hasMedia(slots({ video_pending: true }))).toBe(true);
  });

  it('collects waste and health stills from a session and its steps, once each', () => {
    const s = session({
      media: slots({ waste: ['a.jpg'] }),
      sub_events: [
        {
          id: 1,
          event_type: '5',
          ts: 1,
          label: 'x',
          detail: false,
          media: slots({ waste: ['a.jpg', 'b.jpg'], health: ['h.jpg'] }),
        },
      ],
    });
    expect(stillGroups(s)).toEqual([
      { title: 'Check waste', paths: ['a.jpg', 'b.jpg'] },
      { title: 'Health', paths: ['h.jpg'] },
    ]);
  });

  it("places marks by minutes since the server's local midnight", () => {
    const start = dayStartSeconds(day());
    expect(start).toBe(DAY_START);
    expect(minuteOfDay(DAY_START + 90 * 60, start)).toBe(90);
    expect(minuteOfDay(DAY_START - 60, start)).toBeNull();
  });

  it('builds a lane per pet and per feeder', () => {
    const lanes = buildStripLanes(day(), PETS, DEVICES);
    expect(lanes.map(l => `${l.kind}:${l.name}`)).toEqual([
      'pet:Miso',
      'pet:Mochi',
      'feeder:Kitchen feeder',
    ]);
    const miso = lanes[0];
    expect(miso?.kind === 'pet' && miso.visits.map(v => v.minute)).toEqual([13 * 60 + 58]);
    const feeder = lanes[2];
    expect(feeder?.kind === 'feeder' && feeder.meals.map(m => m.minute)).toEqual([7 * 60]);
  });

  it('summarises who used the litter box', () => {
    expect(visitSummary(day({ sessions: [] }), true)).toBe('No litter-box visits yet today.');
    expect(visitSummary(day(), false)).toMatch(
      /^Miso used the litter box once and Mochi once\. The last visit was /,
    );
  });
});
