import { useState } from 'react';
import { copyText } from '@/shared/format/copy-text';
import { Button } from '@/shared/ui';

function urlsOf(streams: Record<string, unknown>): [string, string][] {
  return Object.entries(streams).filter(
    (e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '',
  );
}

function CopyRow({ label, url }: { label: string; url: string }) {
  const [said, setSaid] = useState<string | null>(null);
  return (
    <div className="devices-stream-row">
      <span className="devices-stream-row__label">{label}</span>
      <code className="devices-mono devices-stream-row__url">{url}</code>
      <Button
        size="small"
        aria-label={`Copy ${label} URL`}
        onClick={() => {
          void copyText(url).then(ok => {
            setSaid(ok ? 'Copied' : 'Could not copy; select the address instead');
          });
        }}
      >
        Copy
      </Button>
      <span className="devices-muted" role="status">
        {said ?? ''}
      </span>
    </div>
  );
}

/**
 * The stream addresses: the one thing on this page you paste somewhere else, and
 * too long to select by hand. The go2rtc RTSP address is the one to give Home
 * Assistant; the device's own FLV crashes the PyAV that HA opens streams with.
 */
export function StreamUrls({
  streams,
  hasIp,
}: {
  streams: Record<string, unknown>;
  hasIp: boolean;
}) {
  const urls = urlsOf(streams);
  const rtsp = urls.find(([k]) => k === 'rtsp');
  const direct = urls.filter(([k]) => k !== 'rtsp');
  if (!urls.length) {
    return (
      <p className="devices-note">
        No live stream. The device is checked for one every few minutes, and it answers once Local
        Camera Streaming is applied on the Patchers screen
        {hasIp ? '' : ', and it has not reported an IP yet either'}.
      </p>
    );
  }
  return (
    <div className="devices-stack">
      {rtsp && <CopyRow label="Camera stream" url={rtsp[1]} />}
      {rtsp && (
        <p className="devices-note">
          Give this one to Home Assistant as a Generic Camera. This app’s go2rtc stands between it
          and the device.
        </p>
      )}
      {direct.length > 0 && (
        <>
          <p className="devices-note">
            Straight from the device (VLC, ffmpeg; not Home Assistant):
          </p>
          {direct.map(([k, url]) => (
            <CopyRow key={k} label={k} url={url} />
          ))}
        </>
      )}
    </div>
  );
}
