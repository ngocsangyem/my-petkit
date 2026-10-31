import { Play, Square, Volume2, VolumeX } from 'lucide-react';
import { type ReactNode, type RefObject, useEffect, useState } from 'react';
import { CaptionPill, Icon, Pill } from '@/shared/ui';
import { Button } from '@/shared/ui/shadcn/button';
import { Skeleton } from '@/shared/ui/shadcn/skeleton';
import type { LiveMode } from './live-api';
import { MODE_LABEL } from './live-copy';
import type { LivePhase } from './use-live-player';

// Controls sit on the dark live ground in both themes, so they take the live
// tokens rather than the light button looks (design-reference §7.2).
export const ON_DARK =
  'h-10 rounded-full px-4.5 bg-live-control text-live-text hover:not-disabled:bg-live-control/80 hover:not-disabled:text-live-text';

interface LiveFrameProps {
  deviceName: string;
  mode: LiveMode;
  phase: LivePhase;
  videoRef: RefObject<HTMLVideoElement | null>;
  onWatch: () => void;
  onStop: () => void;
  /** More buttons on the bar, after Sound and Stop. */
  barExtra?: ReactNode;
}

function statusText(phase: LivePhase, mode: LiveMode): string {
  if (phase === 'playing') return `Live over ${MODE_LABEL[mode]}`;
  if (phase === 'connecting') return `Connecting over ${MODE_LABEL[mode]}…`;
  return 'Not playing';
}

/**
 * The 16:9 dark frame with the video, a Live pill and the transport caption over it, and the bar
 * under it: the status, Watch or Stop, sound, and whatever the page adds.
 */
export function LiveFrame({
  deviceName,
  mode,
  phase,
  videoRef,
  onWatch,
  onStop,
  barExtra,
}: LiveFrameProps) {
  const [muted, setMuted] = useState(true);
  const watching = phase === 'connecting' || phase === 'playing';

  // `muted` as a React prop only sets the initial attribute; the property is what plays.
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = muted;
  }, [muted, videoRef]);

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl bg-live-ground text-live-text">
      <div className="relative aspect-video bg-live-ground">
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label={`Live video from ${deviceName}`}
          className="absolute inset-0 size-full object-contain"
        />
        {phase === 'connecting' && (
          <Skeleton className="absolute inset-0 size-full rounded-none bg-live-control" />
        )}
        {phase === 'playing' && (
          <span className="absolute top-4 left-4">
            <Pill tone="negative">Live</Pill>
          </span>
        )}
        <CaptionPill className="absolute top-4 right-4">{MODE_LABEL[mode]}</CaptionPill>
        {!watching && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button size="lg" className={ON_DARK} onClick={onWatch}>
              <Play aria-hidden="true" />
              Watch
            </Button>
          </div>
        )}
        {phase === 'playing' && (
          <button
            type="button"
            aria-label="Full screen"
            className="absolute right-4 bottom-4 flex size-10 items-center justify-center rounded-full border-0 bg-caption text-caption-ink"
            onClick={() => {
              void videoRef.current?.requestFullscreen().catch(() => undefined);
            }}
          >
            <Icon name="fullscreen" size={18} />
          </button>
        )}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2.5 p-4">
        <span className="min-w-0 basis-full text-sm" role="status">
          {statusText(phase, mode)}
        </span>
        <Button
          className={ON_DARK}
          aria-pressed={!muted}
          onClick={() => {
            setMuted(m => !m);
          }}
        >
          {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          Sound
        </Button>
        {watching && (
          <Button className={ON_DARK} onClick={onStop}>
            <Square aria-hidden="true" />
            Stop
          </Button>
        )}
        {barExtra}
      </div>
    </div>
  );
}
