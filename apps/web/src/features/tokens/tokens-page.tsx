import { useState } from 'react';
import { useServerInfo } from '@/auth/use-server-info';
import { errorMessage } from '@/shared/api/errors';
import { Button, ErrorBlock, Missing, SettingsSection, Skeleton } from '@/shared/ui';
import { useClientTokens, useCreatePairing, type Pairing } from './api';
import { PairingPanel } from './components/pairing-panel';
import { TokenList } from './components/token-list';
import { groupFingerprint } from './pairing-format';

/** This server as the app would dial it: the page's host at the user plane's TLS port. */
function ServerFacts() {
  const info = useServerInfo();
  if (info.isPending) return <Skeleton height={36} />;
  if (info.isError) return null;
  const { port, cert_sha256: sha } = info.data.user_tls;
  return (
    <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
      <span className="text-xs text-muted-foreground">This server and its certificate SHA-256</span>
      <span className="font-mono text-xs wrap-anywhere">
        {port ? `${window.location.hostname}:${port}` : <Missing />}
      </span>
      <span className="font-mono text-xs wrap-anywhere leading-relaxed tabular-nums [word-spacing:4px]">
        {sha ? groupFingerprint(sha) : <Missing />}
      </span>
    </div>
  );
}

/**
 * Client tokens on the Setup screen: the paired phones (with Revoke) and
 * "Pair a phone", which creates a single-use code and shows it as a QR code.
 */
export function TokensSection() {
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
    <SettingsSection
      title="Client tokens"
      description="Phones allowed to talk to this server. Pairing makes a single-use code that lives five minutes and asks for your password first."
    >
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
      <ServerFacts />
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
        <div className="flex flex-wrap gap-2 pt-3">
          <Button variant="primary" onClick={newCode} disabled={create.isPending || !tokens.data}>
            {create.isPending ? 'Creating…' : 'Pair a phone'}
          </Button>
        </div>
      )}
      {create.isError && (
        <p role="alert" className="pt-2 text-sm text-negative">
          No pairing code: {errorMessage(create.error)}
        </p>
      )}
    </SettingsSection>
  );
}
