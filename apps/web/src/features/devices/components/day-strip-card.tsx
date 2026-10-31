import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  DayStripLegend,
  EmptyBlock,
  ErrorBlock,
  HouseholdDayStrip,
  SectionCard,
  Skeleton,
} from '@/shared/ui';
import type { StripModel } from '../lib/day-strip-lanes';
import { type DeviceZone, localDayLabel, zoneLabel } from '../lib/device-zone';

interface DayStripCardProps {
  strip: StripModel | null;
  zone: DeviceZone | null;
  nowSeconds: number;
  /** Grams fed today across feeders, when they report it. */
  fedGrams: number | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/**
 * "Today": a lane per pet, then feeders and fountains, on a 24-hour axis
 * drawn in the DEVICE's zone (see lib/device-zone.ts), never the browser's.
 */
export function DayStripCard({
  strip,
  zone,
  nowSeconds,
  fedGrams,
  loading,
  error,
  onRetry,
}: DayStripCardProps) {
  const { t } = useTranslation('devices');
  const aside =
    strip && zone
      ? [
          localDayLabel(nowSeconds, zone),
          t('today.visits', { count: strip.visitCount }),
          fedGrams !== null && t('today.fedGrams', { grams: fedGrams }),
          zoneLabel(zone),
        ]
          .filter(Boolean)
          .join(' · ')
      : undefined;

  let body;
  if (error) body = <ErrorBlock message={error} onRetry={onRetry} />;
  else if (loading) body = <Skeleton height={176} />;
  else if (!strip || !zone) body = <EmptyBlock>{t('today.noZone')}</EmptyBlock>;
  else if (!strip.lanes.length) body = <EmptyBlock>{t('today.noLanes')}</EmptyBlock>;
  else {
    body = (
      <div className="overflow-x-auto">
        <HouseholdDayStrip
          label={t('today.stripLabel', { aside: aside ?? '' })}
          lanes={strip.lanes}
          nowMinute={strip.nowMinute}
        />
      </div>
    );
  }

  return (
    <SectionCard
      title={t('today.title')}
      aside={aside}
      end={
        <Link to="/timeline" className="text-base font-medium">
          {t('today.openTimeline')}
        </Link>
      }
    >
      {body}
      {strip && strip.lanes.length > 0 && !error && !loading && <DayStripLegend />}
    </SectionCard>
  );
}
