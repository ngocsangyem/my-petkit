import type { ReactNode } from 'react';
import { i18n } from '@/i18n';
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
  const ago = last === null ? i18n.t('devices:never') : relativeTime(last);
  switch (s.status) {
    case 'online':
      return (
        <StatusWord tone="positive" dot>
          {i18n.t('devices:headline.online', { ago })}
        </StatusWord>
      );
    case 'polling':
      return (
        <StatusWord tone="info" dot>
          {i18n.t('devices:headline.polling', { ago })}
        </StatusWord>
      );
    case 'offline': {
      const since =
        last !== null && zone && localDateKey(last, zone) === localDateKey(nowSeconds, zone)
          ? localClock(last, zone)
          : ago;
      return (
        <StatusWord tone="negative" dot>
          {i18n.t('devices:headline.offline', { since })}
        </StatusWord>
      );
    }
    default:
      return (
        <StatusWord tone="muted" dot>
          {i18n.t('devices:status.neverReported')}
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
        <StatusWord tone="warning">{i18n.t('devices:headline.paused')}</StatusWord>{' '}
        {i18n.t('devices:headline.pausedWhy')}
      </>
    );
  }
  const last = lastReport(d);
  if (!d.online && last !== null) {
    return (
      <>
        <StatusWord tone="negative">
          {i18n.t('devices:headline.silent', { span: spanText(nowSeconds - last) })}
        </StatusWord>{' '}
        {i18n.t('devices:headline.silentHint')}
      </>
    );
  }
  const problem = problemFor(d, d, zone, nowSeconds);
  const lead = problem ? (
    <StatusWord tone={problem.tone}>
      {i18n.t('devices:headline.sentence', { text: problem.text })}
    </StatusWord>
  ) : null;
  let rest: string | null;
  if (family === 'feeder' && zone) {
    const next = nextMealClock(todaysMeals(d, zone, nowSeconds), minuteOfDay(nowSeconds, zone));
    const fed = numericValue(findEntity(d.entities, 'total_dispensed'));
    rest = [
      next
        ? i18n.t('devices:headline.nextMeal', { clock: next })
        : i18n.t('devices:headline.noMoreMeals'),
      fed !== null && i18n.t('devices:headline.fedToday', { grams: fed }),
    ]
      .filter(Boolean)
      .join(' ');
  } else {
    const now = nowText(d, zone, null);
    rest = now ? i18n.t('devices:headline.sentence', { text: now }) : null;
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
