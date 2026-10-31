import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n';
import { errorMessage } from '@/shared/api/errors';
import { formatDateTime, relativeTime } from '@/shared/format/format';
import { Button, ConfirmDialog, EmptyBlock, Icon, Table, type TableColumn } from '@/shared/ui';
import { useRevokeToken, type ClientToken } from '../api';

/** The token's own name, or a numbered fallback for one created without a name. */
export function tokenName(token: Pick<ClientToken, 'id' | 'name'>): string {
  return token.name || i18n.t('tokens:tokenName', { id: token.id });
}

/** Paired phones, newest first as the server lists them, each with Revoke. */
export function TokenList({ tokens }: { tokens: readonly ClientToken[] }) {
  const { t } = useTranslation('tokens');
  const [asking, setAsking] = useState<ClientToken | null>(null);
  const revoke = useRevokeToken();

  if (tokens.length === 0) return <EmptyBlock>{t('list.empty')}</EmptyBlock>;

  const columns: TableColumn<ClientToken>[] = [
    {
      key: 'phone',
      header: t('list.client'),
      cell: token => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Icon name="phone" size={18} className="flex-none text-muted-foreground" />
          <span className="flex min-w-0 flex-col">
            <span className="wrap-anywhere">{tokenName(token)}</span>
            <span className="text-xs text-muted-foreground">
              {t('list.paired', { when: formatDateTime(token.created_at) })}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'seen',
      header: t('list.lastSeen'),
      muted: true,
      nowrap: true,
      cell: token => relativeTime(token.last_used),
    },
    {
      key: 'action',
      header: t('list.action'),
      hiddenHeader: true,
      alignEnd: true,
      cell: token => (
        <Button
          variant="destructive"
          size="small"
          onClick={() => {
            revoke.reset();
            setAsking(token);
          }}
          disabled={revoke.isPending && revoke.variables === token.id}
        >
          {t('list.revoke')}
        </Button>
      ),
    },
  ];

  return (
    <>
      <Table
        label={t('list.label')}
        columns={columns}
        rows={tokens}
        rowKey={token => String(token.id)}
      />
      {revoke.isError && (
        <p role="alert" className="pt-2 text-sm text-negative">
          {t('list.revokeFailed', { error: errorMessage(revoke.error) })}
        </p>
      )}
      <ConfirmDialog
        open={asking !== null}
        title={t('list.confirmTitle', { name: asking ? tokenName(asking) : '' })}
        confirmLabel={t('list.revoke')}
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
        <p>{t('list.confirmBody')}</p>
      </ConfirmDialog>
    </>
  );
}
