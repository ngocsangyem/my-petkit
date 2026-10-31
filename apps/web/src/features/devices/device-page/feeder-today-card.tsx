import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { formatMinute, Pill, SectionCard } from '@/shared/ui';
import type { DeviceDetail } from '../api';
import { hasSchedulesView, useDeviceLinks } from '../lib/device-view';
import { type DeviceZone, minuteOfDay } from '../lib/device-zone';
import { portionsText, todaysMeals } from '../lib/feed-plan';

/** "3 h 13 m" until a minute of today. */
function untilText(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return m < 60 ? `${m} m` : `${Math.floor(m / 60)} h ${m % 60} m`;
}

interface FeederTodayCardProps {
  device: DeviceDetail;
  zone: DeviceZone | null;
  nowSeconds: number;
}

/**
 * Today's meals on the feeder's own clock: the time, the portions, and whether each is behind
 * us, next (with the time to go) or planned. Whether a past meal was dispensed is the
 * Timeline's to say, so it is only marked as past here.
 */
export function FeederTodayCard({ device, zone, nowSeconds }: FeederTodayCardProps) {
  const { t } = useTranslation('devices');
  const links = useDeviceLinks();
  const dual = device.schedules.some(s => s.kind === 'feed' && s.dual);
  const meals = zone ? todaysMeals(device, zone, nowSeconds) : [];
  const now = zone ? minuteOfDay(nowSeconds, zone) : 0;
  const next = meals.find(m => m.minute > now);
  return (
    <SectionCard
      title={t('today.title')}
      end={
        hasSchedulesView(device) && (
          <Link to={links.device(`d${device.id}`, 'schedules')} className="font-medium">
            {t('feederToday.editSchedule')}
          </Link>
        )
      }
    >
      {!zone ? (
        <p className="text-muted-foreground">{t('feederToday.noZone')}</p>
      ) : meals.length === 0 ? (
        <p className="text-muted-foreground">{t('feederToday.none')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0" aria-label={t('feederToday.label')}>
          {meals.map(meal => (
            <li
              key={meal.minute}
              className="flex min-h-13 items-center gap-3 px-1 [&+&]:border-t [&+&]:border-rule"
            >
              <span className="w-18 text-[20px] font-medium tabular-nums">
                {formatMinute(meal.minute)}
              </span>
              <span className="min-w-0 flex-1">{portionsText(meal, dual)}</span>
              {meal === next ? (
                <span className="text-sm text-muted-foreground">
                  {t('feederToday.inSpan', { span: untilText(meal.minute - now) })}
                </span>
              ) : meal.minute <= now ? (
                <span className="text-sm text-muted-foreground">{t('feederToday.past')}</span>
              ) : (
                <Pill>{t('feederToday.planned')}</Pill>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
