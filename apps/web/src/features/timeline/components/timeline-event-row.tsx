import { FeederDrawing, Icon, Pill, type IconName } from '@/shared/ui';
import {
  clockTime,
  formatVisitDuration,
  formatWeight,
  posterPath,
  sessionSentence,
  subEventLabel,
  type TimelineSession,
} from '../timeline-model';
import { petSourceTag } from '../visit-pet-model';
import { PetAvatar } from './pet-avatar';
import { MediaImage } from './timeline-still-gallery';

/** What stands at the start of a row when there is no cat to show. */
const KIND_ICON = new Map<string, IconName>([
  ['cleaning', 'clean'],
  ['drinking', 'drop'],
  ['motion', 'video'],
  ['system', 'settings'],
]);

/** The cat's photo, a "?" for a visit nobody was recognised in, else the thing that happened. */
function Lead({ s }: { s: TimelineSession }) {
  if (s.pet_name || s.pet_photo_url) return <PetAvatar photoUrl={s.pet_photo_url} size={40} />;
  if (s.kind === 'visit') {
    return (
      <span
        className="flex size-10 flex-none items-center justify-center rounded-full bg-active text-muted-foreground"
        aria-hidden="true"
      >
        ?
      </span>
    );
  }
  if (s.event_kind === 'feeding') {
    return (
      <span className="flex w-10 flex-none justify-center">
        <FeederDrawing levels={[null]} size={36} />
      </span>
    );
  }
  const icon = s.event_kind === 'error' ? 'warning' : (KIND_ICON.get(s.event_kind ?? '') ?? 'more');
  return (
    <span
      className={`flex w-10 flex-none justify-center ${s.event_kind === 'error' ? 'text-negative' : 'text-muted-foreground'}`}
    >
      <Icon name={icon} size={18} />
    </span>
  );
}

/**
 * The one muted line under the sentence: time, how long, the reading, what the box reported and
 * the steps that followed ("cleaned 14:05"), each its own span so a value can be found alone.
 */
function Meta({ s, device }: { s: TimelineSession; device: string | null }) {
  const isVisit = s.kind === 'visit';
  const tag = petSourceTag(s);
  const parts: string[] = [
    clockTime(s.display_ts ?? s.ts) ?? '—',
    ...(isVisit ? [formatVisitDuration(s.duration_sec) ?? '—', formatWeight(s.weight) ?? '—'] : []),
    ...s.bits,
    ...s.sub_events
      .filter(e => !e.detail)
      .map(e => [subEventLabel(e), clockTime(e.ts)].filter(Boolean).join(' ')),
    ...(tag?.kind === 'text' ? [tag.label] : []),
    ...(device !== null ? [device] : []),
  ];
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {parts.map((p, i) => (
        <span key={`${String(i)}-${p}`}>
          {i > 0 && ' · '}
          <span>{p}</span>
        </span>
      ))}
    </span>
  );
}

/** The poster of the session's video or snapshot, or a word while the video is assembled. */
function Trailing({ s }: { s: TimelineSession }) {
  // A recording still being stitched says so instead of offering a poster that will not play.
  if (s.media.video_pending) {
    return <span className="flex-none text-xs text-muted-foreground">Assembling video…</span>;
  }
  const poster = posterPath(s.media);
  if (!poster) return null;
  return (
    <span className="relative block h-12 w-18 flex-none overflow-hidden rounded-[10px] bg-ink dark:bg-ground">
      <MediaImage path={poster} thumb className="size-full object-cover" />
    </span>
  );
}

export interface TimelineEventRowProps {
  session: TimelineSession;
  selected: boolean;
  onSelect: () => void;
  /** The device's name when the household has more than one; null otherwise. */
  device: string | null;
}

/** One session as a 68px row that selects it: who, what, when, and its picture. */
export function TimelineEventRow({
  session: s,
  selected,
  onSelect,
  device,
}: TimelineEventRowProps) {
  const tag = petSourceTag(s);
  return (
    <button
      type="button"
      className="flex min-h-17 w-full min-w-0 cursor-pointer items-center gap-3 rounded-md border-0 bg-transparent py-2 pr-2 pl-2.5 text-left text-base text-foreground hover:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring aria-pressed:hover:bg-transparent"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <Lead s={s} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="inline-flex flex-wrap items-center gap-2 font-medium">
          {sessionSentence(s)}
          {tag?.kind === 'badge' && <Pill>{tag.label}</Pill>}
          {s.event_kind === 'error' && <Pill tone="negative">Alert</Pill>}
        </span>
        <Meta s={s} device={device} />
      </span>
      <Trailing s={s} />
    </button>
  );
}
