import type { ReactNode } from 'react';
import { relativeTime } from '@/shared/format/format';
import { StatusWord } from '@/shared/ui';
import type { DeviceDetail } from '../api';
import { deviceFamily } from '../lib/device-family';
import { deviceStatus, nowText, problemFor } from '../lib/device-status';
import { type DeviceZone, localClock, localDateKey, minuteOfDay } from '../lib/device-zone';
import { findEntity, numericValue } from '../lib/entity-sections';
import { nextMealClock, todaysMeals } from '../lib/feed-plan';
import { lastReport } from '../lib/timestamps';

/** The status beside a device's title: transport and how long ago it last spoke. */
export function deviceStatusWord(d: DeviceDetail, zone: DeviceZone | null, nowSeconds: number) {
  const s = deviceStatus(d);
  const last = lastReport(d);
  const ago = last === null ? 'never' : relativeTime(last);
  switch (s.status) {
    case 'online':
      return (
        <StatusWord tone="positive" dot>
          Online · MQTT · {ago}
        </StatusWord>
      );
    case 'polling':
      return (
        <StatusWord tone="info" dot>
          Polling · heartbeat {ago}
        </StatusWord>
      );
    case 'offline': {
      const since =
        last !== null && zone && localDateKey(last, zone) === localDateKey(nowSeconds, zone)
          ? localClock(last, zone)
          : ago;
      return (
        <StatusWord tone="negative" dot>
          Offline · no report since {since}
        </StatusWord>
      );
    }
    default:
      return (
        <StatusWord tone="muted" dot>
          Never reported
        </StatusWord>
      );
  }
}

/** "8 h 37 m" between two moments. */
function spanText(seconds: number): string {
  const m = Math.max(0, Math.round(seconds / 60));
  if (m < 60) return `${m} m`;
  return `${Math.floor(m / 60)} h ${m % 60} m`;
}

/**
 * The one finding sentence under a device's title: what is wrong first, in its colour, then what
 * it is doing. `paused` is the litter box's own pause (force continue's guards).
 */
export function deviceFinding(
  d: DeviceDetail,
  zone: DeviceZone | null,
  nowSeconds: number,
  paused: boolean,
): ReactNode {
  const family = deviceFamily(d.type);
  if (paused) {
    return (
      <>
        <StatusWord tone="warning">Paused while cleaning.</StatusWord> The box saw a cat near the
        entrance.
      </>
    );
  }
  const last = lastReport(d);
  if (!d.online && last !== null) {
    return (
      <>
        <StatusWord tone="negative">Silent for {spanText(nowSeconds - last)}.</StatusWord> Check
        that it has power and is on Wi-Fi.
      </>
    );
  }
  const problem = problemFor(d, d, zone, nowSeconds);
  const lead = problem ? <StatusWord tone={problem.tone}>{problem.text}.</StatusWord> : null;
  let rest: string | null;
  if (family === 'feeder' && zone) {
    const next = nextMealClock(todaysMeals(d, zone, nowSeconds), minuteOfDay(nowSeconds, zone));
    const fed = numericValue(findEntity(d.entities, 'total_dispensed'));
    rest = [
      next ? `Next meal at ${next}.` : 'No more meals today.',
      fed !== null && `Fed ${fed} g today.`,
    ]
      .filter(Boolean)
      .join(' ');
  } else {
    const now = nowText(d, zone, null);
    rest = now ? `${now}.` : null;
  }
  if (!lead && !rest) return undefined;
  return (
    <>
      {lead}
      {lead && rest && ' '}
      {rest}
    </>
  );
}
