import { useRef } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { ErrorBlock, SegmentedChips } from '@/shared/ui';
import { AspectRatio } from '@/shared/ui/shadcn/aspect-ratio';
import { Skeleton } from '@/shared/ui/shadcn/skeleton';
import { BlockHeading } from '../components/panel-parts';
import { type LiveMode, useLiveInfo } from './live-api';
import { MODE_LABEL, MODE_SENTENCE, reasonSentence } from './live-copy';
import { LiveFrame } from './live-frame';
import { useLivePlayer } from './use-live-player';

interface LiveViewProps {
  deviceId: number;
  deviceName: string;
}

/** The camera's live picture. Asks what can be watched on open; connects only on Watch. */
export function LiveView({ deviceId, deviceName }: LiveViewProps) {
  const info = useLiveInfo(deviceId);
  return (
    <section className="flex min-w-0 flex-col gap-2.5" aria-label="Live">
      <BlockHeading title="Live" aside="Nothing connects until you press Watch." />
      {info.isPending ? (
        <FrameSkeleton />
      ) : info.isError ? (
        <ErrorBlock
          message={`Could not check the live stream: ${errorMessage(info.error)}`}
          onRetry={() => void info.refetch()}
          retrying={info.isFetching}
        />
      ) : !info.data.available || !info.data.modes.length ? (
        <ErrorBlock
          message={reasonSentence(info.data.reason)}
          onRetry={() => void info.refetch()}
          retrying={info.isFetching}
        />
      ) : (
        <LivePlayerBlock
          deviceId={deviceId}
          deviceName={deviceName}
          modes={playableModes(info.data.modes)}
        />
      )}
    </section>
  );
}

/**
 * The offered modes this browser can play. iOS Safari has no `MediaSource`
 * (only `ManagedMediaSource`), so MSE is dropped there rather than offered
 * first and failing; HLS stays, as every browser here plays it natively or
 * through hls.js.
 */
function playableModes(modes: readonly LiveMode[]): LiveMode[] {
  return modes.filter(
    m =>
      (m !== 'webrtc' || typeof RTCPeerConnection !== 'undefined') &&
      (m !== 'mse' || typeof MediaSource !== 'undefined'),
  );
}

/** A flat bar exactly the size of the frame, so nothing shifts when the frame arrives. */
function FrameSkeleton() {
  return (
    <AspectRatio ratio={16 / 9} className="w-full max-w-180" aria-hidden="true">
      <Skeleton className="absolute inset-0 size-full rounded-lg" />
    </AspectRatio>
  );
}

interface LivePlayerBlockProps {
  deviceId: number;
  deviceName: string;
  modes: readonly LiveMode[];
}

function LivePlayerBlock({ deviceId, deviceName, modes }: LivePlayerBlockProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const player = useLivePlayer(deviceId, modes, videoRef);
  const { mode } = player;
  if (!mode) return null; // unreachable: the caller passes at least one mode
  return (
    <>
      <SegmentedChips
        label="Live mode"
        options={modes.map(m => ({ id: m, label: MODE_LABEL[m] }))}
        value={mode}
        onChange={player.selectMode}
      />
      <p className="text-sm text-muted-foreground">{MODE_SENTENCE[mode]}</p>
      <LiveFrame
        deviceName={deviceName}
        mode={mode}
        phase={player.phase}
        videoRef={videoRef}
        onWatch={player.watch}
        onStop={player.stop}
      />
      {player.phase === 'failed' && player.message ? (
        <ErrorBlock message={player.message} onRetry={player.watch} />
      ) : (
        player.message && <p className="text-sm text-muted-foreground">{player.message}</p>
      )}
    </>
  );
}
