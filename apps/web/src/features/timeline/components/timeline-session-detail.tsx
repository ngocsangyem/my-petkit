import { useState, type ReactNode } from 'react';
import { cn } from 'cn';
import { Missing } from '@/shared/ui';
import {
  clockTime,
  formatVisitDuration,
  formatWeight,
  hasMedia,
  sessionSentence,
  splitFact,
  stillGroups,
  subEventLabel,
  type MediaSlots,
  type TimelineSession,
} from '../timeline-model';
import { TimelineDebugInfo, type DebugEntry } from './timeline-debug-info';
import { TimelineMediaViewer } from './timeline-media-viewer';
import { StillGallery, StillTiles } from './timeline-still-gallery';

function debugEntries(s: TimelineSession): DebugEntry[] {
  const entries: DebugEntry[] = [];
  if (typeof s.id === 'number') entries.push({ id: s.id, title: sessionSentence(s) });
  for (const e of s.sub_events) {
    if (e.id !== null) {
      entries.push({
        id: e.id,
        title: `${clockTime(e.ts, true) ?? ''} ${subEventLabel(e)}`.trim(),
      });
    }
  }
  return entries;
}

interface PairProps {
  label: string;
  value: string | null;
  muted?: boolean;
  action?: ReactNode;
  fallback?: ReactNode;
}

/** One fact row: muted label left, value right; a missing value is a muted em dash. */
function Pair({ label, value, muted, action, fallback }: PairProps) {
  return (
    <div className="flex justify-between gap-3">
      <dt
        className={cn(
          'inline-flex flex-wrap items-baseline gap-2 text-muted-foreground',
          muted && 'text-sm',
        )}
      >
        {label}
        {action}
      </dt>
      <dd className="m-0 text-right">{value ?? fallback ?? <Missing />}</dd>
    </div>
  );
}

/** Which media the viewer shows: the session's own, else the first step that carries a video. */
function viewerMedia(s: TimelineSession, stepId: number | null): MediaSlots | null {
  const step = stepId === null ? undefined : s.sub_events.find(e => e.id === stepId);
  if (step?.media && hasMedia(step.media)) return step.media;
  if (hasMedia(s.media)) return s.media;
  return s.sub_events.map(e => e.media).find(hasMedia) ?? null;
}

/** Everything about the selected session: its video, steps, facts, captures and Debug info. */
export function TimelineSessionDetail({ session: s }: { session: TimelineSession }) {
  const [stepMedia, setStepMedia] = useState<number | null>(null);
  const [gallery, setGallery] = useState<{ paths: string[]; title: string } | null>(null);
  const isVisit = s.kind === 'visit';
  const entered = s.display_ts ?? s.ts;
  const duration = formatVisitDuration(s.duration_sec);
  const weight = formatWeight(s.weight);
  const left =
    isVisit && entered !== null && s.duration_sec !== null ? entered + s.duration_sec : null;
  const range = [clockTime(entered), left !== null ? clockTime(left) : null]
    .filter(Boolean)
    .join(' to ');
  const subline = [range, isVisit ? duration : null, isVisit ? weight : null]
    .filter(Boolean)
    .join(' · ');
  const media = viewerMedia(s, stepMedia);
  const openStill = (paths: string[], title: string) => {
    setGallery({ paths, title });
  };

  return (
    <section
      className="flex min-w-0 flex-col gap-3.5 rounded-lg border border-border p-5"
      aria-label="Selected event"
    >
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-lg font-semibold">{sessionSentence(s)}</h2>
        {subline && <span className="text-sm text-muted-foreground">{subline}</span>}
      </div>
      {media && (
        <TimelineMediaViewer key={String(stepMedia)} media={media} onOpenStill={openStill} />
      )}
      <dl className="m-0 flex flex-col gap-1.5">
        <Pair label={isVisit ? 'Entered' : 'At'} value={clockTime(entered, true)} />
        {left !== null && <Pair label="Left" value={clockTime(left, true)} />}
        {s.sub_events.map((e, i) => (
          <Pair
            key={e.id ?? `s${String(i)}`}
            label={subEventLabel(e)}
            muted={e.detail}
            value={clockTime(e.ts, true)}
            action={
              e.id !== null && hasMedia(e.media) ? (
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent p-0 text-xs text-data focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:underline"
                  aria-pressed={stepMedia === e.id}
                  onClick={() => {
                    setStepMedia(stepMedia === e.id ? null : e.id);
                  }}
                >
                  Show media
                </button>
              ) : null
            }
          />
        ))}
        {s.bits.map(b => {
          const f = splitFact(b);
          return (
            <Pair
              key={b}
              label={f.label.charAt(0).toUpperCase() + f.label.slice(1)}
              value={f.value ?? 'yes'}
            />
          );
        })}
        <Pair
          label="Matched"
          value={s.pet_name}
          fallback={<span className="text-muted-foreground">Nobody recognised</span>}
        />
        {s.device_name && <Pair label="Device" value={s.device_name} />}
      </dl>
      <StillTiles groups={stillGroups(s)} onOpen={openStill} />
      <TimelineDebugInfo entries={debugEntries(s)} />
      <StillGallery
        gallery={gallery}
        onClose={() => {
          setGallery(null);
        }}
      />
    </section>
  );
}
