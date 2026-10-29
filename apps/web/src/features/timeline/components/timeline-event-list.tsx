import { cn } from 'cn';
import { Missing, Pill } from '@/shared/ui';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/ui/shadcn/collapsible';
import {
  clockTime,
  formatVisitDuration,
  formatWeight,
  sessionKey,
  sessionSentence,
  subEventLabel,
  usesTwelveHourClock,
  type TimelineSession,
  type TimelineSubEvent,
} from '../timeline-model';
import { PetAvatar } from './pet-avatar';

// The time column is a fixed grid track and times follow the reader's locale, so a 12-hour
// "1:23 PM" needs a wider track than "13:23". Sized once from what the locale resolves to,
// rather than overriding the reader's clock preference.
const TWELVE_HOUR = usesTwelveHourClock();

// Time, avatar, what happened, duration, weight, and the device when there is more than one.
const GRID = 'grid items-center gap-x-3';
const COLUMNS = 'grid-cols-[var(--tl-time-w)_24px_minmax(0,1fr)_80px_72px]';
const COLUMNS_DEVICE = 'grid-cols-[var(--tl-time-w)_24px_minmax(0,1fr)_80px_72px_96px]';
const NUM = 'text-right whitespace-nowrap';
const DEVICE = 'truncate text-muted-foreground';

function TimeText({ ts }: { ts: number | null }) {
  const t = clockTime(ts);
  return <span className={NUM}>{t ?? <Missing />}</span>;
}

function StepRow({
  step,
  device,
  columns,
}: {
  step: TimelineSubEvent;
  device: string | null;
  columns: string;
}) {
  return (
    <div className={cn(GRID, columns, 'min-h-8 pb-1.5 pl-0.5 text-sm text-muted-foreground')}>
      <TimeText ts={step.ts} />
      <span />
      <span>{subEventLabel(step)}</span>
      <span />
      <span />
      {device !== null && <span className={DEVICE}>{device}</span>}
    </div>
  );
}

interface EventGroupProps {
  session: TimelineSession;
  selected: boolean;
  onSelect: () => void;
  showDevice: boolean;
  columns: string;
}

function EventGroup({ session: s, selected, onSelect, showDevice, columns }: EventGroupProps) {
  const isVisit = s.kind === 'visit';
  const device = showDevice ? s.device_name || '—' : null;
  const primary = s.sub_events.filter(e => !e.detail);
  const detail = s.sub_events.filter(e => e.detail);
  const duration = formatVisitDuration(s.duration_sec);
  const weight = formatWeight(s.weight);
  return (
    <div className="border-t border-rule">
      <button
        type="button"
        className={cn(
          GRID,
          columns,
          'min-h-(--pk-row-height-compact) w-full cursor-pointer border-0 border-l-2 border-l-transparent bg-transparent py-1.5 text-left text-base text-foreground hover:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring aria-pressed:border-l-data aria-pressed:bg-raised',
        )}
        aria-pressed={selected}
        onClick={onSelect}
      >
        <TimeText ts={s.display_ts ?? s.ts} />
        {s.pet_name || s.pet_photo_url ? <PetAvatar photoUrl={s.pet_photo_url} /> : <span />}
        <span className="flex min-w-0 flex-col">
          <span className="inline-flex flex-wrap items-center gap-2">
            {sessionSentence(s)}
            {s.event_kind === 'error' && <Pill tone="negative">Alert</Pill>}
          </span>
          {s.bits.length > 0 && (
            <span className="text-sm text-muted-foreground">{s.bits.join(' · ')}</span>
          )}
          {s.media.video_pending && <span className="text-xs text-chart-2">Assembling video…</span>}
        </span>
        <span className={NUM}>{isVisit ? (duration ?? <Missing />) : null}</span>
        <span className={NUM}>{isVisit ? (weight ?? <Missing />) : null}</span>
        {device !== null && <span className={DEVICE}>{device}</span>}
      </button>
      {primary.map((e, i) => (
        <StepRow key={e.id ?? `p${String(i)}`} step={e} device={device} columns={columns} />
      ))}
      {detail.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="cursor-pointer border-0 bg-transparent pb-2 pl-[calc(var(--tl-time-w)+50px)] text-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">
            Show {detail.length} more step{detail.length > 1 ? 's' : ''}
          </CollapsibleTrigger>
          <CollapsibleContent>
            {detail.map((e, i) => (
              <StepRow key={e.id ?? `d${String(i)}`} step={e} device={device} columns={columns} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export interface TimelineEventListProps {
  sessions: readonly TimelineSession[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  showDevice: boolean;
}

/** The day's sessions, newest first, each with its steps; a row selects the session. */
export function TimelineEventList({
  sessions,
  selectedKey,
  onSelect,
  showDevice,
}: TimelineEventListProps) {
  const columns = showDevice ? COLUMNS_DEVICE : COLUMNS;
  return (
    <div className="overflow-x-auto">
      <div className={cn('min-w-130', TWELVE_HOUR ? '[--tl-time-w:76px]' : '[--tl-time-w:52px]')}>
        <div
          className={cn(GRID, columns, 'pb-2 pl-0.5 text-xs text-muted-foreground')}
          aria-hidden="true"
        >
          <span className="text-right">Time</span>
          <span />
          <span>What happened</span>
          <span className="text-right">Duration</span>
          <span className="text-right">Weight</span>
          {showDevice && <span>Device</span>}
        </div>
        {sessions.map((s, i) => {
          const key = sessionKey(s, i);
          return (
            <EventGroup
              key={key}
              session={s}
              selected={key === selectedKey}
              onSelect={() => {
                onSelect(key);
              }}
              showDevice={showDevice}
              columns={columns}
            />
          );
        })}
      </div>
    </div>
  );
}
