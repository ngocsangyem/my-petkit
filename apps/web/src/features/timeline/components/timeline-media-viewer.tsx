import { useRef, useState } from 'react';
import { mediaUrl } from '@/shared/api/base-path';
import { CaptionPill, Segmented } from '@/shared/ui';
import { AspectRatio } from '@/shared/ui/shadcn/aspect-ratio';
import { useLazyVideo } from '../hooks/use-lazy-video';
import { MediaImage } from './timeline-still-gallery';
import { posterPath, videoSources, type MediaSlots, type VideoSource } from '../timeline-model';

// The video box: 16:9 on ink, the fisheye kept whole (contain, never cropped).
/** Video stays on a near-black frame in both themes; `ink` turns light in dark mode, `ground` does not. */
const VIEWER =
  'relative flex items-center justify-center overflow-hidden rounded-lg bg-ink text-control dark:bg-ground dark:text-muted-foreground';
const FILL = 'size-full object-contain';

function AssemblingNote({ snapshot }: { snapshot: string | null }) {
  return (
    <AspectRatio ratio={16 / 9} className={VIEWER}>
      {snapshot && (
        <MediaImage path={snapshot} thumb className={`${FILL} absolute inset-0 opacity-35`} />
      )}
      <div className="relative flex flex-col items-center gap-1 text-on-dark dark:text-foreground">
        <span>Assembling video…</span>
        <span className="text-xs text-control dark:text-muted-foreground">
          Chunks arrive during the cleaning that follows
        </span>
      </div>
    </AspectRatio>
  );
}

/** The dark pill over the top-left of the picture, clear of the player's own controls. */
function Caption({ text }: { text: string | null }) {
  if (!text) return null;
  return <CaptionPill className="pointer-events-none absolute top-3 left-3">{text}</CaptionPill>;
}

function VideoPlayer({
  source,
  poster,
  caption,
}: {
  source: VideoSource;
  poster: string | null;
  caption: string | null;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  // The clip and the timelapse loop like a moving thumbnail; the full playback plays once.
  const loops = source.label !== 'Playback';
  useLazyVideo(ref, mediaUrl(source.path), true);
  return (
    <AspectRatio ratio={16 / 9} className={VIEWER}>
      <video
        ref={ref}
        className={FILL}
        controls
        muted
        loop={loops}
        playsInline
        preload="none"
        poster={poster ? mediaUrl(poster, true) : undefined}
        aria-label={`${source.label} video`}
      />
      <Caption text={caption} />
    </AspectRatio>
  );
}

export interface TimelineMediaViewerProps {
  media: MediaSlots;
  /** Opens the still gallery, for a session whose only picture is a snapshot. */
  onOpenStill: (paths: string[], title: string) => void;
  /** Words on the dark pill over the picture, e.g. how long the visit took ("1:55"). */
  caption?: string | null;
}

/**
 * The session's video: the clip first, then the stitched timelapse, then the full playback, with
 * a switch between them. A chunked recording still being stitched is never played as a fragment:
 * it shows "Assembling video…" over the best still, and the live refresh swaps the player in once
 * the stitcher reports.
 */
export function TimelineMediaViewer({
  media,
  onOpenStill,
  caption = null,
}: TimelineMediaViewerProps) {
  const sources = videoSources(media);
  const [chosen, setChosen] = useState<VideoSource['label'] | null>(null);
  const source = sources.find(s => s.label === chosen) ?? sources[0];

  if (!source) {
    if (media.video_pending) return <AssemblingNote snapshot={media.snapshot_url} />;
    const still = media.snapshot_url;
    if (!still) return null;
    return (
      <button
        type="button"
        className="block w-full cursor-zoom-in rounded-lg border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label="Open snapshot"
        onClick={() => {
          onOpenStill([still], 'Snapshot');
        }}
      >
        <AspectRatio ratio={16 / 9} className={VIEWER}>
          <MediaImage path={still} thumb className={FILL} />
          <Caption text={caption} />
        </AspectRatio>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <VideoPlayer key={source.path} source={source} poster={posterPath(media)} caption={caption} />
      {sources.length > 1 && (
        <div className="px-2">
          <Segmented
            label="Video source"
            options={sources.map(s => ({ id: s.label, label: s.label }))}
            value={source.label}
            onChange={setChosen}
          />
        </div>
      )}
      {media.video_pending && !media.playback_url && (
        <span className="px-3 text-sm text-muted-foreground">Full playback still processing…</span>
      )}
    </div>
  );
}
