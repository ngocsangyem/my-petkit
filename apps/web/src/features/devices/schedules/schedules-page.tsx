import { useTranslation } from 'react-i18next';
import { Card, formatMinute, PageHeader, RatioBar } from '@/shared/ui';
import { deviceFamily } from '../lib/device-family';
import { useDeviceLinks } from '../lib/device-view';
import { deviceZone, minuteOfDay, zoneLabel } from '../lib/device-zone';
import { findEntity, numericValue } from '../lib/entity-sections';
import { todaysMeals } from '../lib/feed-plan';
import { DeviceSchedules } from './device-schedules';
import type { DeviceDetail } from './schedule-model';

function untilText(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return m < 60 ? `${m} m` : `${Math.floor(m / 60)} h ${m % 60} m`;
}

/**
 * A device's schedules as their own page: for a feeder, the next meal and what was fed today,
 * then the editors (meal sets, one-off feeds; quiet hours and timed jobs on other models).
 */
export function SchedulesPage({
  device: d,
  nowSeconds,
}: {
  device: DeviceDetail;
  nowSeconds: number;
}) {
  const { t } = useTranslation('devices');
  const links = useDeviceLinks();
  const feeder = deviceFamily(d.type) === 'feeder' || d.is_feeder;
  const zone = deviceZone(d.timezoneInfo);
  let finding: string | undefined;
  if (feeder && zone) {
    const now = minuteOfDay(nowSeconds, zone);
    const next = todaysMeals(d, zone, nowSeconds).find(m => m.minute > now);
    finding = next
      ? t('schedules.nextMeal', {
          clock: formatMinute(next.minute),
          span: untilText(next.minute - now),
        })
      : t('headline.noMoreMeals');
  }
  const fed = numericValue(findEntity(d.entities, 'total_dispensed'));
  const eaten = numericValue(findEntity(d.entities, 'amount_eaten'));
  return (
    <div className="flex w-full max-w-[860px] flex-col gap-5">
      <PageHeader
        title={feeder ? t('schedules.feedingTitle') : t('automation.schedules')}
        back={{ to: links.device(`d${d.id}`), label: d.name }}
        finding={finding}
      />
      {feeder && fed !== null && (
        <Card as="section" aria-label={t('figure.fedToday')} className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span>
              <b className="text-3xl font-medium tabular-nums">{fed}</b>{' '}
              <span className="text-muted-foreground">{t('schedules.gFedToday')}</span>
            </span>
            {eaten !== null && (
              <span className="text-sm text-muted-foreground">
                {t('schedules.gEaten', { grams: eaten })}
              </span>
            )}
          </div>
          {eaten !== null && fed > 0 && (
            <RatioBar value={eaten} max={fed} ariaLabel={t('schedules.eatenOfFed')} />
          )}
        </Card>
      )}
      <DeviceSchedules device={d} />
      {zone && (
        <p className="text-xs text-muted-foreground">
          {t('schedules.zoneNote', { zone: zoneLabel(zone) })}
        </p>
      )}
    </div>
  );
}
