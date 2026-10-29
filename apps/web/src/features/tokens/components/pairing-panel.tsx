import { useEffect, useId, useMemo, useState } from 'react';
import { copyText } from '@/shared/format/copy-text';
import { Button } from '@/shared/ui';
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

/** QR code drawn as SVG in the ink token: every dark module is one square of the path. */
function PairingQr({ text }: { text: string }) {
  const { size, path } = useMemo(() => qrPath(text), [text]);
  return (
    <svg
      className="block h-auto max-w-full"
      viewBox={`-2 -2 ${size + 4} ${size + 4}`}
      width="196"
      height="196"
      role="img"
      aria-label="QR code for pairing the iOS app"
      shapeRendering="crispEdges"
    >
      <rect className="fill-background" x="-2" y="-2" width={size + 4} height={size + 4} />
      <path className="fill-ink" d={path} />
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
    <div
      className="mt-3 flex flex-col gap-3 border-t border-border pt-3"
      aria-labelledby={titleId}
      role="group"
    >
      <h3 id={titleId} className="text-lg font-semibold">
        Pair the iOS app
      </h3>
      {pairedName ? (
        <p role="status">{pairedName} is paired. The code is used up.</p>
      ) : expired ? (
        <p role="status">This code has expired. Create a new one to pair a phone.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Scan this code in the app. It carries this server’s address and certificate fingerprint,
            so the app trusts this server only.
          </p>
          <div className="flex justify-center rounded-lg bg-background p-4">
            <PairingQr text={payload} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Server and certificate fingerprint
            </span>
            <span className="font-mono text-xs wrap-anywhere">{pairing.qr.url}</span>
            <span className="font-mono text-xs wrap-anywhere leading-relaxed tabular-nums [word-spacing:4px]">
              {fingerprint || '—'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            The app shows the same fingerprint before it connects. If they differ, do not continue.
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-xs text-muted-foreground">Code</span>
            <span className="font-mono text-xs wrap-anywhere">{pairing.code}</span>
            <Button
              size="small"
              onClick={() => {
                void copyText(pairing.code).then(setCopied);
              }}
            >
              Copy code
            </Button>
            <span role="status" className="text-sm text-muted-foreground">
              {copied === true && 'Copied.'}
              {copied === false && 'Copy failed; select the code instead.'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground" role="timer" aria-live="off">
            Single use. Expires in{' '}
            <span className="tabular-nums">{countdown(pairing.expires_at, now)}</span>.
          </p>
        </>
      )}
      <div className="flex flex-wrap gap-2 pt-3">
        {(expired || pairedName) && (
          <Button onClick={onNewCode} disabled={creating}>
            {creating ? 'Creating…' : 'New code'}
          </Button>
        )}
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
