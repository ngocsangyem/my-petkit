import { useState } from 'react';
import { cn } from 'cn';
import { Button, Card } from '@/shared/ui';
import {
  clockTime,
  formatVisitDuration,
  formatWeight,
  hasMedia,
  sessionSentence,
  stillGroups,
  subEventLabel,
  type MediaSlots,
  type TimelineSession,
} from '../timeline-model';
import { canChangeCat } from '../visit-pet-model';
import { SessionFacts, SessionFigures } from './timeline-session-facts';
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

/** Which media the viewer shows: the session's own, else the first step that carries a video. */
function viewerMedia(s: TimelineSession, stepId: number | null): MediaSlots | null {
  const step = stepId === null ? undefined : s.sub_events.find(e => e.id === stepId);
  if (step?.media && hasMedia(step.media)) return step.media;
  if (hasMedia(s.media)) return s.media;
  return s.sub_events.map(e => e.media).find(hasMedia) ?? null;
}

/** "1:55", the visit's length on the picture's caption pill; null when unknown. */
function captionLength(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  return `${String(Math.floor(total / 60))}:${String(total % 60).padStart(2, '0')}`;
}

export interface TimelineSessionDetailProps {
  session: TimelineSession;
  /** Opens "Who used the box?" for this visit. */
  onChangeCat: (session: TimelineSession & { id: number }) => void;
}

/**
 * The selected session as one card: its picture first (video, or the snapshot), the source
 * switch, the sentence with "Change cat", the figures, every step, the captures and Debug info.
 */
export function TimelineSessionDetail({ session: s, onChangeCat }: TimelineSessionDetailProps) {
  const [stepMedia, setStepMedia] = useState<number | null>(null);
  const [gallery, setGallery] = useState<{ paths: string[]; title: string } | null>(null);
  const isVisit = s.kind === 'visit';
  const media = viewerMedia(s, stepMedia);
  const subline = isVisit
    ? null
    : [clockTime(s.display_ts ?? s.ts), s.device_name || null].filter(Boolean).join(' · ');
  const openStill = (paths: string[], title: string) => {
    setGallery({ paths, title });
  };

  return (
    <Card
      as="section"
      padding="none"
      className={cn('flex flex-col gap-3.5 px-2 pb-5', media ? 'pt-2' : 'pt-5')}
      aria-label="Selected event"
    >
      {media && (
        <TimelineMediaViewer
          key={String(stepMedia)}
          media={media}
          onOpenStill={openStill}
          caption={isVisit ? captionLength(s.duration_sec) : null}
        />
      )}
      <div className="flex flex-col gap-3 px-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="[overflow-wrap:anywhere]">{sessionSentence(s)}</h2>
            {subline && <span className="text-sm text-muted-foreground">{subline}</span>}
          </div>
          {canChangeCat(s) && (
            <Button
              size="small"
              className="shrink-0"
              onClick={() => {
                onChangeCat(s);
              }}
            >
              Change cat
            </Button>
          )}
        </div>
        {isVisit && (
          <SessionFigures
            session={s}
            duration={formatVisitDuration(s.duration_sec)}
            weight={formatWeight(s.weight)}
          />
        )}
        <SessionFacts
          session={s}
          stepMedia={stepMedia}
          onStepMedia={id => {
            setStepMedia(stepMedia === id ? null : id);
          }}
        />
        <StillTiles groups={stillGroups(s)} onOpen={openStill} />
        <TimelineDebugInfo entries={debugEntries(s)} />
      </div>
      <StillGallery
        gallery={gallery}
        onClose={() => {
          setGallery(null);
        }}
      />
    </Card>
  );
}
