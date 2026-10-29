import { useRef, useState } from 'react';
import { mediaUrl } from '@/shared/api/base-path';
import { SegmentedChips } from '@/shared/ui';
import { useLazyVideo } from '../hooks/use-lazy-video';
import { MediaImage } from './timeline-still-gallery';
import { posterPath, videoSources, type MediaSlots, type VideoSource } from '../timeline-model';

function AssemblingNote({ snapshot }: { snapshot: string | null }) {
  return (
    <div className="tl-viewer tl-viewer--note">
      {snapshot && <MediaImage path={snapshot} thumb className="tl-viewer__still" />}
      <div className="tl-viewer__caption">
        <span>Assembling video…</span>
        <span className="tl-viewer__sub">Chunks arrive during the cleaning that follows</span>
      </div>
    </div>
  );
}

function VideoPlayer({ source, poster }: { source: VideoSource; poster: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  // The clip and the timelapse loop like a moving thumbnail; the full playback plays once.
  const loops = source.label !== 'Playback';
  useLazyVideo(ref, mediaUrl(source.path), true);
  return (
    <div className="tl-viewer">
      <video
        ref={ref}
        className="tl-viewer__video"
        controls
        muted
        loop={loops}
        playsInline
        preload="none"
        poster={poster ? mediaUrl(poster, true) : undefined}
        aria-label={`${source.label} video`}
      />
    </div>
  );
}

export interface TimelineMediaViewerProps {
  media: MediaSlots;
  /** Opens the still gallery, for a session whose only picture is a snapshot. */
  onOpenStill: (paths: string[], title: string) => void;
}

/**
 * The session's video: the clip first, then the stitched timelapse, then the full playback, with
 * a switch between them. A chunked recording still being stitched is never played as a fragment:
 * it shows "Assembling video…" over the best still, and the live refresh swaps the player in once
 * the stitcher reports.
 */
export function TimelineMediaViewer({ media, onOpenStill }: TimelineMediaViewerProps) {
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
        className="tl-viewer tl-viewer--still"
        aria-label="Open snapshot"
        onClick={() => {
          onOpenStill([still], 'Snapshot');
        }}
      >
        <MediaImage path={still} thumb className="tl-viewer__still" />
      </button>
    );
  }

  return (
    <div className="tl-viewer-block">
      <VideoPlayer key={source.path} source={source} poster={posterPath(media)} />
      {sources.length > 1 && (
        <SegmentedChips
          label="Video source"
          options={sources.map(s => ({ id: s.label, label: s.label }))}
          value={source.label}
          onChange={setChosen}
        />
      )}
      {media.video_pending && !media.playback_url && (
        <span className="tl-muted tl-small">Full playback still processing…</span>
      )}
    </div>
  );
}
