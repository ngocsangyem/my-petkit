import { useEffect, useId, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { copyText } from '@/shared/format/copy-text';
import { Button, Panel } from '@/shared/ui';
import type { Pairing } from '../api';
import { countdown, groupFingerprint, qrPath } from '../pairing-format';

interface PairingPanelProps {
  pairing: Pairing;
  /** Name of the token the code was redeemed for, once the phone has paired. */
  pairedName: string | null;
  onNewCode: () => void;
  onClose: () => void;
  creating: boolean;
}

/**
 * QR code drawn as SVG: every dark module is one square of the path. Dark on light in both themes,
 * since an inverted code fails in many scanners; the live view's constant pair supplies the two.
 */
function PairingQr({ text }: { text: string }) {
  const { t } = useTranslation('tokens');
  const { size, path } = useMemo(() => qrPath(text), [text]);
  return (
    <svg
      className="block h-auto max-w-full"
      viewBox={`-2 -2 ${size + 4} ${size + 4}`}
      width="140"
      height="140"
      role="img"
      aria-label={t('pairing.qrLabel')}
      shapeRendering="crispEdges"
    >
      <rect className="fill-live-text" x="-2" y="-2" width={size + 4} height={size + 4} />
      <path className="fill-live-ground" d={path} />
    </svg>
  );
}

/**
 * A fresh pairing code: the QR the app scans (server address, the certificate
 * to pin, the code), the same facts as text to compare, and the time left.
 */
export function PairingPanel({
  pairing,
  pairedName,
  onNewCode,
  onClose,
  creating,
}: PairingPanelProps) {
  const { t } = useTranslation('tokens');
  const titleId = useId();
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState<boolean | null>(null);
  const expired = now / 1000 >= pairing.expires_at;

  useEffect(() => {
    if (expired || pairedName) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [expired, pairedName]);

  const payload = JSON.stringify(pairing.qr);
  const fingerprint = groupFingerprint(pairing.qr.cert_sha256);

  return (
    <Panel className="flex flex-col gap-3" aria-labelledby={titleId} role="group">
      <h3 id={titleId} className="text-base font-semibold">
        {t('pairing.title')}
      </h3>
      {pairedName ? (
        <p role="status">{t('pairing.paired', { name: pairedName })}</p>
      ) : expired ? (
        <p role="status">{t('pairing.expired')}</p>
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-none rounded-md bg-live-text p-3.5">
            <PairingQr text={payload} />
          </div>
          <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
            <p className="text-sm">
              {t('pairing.scan')}{' '}
              <span role="timer" aria-live="off">
                <Trans
                  t={t}
                  i18nKey="pairing.expires"
                  values={{ time: countdown(pairing.expires_at, now) }}
                  components={{ time: <span className="tabular-nums" /> }}
                />
              </span>
            </p>
            <span className="text-sm text-muted-foreground">{t('pairing.serverFacts')}</span>
            <span className="font-mono text-xs wrap-anywhere">{pairing.qr.url}</span>
            <span className="font-mono text-xs leading-relaxed wrap-anywhere tabular-nums [word-spacing:4px]">
              {fingerprint || '—'}
            </span>
            <p className="text-xs text-muted-foreground">{t('pairing.compare')}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-xs text-muted-foreground">{t('pairing.code')}</span>
              <span className="font-mono text-xs wrap-anywhere">{pairing.code}</span>
              <Button
                size="small"
                onClick={() => {
                  void copyText(pairing.code).then(setCopied);
                }}
              >
                {t('pairing.copy')}
              </Button>
              <span role="status" className="text-sm text-muted-foreground">
                {copied === true && t('pairing.copied')}
                {copied === false && t('pairing.copyFailed')}
              </span>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {(expired || pairedName) && (
          <Button size="small" onClick={onNewCode} disabled={creating}>
            {creating ? t('section.creating') : t('pairing.newCode')}
          </Button>
        )}
        <Button size="small" onClick={onClose}>
          {t('pairing.done')}
        </Button>
      </div>
    </Panel>
  );
}
