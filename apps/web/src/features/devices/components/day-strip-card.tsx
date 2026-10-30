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
 * "Today at home": a lane per pet, then feeders and fountains, on a 24-hour axis
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
  const aside =
    strip && zone
      ? [
          localDayLabel(nowSeconds, zone),
          `${strip.visitCount} litter-box ${strip.visitCount === 1 ? 'visit' : 'visits'}`,
          fedGrams !== null && `${fedGrams} g fed`,
          zoneLabel(zone),
        ]
          .filter(Boolean)
          .join(' · ')
      : undefined;

  let body;
  if (error) body = <ErrorBlock message={error} onRetry={onRetry} />;
  else if (loading) body = <Skeleton height={176} />;
  else if (!strip || !zone)
    body = <EmptyBlock>No device has said which time zone it is in yet.</EmptyBlock>;
  else if (!strip.lanes.length)
    body = <EmptyBlock>No pets, feeders or fountains to draw yet.</EmptyBlock>;
  else {
    body = (
      <div className="overflow-x-auto">
        <HouseholdDayStrip
          label={`Today at home, ${aside ?? ''}`}
          lanes={strip.lanes}
          nowMinute={strip.nowMinute}
        />
      </div>
    );
  }

  return (
    <SectionCard title="Today at home" aside={aside} end={<DayStripLegend />}>
      {body}
    </SectionCard>
  );
}
