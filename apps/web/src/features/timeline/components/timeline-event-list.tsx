import { Missing, Pill } from '@/shared/ui';
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

function TimeText({ ts }: { ts: number | null }) {
  const t = clockTime(ts);
  return <span className="tl-col-time">{t ?? <Missing />}</span>;
}

function StepRow({ step, device }: { step: TimelineSubEvent; device: string | null }) {
  return (
    <div className="tl-grid tl-step">
      <TimeText ts={step.ts} />
      <span />
      <span className="tl-step__label">{subEventLabel(step)}</span>
      <span />
      <span />
      {device !== null && <span className="tl-col-device">{device}</span>}
    </div>
  );
}

interface EventGroupProps {
  session: TimelineSession;
  selected: boolean;
  onSelect: () => void;
  showDevice: boolean;
}

function EventGroup({ session: s, selected, onSelect, showDevice }: EventGroupProps) {
  const isVisit = s.kind === 'visit';
  const device = showDevice ? s.device_name || '—' : null;
  const primary = s.sub_events.filter(e => !e.detail);
  const detail = s.sub_events.filter(e => e.detail);
  const duration = formatVisitDuration(s.duration_sec);
  const weight = formatWeight(s.weight);
  return (
    <div className="tl-group">
      <button type="button" className="tl-grid tl-row" aria-pressed={selected} onClick={onSelect}>
        <TimeText ts={s.display_ts ?? s.ts} />
        {s.pet_name || s.pet_photo_url ? <PetAvatar photoUrl={s.pet_photo_url} /> : <span />}
        <span className="tl-row__what">
          <span className="tl-row__sentence">
            {sessionSentence(s)}
            {s.event_kind === 'error' && <Pill tone="negative">Alert</Pill>}
          </span>
          {s.bits.length > 0 && <span className="tl-row__facts">{s.bits.join(' · ')}</span>}
          {s.media.video_pending && <span className="tl-assembling">Assembling video…</span>}
        </span>
        <span className="tl-col-num">{isVisit ? (duration ?? <Missing />) : null}</span>
        <span className="tl-col-num">{isVisit ? (weight ?? <Missing />) : null}</span>
        {device !== null && <span className="tl-col-device">{device}</span>}
      </button>
      {primary.map((e, i) => (
        <StepRow key={e.id ?? `p${String(i)}`} step={e} device={device} />
      ))}
      {detail.length > 0 && (
        <details className="tl-more">
          <summary>
            Show {detail.length} more step{detail.length > 1 ? 's' : ''}
          </summary>
          {detail.map((e, i) => (
            <StepRow key={e.id ?? `d${String(i)}`} step={e} device={device} />
          ))}
        </details>
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
  const cls = ['tl-events', TWELVE_HOUR && 'tl-events--12h', showDevice && 'tl-events--device']
    .filter(Boolean)
    .join(' ');
  return (
    <div className="tl-events-scroll">
      <div className={cls}>
        <div className="tl-grid tl-head" aria-hidden="true">
          <span className="tl-col-time">Time</span>
          <span />
          <span>What happened</span>
          <span className="tl-col-num">Duration</span>
          <span className="tl-col-num">Weight</span>
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
            />
          );
        })}
      </div>
    </div>
  );
}
