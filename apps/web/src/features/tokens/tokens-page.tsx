import { useId, useState } from 'react';
import { useServerInfo } from '@/auth/use-server-info';
import { errorMessage } from '@/shared/api/errors';
import { Button, Card, ErrorBlock, Icon, Missing, Panel, Skeleton } from '@/shared/ui';
import { useClientTokens, useCreatePairing, type Pairing } from './api';
import { PairingPanel } from './components/pairing-panel';
import { TokenList } from './components/token-list';
import { groupFingerprint } from './pairing-format';

/** This server as the app would dial it: the page's host at the user plane's TLS port. */
function ServerFacts() {
  const info = useServerInfo();
  let facts;
  if (info.isPending) facts = <Skeleton height={36} />;
  else if (info.isError) facts = null;
  else {
    const { port, cert_sha256: sha } = info.data.user_tls;
    facts = (
      <>
        <span className="text-sm text-muted-foreground">
          This server and its certificate SHA-256
        </span>
        <span className="font-mono text-xs wrap-anywhere">
          {port ? `${window.location.hostname}:${port}` : <Missing />}
        </span>
        <span className="font-mono text-xs leading-relaxed wrap-anywhere tabular-nums [word-spacing:4px]">
          {sha ? groupFingerprint(sha) : <Missing />}
        </span>
      </>
    );
  }
  return (
    <Panel className="flex flex-col gap-1.5">
      <p className="text-sm">
        Pair a phone makes a single-use code that lives five minutes and asks for your password
        first. The my-petkit app scans it and trusts this server only.
      </p>
      {facts}
    </Panel>
  );
}

/**
 * Phones and apps on the Settings screen: "Pair a phone", which creates a single-use code and
 * shows it as a QR code, then the paired phones with Revoke.
 */
export function TokensSection() {
  const headingId = useId();
  const [pairing, setPairing] = useState<{ code: Pairing; knownIds: Set<number> } | null>(null);
  const tokens = useClientTokens(pairing !== null);
  const create = useCreatePairing();

  // A token that was not there when the code was made is the phone that redeemed it.
  const paired =
    pairing && tokens.data ? tokens.data.find(t => !pairing.knownIds.has(t.id)) : undefined;

  function newCode() {
    // Without the current list every existing token would look newly paired.
    if (!tokens.data) return;
    const knownIds = new Set(tokens.data.map(t => t.id));
    create.mutate(undefined, {
      onSuccess: code => {
        setPairing({ code, knownIds });
      },
    });
  }

  return (
    <Card as="section" aria-labelledby={headingId} className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId}>Phones and apps</h2>
        {!pairing && (
          <Button
            variant="primary"
            size="small"
            onClick={newCode}
            disabled={create.isPending || !tokens.data}
          >
            <Icon name="qr" size={16} />
            {create.isPending ? 'Creating…' : 'Pair a phone'}
          </Button>
        )}
      </div>
      {create.isError && (
        <p role="alert" className="text-sm text-negative">
          No pairing code: {errorMessage(create.error)}
        </p>
      )}
      {pairing ? (
        <PairingPanel
          key={pairing.code.code}
          pairing={pairing.code}
          pairedName={paired ? paired.name || `Token ${paired.id}` : null}
          creating={create.isPending}
          onNewCode={newCode}
          onClose={() => {
            setPairing(null);
            create.reset();
          }}
        />
      ) : (
        <ServerFacts />
      )}
      {tokens.isPending ? (
        <Skeleton height={48} />
      ) : tokens.isError ? (
        <ErrorBlock
          message={`Client tokens could not be loaded. ${errorMessage(tokens.error)}`}
          onRetry={() => void tokens.refetch()}
          retrying={tokens.isFetching}
        />
      ) : (
        <TokenList tokens={tokens.data} />
      )}
    </Card>
  );
}
