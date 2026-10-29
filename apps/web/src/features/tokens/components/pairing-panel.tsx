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
      className="tokens-qr"
      viewBox={`-2 -2 ${size + 4} ${size + 4}`}
      width="196"
      height="196"
      role="img"
      aria-label="QR code for pairing the iOS app"
      shapeRendering="crispEdges"
    >
      <rect className="tokens-qr__ground" x="-2" y="-2" width={size + 4} height={size + 4} />
      <path className="tokens-qr__ink" d={path} />
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
    <div className="tokens-pairing" aria-labelledby={titleId} role="group">
      <h3 id={titleId} className="tokens-pairing__title">
        Pair the iOS app
      </h3>
      {pairedName ? (
        <p role="status">{pairedName} is paired. The code is used up.</p>
      ) : expired ? (
        <p role="status">This code has expired. Create a new one to pair a phone.</p>
      ) : (
        <>
          <p className="tokens-muted">
            Scan this code in the app. It carries this server’s address and certificate fingerprint,
            so the app trusts this server only.
          </p>
          <div className="tokens-qr-frame">
            <PairingQr text={payload} />
          </div>
          <div className="tokens-facts">
            <span className="tokens-caption">Server and certificate fingerprint</span>
            <span className="tokens-mono">{pairing.qr.url}</span>
            <span className="tokens-mono tokens-fingerprint">{fingerprint || '—'}</span>
          </div>
          <p className="tokens-muted">
            The app shows the same fingerprint before it connects. If they differ, do not continue.
          </p>
          <div className="tokens-code">
            <span className="tokens-caption">Code</span>
            <span className="tokens-mono">{pairing.code}</span>
            <Button
              size="small"
              onClick={() => {
                void copyText(pairing.code).then(setCopied);
              }}
            >
              Copy code
            </Button>
            <span role="status" className="tokens-muted">
              {copied === true && 'Copied.'}
              {copied === false && 'Copy failed; select the code instead.'}
            </span>
          </div>
          <p className="tokens-muted" role="timer" aria-live="off">
            Single use. Expires in{' '}
            <span className="tokens-num">{countdown(pairing.expires_at, now)}</span>.
          </p>
        </>
      )}
      <div className="tokens-actions">
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
