import { Play, Square, Volume2, VolumeX } from 'lucide-react';
import { type RefObject, useEffect, useState } from 'react';
import { Button } from '@/shared/ui/shadcn/button';
import { AspectRatio } from '@/shared/ui/shadcn/aspect-ratio';
import { Card } from '@/shared/ui/shadcn/card';
import { Skeleton } from '@/shared/ui/shadcn/skeleton';
import type { LiveMode } from './live-api';
import { MODE_LABEL } from './live-copy';
import type { LivePhase } from './use-live-player';

// Controls sit on the dark live ground in both themes, so they take the live
// tokens rather than the light button looks (design-reference §7.2).
const ON_DARK =
  'bg-live-control text-live-text hover:not-disabled:bg-live-control/80 hover:not-disabled:text-live-text';

interface LiveFrameProps {
  deviceName: string;
  mode: LiveMode;
  phase: LivePhase;
  videoRef: RefObject<HTMLVideoElement | null>;
  onWatch: () => void;
  onStop: () => void;
}

function statusText(phase: LivePhase, mode: LiveMode): string {
  if (phase === 'playing') return `Live over ${MODE_LABEL[mode]}`;
  if (phase === 'connecting') return `Connecting over ${MODE_LABEL[mode]}…`;
  return 'Not playing';
}

/** The 16:9 dark frame (at most 720px wide, so a wide panel is not a wall of video) with the video, and the bar under it: Watch or Stop, and sound. */
export function LiveFrame({ deviceName, mode, phase, videoRef, onWatch, onStop }: LiveFrameProps) {
  const [muted, setMuted] = useState(true);
  const watching = phase === 'connecting' || phase === 'playing';

  // `muted` as a React prop only sets the initial attribute; the property is what plays.
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = muted;
  }, [muted, videoRef]);

  return (
    <Card className="w-full max-w-180 gap-0 overflow-hidden border-0 bg-live-ground py-0 text-live-text">
      <AspectRatio ratio={16 / 9} className="bg-live-ground">
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
        {!watching && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button size="lg" className={ON_DARK} onClick={onWatch}>
              <Play aria-hidden="true" />
              Watch
            </Button>
          </div>
        )}
      </AspectRatio>
      <div className="flex min-w-0 flex-wrap items-center gap-2 px-3 py-2.5">
        <span className="min-w-0 flex-1 text-sm" role="status">
          {statusText(phase, mode)}
        </span>
        <Button
          size="sm"
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
          <Button size="sm" className={ON_DARK} onClick={onStop}>
            <Square aria-hidden="true" />
            Stop
          </Button>
        )}
      </div>
    </Card>
  );
}
