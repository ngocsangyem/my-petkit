import { useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { formatDateTime, relativeTime } from '@/shared/format/format';
import { Button, ConfirmDialog, EmptyBlock, Table, type TableColumn } from '@/shared/ui';
import { useRevokeToken, type ClientToken } from '../api';

function tokenName(t: ClientToken): string {
  return t.name || `Token ${t.id}`;
}

/** Paired phones, newest first as the server lists them, each with Revoke. */
export function TokenList({ tokens }: { tokens: readonly ClientToken[] }) {
  const [asking, setAsking] = useState<ClientToken | null>(null);
  const revoke = useRevokeToken();

  if (tokens.length === 0) return <EmptyBlock>No phone is paired yet.</EmptyBlock>;

  const columns: TableColumn<ClientToken>[] = [
    {
      key: 'phone',
      header: 'Phone',
      cell: t => (
        <span className="flex min-w-0 flex-col">
          <span className="font-medium wrap-anywhere">{tokenName(t)}</span>
          <span className="text-sm text-muted-foreground">
            Paired {formatDateTime(t.created_at)} · last used {relativeTime(t.last_used)}
          </span>
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      hiddenHeader: true,
      alignEnd: true,
      cell: t => (
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
      ),
    },
  ];

  return (
    <>
      <Table
        label="Client tokens"
        variant="compact"
        columns={columns}
        rows={tokens}
        rowKey={t => String(t.id)}
      />
      {revoke.isError && (
        <p role="alert" className="pt-2 text-sm text-negative">
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
