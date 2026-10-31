import { useTranslation } from 'react-i18next';
import { currentLocale, i18n } from '@/i18n';
import {
  DayStripLegend,
  ErrorBlock,
  HouseholdDayStrip,
  PetAvatar,
  SectionCard,
  Skeleton,
  formatMinute,
  type DayStripLane,
  type DayStripVisit,
} from '@/shared/ui';
import { errorMessage } from '@/shared/api/errors';
import type { TimelineDevice, TimelinePet } from '../api';
import {
  dayStartSeconds,
  formatVisitDuration,
  formatWeight,
  minuteOfDay,
  type TimelineDay,
  type TimelineSession,
} from '../timeline-model';
import { useClock } from '../hooks/use-clock';

function visitTitle(minute: number, s: TimelineSession): string {
  return [formatMinute(minute), formatVisitDuration(s.duration_sec), formatWeight(s.weight)]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Lanes for the strip: one per pet (plus one for visits nobody was recognised in), then one per
 * device that fed a meal. Minutes are counted from the server's local midnight, the same cut the
 * server used to pick the day, never from the browser's.
 */
export function buildStripLanes(
  day: TimelineDay,
  pets: readonly TimelinePet[],
  devices: readonly TimelineDevice[],
): DayStripLane[] {
  const start = dayStartSeconds(day);
  const visits = new Map<number | null, DayStripVisit[]>();
  const meals = new Map<number | null, { minute: number; fed: true; title: string }[]>();
  for (const s of day.sessions) {
    const minute = minuteOfDay(s.display_ts ?? s.ts, start);
    if (minute === null) continue;
    if (s.kind === 'visit') {
      const key = pets.some(p => p.id === s.pet_id) ? s.pet_id : null;
      visits.set(key, [...(visits.get(key) ?? []), { minute, title: visitTitle(minute, s) }]);
    } else if (s.event_kind === 'feeding') {
      const title = `${formatMinute(minute)} · ${s.label ?? i18n.t('timeline:kind.feeding')}`;
      meals.set(s.device_id, [...(meals.get(s.device_id) ?? []), { minute, fed: true, title }]);
    }
  }
  const lanes: DayStripLane[] = pets.map((p, i) => ({
    kind: 'pet',
    id: String(p.id),
    name: p.name,
    petIndex: i,
    avatar: <PetAvatar photoUrl={p.faces[0]?.url} />,
    visits: visits.get(p.id) ?? [],
  }));
  const unknown = visits.get(null);
  if (unknown?.length) {
    lanes.push({
      kind: 'pet',
      id: 'unrecognised',
      name: i18n.t('timeline:filter.unrecognised'),
      petIndex: pets.length,
      visits: unknown,
    });
  }
  const feeders = new Set<number | null>([
    ...devices.filter(d => d.is_feeder).map(d => d.id),
    ...meals.keys(),
  ]);
  for (const id of feeders) {
    const device = devices.find(d => d.id === id);
    lanes.push({
      kind: 'feeder',
      id: `feeder-${String(id)}`,
      name: device?.name ?? i18n.t('timeline:strip.feeder'),
      meals: meals.get(id) ?? [],
    });
  }
  return lanes;
}

function dayLabel(date: string, isToday: boolean): string {
  if (isToday) return i18n.t('timeline:strip.todayAtHome');
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString(currentLocale(), {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      });
}

export interface TimelineDayStripProps {
  date: string;
  isToday: boolean;
  day: TimelineDay | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  pets: readonly TimelinePet[];
  devices: readonly TimelineDevice[];
}

/** "Today at home": the whole household's day, never narrowed by the filters below it. */
export function TimelineDayStrip(props: TimelineDayStripProps) {
  const { date, isToday, day, isLoading, error, onRetry, pets, devices } = props;
  const { t } = useTranslation('timeline');
  const now = useClock();
  const title = dayLabel(date, isToday);
  const visitCount = day?.sessions.filter(s => s.kind === 'visit').length;
  const feedCount = day?.sessions.filter(s => s.event_kind === 'feeding').length;
  const aside =
    day && visitCount !== undefined
      ? [
          isToday ? dayLabel(date, false) : null,
          t('strip.visits', { count: visitCount }),
          feedCount ? t('strip.feedings', { count: feedCount }) : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : undefined;

  let body;
  if (error) {
    body = (
      <ErrorBlock
        message={t('strip.dayFailed', { error: errorMessage(error) })}
        onRetry={onRetry}
      />
    );
  } else if (isLoading || !day) {
    body = <Skeleton height={160} />;
  } else {
    const start = dayStartSeconds(day);
    const nowMinute = isToday ? minuteOfDay(now / 1000, start) : null;
    const lanes = buildStripLanes(day, pets, devices);
    body = lanes.length ? (
      <div className="overflow-x-auto *:min-w-160">
        <HouseholdDayStrip
          lanes={lanes}
          nowMinute={nowMinute}
          laneHeight={40}
          label={`${title}, ${date}`}
        />
      </div>
    ) : (
      <p className="text-muted-foreground">{t('strip.nothingToChart')}</p>
    );
  }
  return (
    <SectionCard title={title} aside={aside} end={<DayStripLegend />}>
      {body}
    </SectionCard>
  );
}
