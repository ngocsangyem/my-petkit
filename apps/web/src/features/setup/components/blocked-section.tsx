import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '@/shared/api/errors';
import { formatDateTime } from '@/shared/format/format';
import {
  Button,
  ErrorBlock,
  SettingsSection,
  Table,
  ValueText,
  type TableColumn,
} from '@/shared/ui';
import { useBlocked } from '../api';
import { BLOCKED_LIMIT, redactLabel, type BlockedAttempt } from '../retention-and-blocked-model';

const columns = (t: TFunction<'setup'>): readonly TableColumn<BlockedAttempt>[] => [
  {
    key: 'when',
    header: t('blocked.when'),
    muted: true,
    nowrap: true,
    cell: b => formatDateTime(b.created_at),
  },
  {
    key: 'device',
    header: t('blocked.device'),
    mono: true,
    cell: b => (b.device_id === null ? <ValueText value={null} /> : `#${b.device_id}`),
  },
  { key: 'what', header: t('blocked.what'), cell: b => redactLabel(b.kind) },
  {
    key: 'endpoint',
    header: t('blocked.endpoint'),
    mono: true,
    cell: b => <ValueText value={b.endpoint} />,
  },
  {
    key: 'payload',
    header: t('blocked.payload'),
    mono: true,
    muted: true,
    cell: b => <span className="break-all wrap-anywhere">{b.payload_json ?? ''}</span>,
  },
];

/**
 * Instructions the real cloud sent that this server refused to pass on: shell
 * commands, firmware pushes, credential swaps. Routine address rewrites are
 * counters, not rows. On a healthy session there are none, and then the whole
 * section is absent rather than saying so at length.
 */
export function BlockedSection() {
  const { t } = useTranslation(['setup', 'common']);
  const [reveal, setReveal] = useState(false);
  const blocked = useBlocked(reveal);

  // 400 means this server has no event store to read; there is nothing to show.
  if (blocked.isError && blocked.error instanceof ApiError && blocked.error.status === 400) {
    return null;
  }
  const rows = blocked.data?.records ?? [];
  if (!reveal && !blocked.isError && rows.length === 0) return null;

  const count =
    rows.length >= BLOCKED_LIMIT
      ? t('blocked.newest', { count: BLOCKED_LIMIT })
      : t('blocked.count', { count: rows.length });
  return (
    <SettingsSection
      title={t('blocked.title')}
      end={
        !blocked.isError && rows.length > 0 ? (
          <span className="text-sm text-muted-foreground">{count}</span>
        ) : undefined
      }
    >
      <p className="pb-2 text-xs text-muted-foreground">{t('blocked.intro')}</p>
      {blocked.isError ? (
        <ErrorBlock
          message={
            reveal
              ? t('blocked.revealFailed', { error: errorMessage(blocked.error) })
              : t('blocked.loadFailed', { error: errorMessage(blocked.error) })
          }
          onRetry={() => void blocked.refetch()}
          retrying={blocked.isFetching}
        />
      ) : (
        <Table
          label={t('blocked.title')}
          variant="compact"
          columns={columns(t)}
          rows={rows}
          rowKey={b => String(b.id)}
          minWidth={640}
          emptyText={blocked.isPending ? t('common:loading') : t('blocked.empty')}
        />
      )}
      <div className="flex flex-wrap items-center gap-3 py-3">
        <Button
          size="small"
          onClick={() => {
            setReveal(r => !r);
          }}
        >
          {reveal ? t('blocked.mask') : t('blocked.reveal')}
        </Button>
        {reveal && !blocked.isError && rows.length > 0 && (
          <span className="text-sm text-muted-foreground">{t('blocked.shown')}</span>
        )}
      </div>
    </SettingsSection>
  );
}
