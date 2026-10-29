import { useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { formatDateTime, relativeTime } from '@/shared/format/format';
import { Button, ConfirmDialog, EmptyBlock } from '@/shared/ui';
import { useRevokeToken, type ClientToken } from '../api';

function tokenName(t: ClientToken): string {
  return t.name || `Token ${t.id}`;
}

/** Paired phones, newest first as the server lists them, each with Revoke. */
export function TokenList({ tokens }: { tokens: readonly ClientToken[] }) {
  const [asking, setAsking] = useState<ClientToken | null>(null);
  const revoke = useRevokeToken();

  if (tokens.length === 0) return <EmptyBlock>No phone is paired yet.</EmptyBlock>;

  return (
    <>
      <ul className="tokens-list" aria-label="Client tokens">
        {tokens.map(t => (
          <li key={t.id} className="tokens-row">
            <span className="tokens-row__text">
              <span className="tokens-row__name">{tokenName(t)}</span>
              <span className="tokens-muted">
                Paired {formatDateTime(t.created_at)} · last used {relativeTime(t.last_used)}
              </span>
            </span>
            <Button
              variant="destructive"
              onClick={() => {
                revoke.reset();
                setAsking(t);
              }}
              disabled={revoke.isPending && revoke.variables === t.id}
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>
      {revoke.isError && (
        <p role="alert" className="tokens-error">
          Not revoked: {errorMessage(revoke.error)}
        </p>
      )}
      <ConfirmDialog
        open={asking !== null}
        title={`Revoke “${asking ? tokenName(asking) : ''}”?`}
        confirmLabel="Revoke"
        busy={revoke.isPending}
        onCancel={() => {
          setAsking(null);
        }}
        onConfirm={() => {
          if (!asking) return;
          revoke.mutate(asking.id, {
            onSettled: () => {
              setAsking(null);
            },
          });
        }}
      >
        <p>The app on that phone is signed out at once and has to be paired again.</p>
      </ConfirmDialog>
    </>
  );
}
