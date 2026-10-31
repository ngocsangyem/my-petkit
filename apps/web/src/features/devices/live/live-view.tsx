import { type ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '@/shared/api/errors';
import { Card, ErrorBlock, Segmented, Skeleton } from '@/shared/ui';
import { type LiveMode, useLiveInfo } from './live-api';
import { MODE_LABEL, MODE_SENTENCE, reasonSentence } from './live-copy';
import { LiveFrame } from './live-frame';
import { useLivePlayer } from './use-live-player';

interface LiveViewProps {
  deviceId: number;
  deviceName: string;
  /** Lays out the page header around the mode control (null until modes are known). */
  renderHeader?: (modes: ReactNode) => ReactNode;
  /** More buttons on the dark bar under the picture (device commands, camera pan). */
  barExtra?: ReactNode;
  /** More of the Stream card (addresses to copy), and cards under it. */
  streamExtra?: ReactNode;
  side?: ReactNode;
}

const GRID = 'grid items-start gap-5 min-[901px]:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]';

/**
 * The camera's live picture, on the dark live ground, with the stream facts beside it. Asks what
 * can be watched on open; connects only on Watch.
 */
export function LiveView({
  deviceId,
  deviceName,
  renderHeader,
  barExtra,
  streamExtra,
  side,
}: LiveViewProps) {
  const { t } = useTranslation('devices');
  const info = useLiveInfo(deviceId);
  const header = (modes: ReactNode) => (renderHeader ? renderHeader(modes) : modes);
  const stream = (sentence: string | null) => (
    <div className="flex min-w-0 flex-col gap-5">
      <Card as="section" aria-label={t('live.stream')} className="flex flex-col gap-2.5">
        <h2>{t('live.stream')}</h2>
        {sentence && <p className="text-sm">{sentence}</p>}
        <p className="text-sm text-muted-foreground">{t('live.nothingUntilWatch')}</p>
        {streamExtra}
      </Card>
      {side}
    </div>
  );

  if (info.isPending || info.isError || !info.data.available || !info.data.modes.length) {
    let body: ReactNode;
    if (info.isPending) body = <FrameSkeleton />;
    else if (info.isError) {
      body = (
        <ErrorBlock
          message={t('live.checkFailed', { error: errorMessage(info.error) })}
          onRetry={() => void info.refetch()}
          retrying={info.isFetching}
        />
      );
    } else {
      body = (
        <ErrorBlock
          message={reasonSentence(info.data.reason)}
          onRetry={() => void info.refetch()}
          retrying={info.isFetching}
        />
      );
    }
    return (
      <>
        {header(null)}
        <div className={GRID}>
          <section aria-label={t('live.frame.live')} className="min-w-0">
            {body}
          </section>
          {stream(null)}
        </div>
      </>
    );
  }

  return (
    <LivePlayerBlock
      deviceId={deviceId}
      deviceName={deviceName}
      modes={playableModes(info.data.modes)}
      header={header}
      barExtra={barExtra}
      stream={stream}
    />
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
    <div className="aspect-video w-full" aria-hidden="true">
      <Skeleton height="100%" />
    </div>
  );
}

interface LivePlayerBlockProps {
  deviceId: number;
  deviceName: string;
  modes: readonly LiveMode[];
  header: (modes: ReactNode) => ReactNode;
  barExtra?: ReactNode;
  stream: (sentence: string | null) => ReactNode;
}

function LivePlayerBlock(props: LivePlayerBlockProps) {
  const { t } = useTranslation('devices');
  const { deviceId, deviceName, modes } = props;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const player = useLivePlayer(deviceId, modes, videoRef);
  const { mode } = player;
  if (!mode) return null; // unreachable: the caller passes at least one mode
  return (
    <>
      {props.header(
        <Segmented
          fit
          label={t('live.modeLabel')}
          className="min-w-60"
          options={modes.map(m => ({ id: m, label: MODE_LABEL[m] }))}
          value={mode}
          onChange={player.selectMode}
        />,
      )}
      <div className={GRID}>
        <section aria-label={t('live.frame.live')} className="flex min-w-0 flex-col gap-3">
          <LiveFrame
            deviceName={deviceName}
            mode={mode}
            phase={player.phase}
            videoRef={videoRef}
            onWatch={player.watch}
            onStop={player.stop}
            barExtra={props.barExtra}
          />
          {player.phase === 'failed' && player.message ? (
            <ErrorBlock message={player.message} onRetry={player.watch} />
          ) : (
            player.message && <p className="text-sm text-muted-foreground">{player.message}</p>
          )}
        </section>
        {props.stream(MODE_SENTENCE[mode])}
      </div>
    </>
  );
}
