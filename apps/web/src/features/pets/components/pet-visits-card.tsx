import { cn } from 'cn';
import { useTranslation } from 'react-i18next';
import { SectionCard, Skeleton } from '@/shared/ui';
import {
  VISIT_DAYS,
  shortDate,
  visitsPerDay,
  weekdayLetter,
  type PetDay,
} from '../pet-history-model';

export interface PetVisitsCardProps {
  name: string;
  days: readonly PetDay[];
  isPending: boolean;
}

/**
 * "Litter box visits": a bar per day for the last week, today in the accent, and the average a
 * day over the days that could be read. A day that could not be read draws no bar.
 */
export function PetVisitsCard({ name, days, isPending }: PetVisitsCardProps) {
  const { t } = useTranslation('pets');
  const week = days.slice(-VISIT_DAYS);
  const most = Math.max(1, ...week.map(d => d.visits ?? 0));
  const average = visitsPerDay(week);
  const label = t('visits.label', {
    name,
    days: VISIT_DAYS,
    list: week
      .map(
        d => `${shortDate(d.date)} ${d.visits === null ? t('visits.unknown') : String(d.visits)}`,
      )
      .join(', '),
  });
  return (
    <SectionCard
      title={t('visits.title')}
      end={
        average !== null && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {t('visits.average', { value: average.toFixed(1) })}
          </span>
        )
      }
    >
      {isPending ? (
        <Skeleton height={140} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="grid h-30 grid-cols-7 items-end gap-2.5" role="img" aria-label={label}>
            {week.map((d, i) => (
              <span
                key={d.date}
                className={cn(
                  'block min-h-1 rounded-[6px]',
                  i === week.length - 1 ? 'bg-data' : 'bg-litter dark:bg-(--pk-fountain-reporting)',
                  d.visits === null && 'invisible',
                )}
                style={{ height: `${String(((d.visits ?? 0) / most) * 100)}%` }}
              />
            ))}
          </div>
          <div
            className="grid grid-cols-7 gap-2.5 text-center text-xs text-muted-foreground"
            aria-hidden="true"
          >
            {week.map((d, i) => (
              <span key={d.date}>
                {i === week.length - 1 ? t('visits.today') : weekdayLetter(d.date)}
              </span>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
