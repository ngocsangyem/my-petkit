import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { copyText } from '@/shared/format/copy-text';
import { Button } from '@/shared/ui';

function urlsOf(streams: Record<string, unknown>): [string, string][] {
  return Object.entries(streams).filter(
    (e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '',
  );
}

function CopyRow({ label, url }: { label: string; url: string }) {
  const { t } = useTranslation('devices');
  const [said, setSaid] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 min-[901px]:grid-cols-[120px_minmax(0,1fr)_auto_auto]">
      <span className="col-span-full text-sm text-muted-foreground min-[901px]:col-span-1">
        {label}
      </span>
      <code className="overflow-x-auto font-mono text-sm whitespace-nowrap">{url}</code>
      <Button
        size="small"
        aria-label={t('stream.copyLabel', { label })}
        onClick={() => {
          void copyText(url).then(ok => {
            setSaid(ok ? t('stream.copied') : t('stream.copyFailed'));
          });
        }}
      >
        {t('stream.copy')}
      </Button>
      <span className="text-muted-foreground" role="status">
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
  const { t } = useTranslation('devices');
  const urls = urlsOf(streams);
  const rtsp = urls.find(([k]) => k === 'rtsp');
  const direct = urls.filter(([k]) => k !== 'rtsp');
  if (!urls.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {hasIp ? t('stream.none') : t('stream.noneNoIp')}
      </p>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      {rtsp && <CopyRow label={t('stream.camera')} url={rtsp[1]} />}
      {rtsp && <p className="text-sm text-muted-foreground">{t('stream.rtspNote')}</p>}
      {direct.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">{t('stream.direct')}</p>
          {direct.map(([k, url]) => (
            <CopyRow key={k} label={k} url={url} />
          ))}
        </>
      )}
    </div>
  );
}
