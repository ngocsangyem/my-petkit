import { useState } from 'react';
import { ApiError, errorMessage } from '@/shared/api/errors';
import { formatDateTime } from '@/shared/format/format';
import { Button, ErrorBlock, Table, ValueText, type TableColumn } from '@/shared/ui';
import { useBlocked } from '../api';
import { BLOCKED_LIMIT, redactLabel, type BlockedAttempt } from '../retention-and-blocked-model';
import { SettingsCard } from './settings-card';

const COLUMNS: readonly TableColumn<BlockedAttempt>[] = [
  {
    key: 'when',
    header: 'When',
    muted: true,
    nowrap: true,
    cell: b => formatDateTime(b.created_at),
  },
  {
    key: 'device',
    header: 'Device',
    mono: true,
    cell: b => (b.device_id === null ? <ValueText value={null} /> : `#${b.device_id}`),
  },
  { key: 'what', header: 'What the cloud tried', cell: b => redactLabel(b.kind) },
  { key: 'endpoint', header: 'Endpoint', mono: true, cell: b => <ValueText value={b.endpoint} /> },
  {
    key: 'payload',
    header: 'Payload',
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
  const [reveal, setReveal] = useState(false);
  const blocked = useBlocked(reveal);

  // 400 means this server has no event store to read; there is nothing to show.
  if (blocked.isError && blocked.error instanceof ApiError && blocked.error.status === 400) {
    return null;
  }
  const rows = blocked.data?.records ?? [];
  if (!reveal && !blocked.isError && rows.length === 0) return null;

  const count = rows.length >= BLOCKED_LIMIT ? `The newest ${BLOCKED_LIMIT}` : String(rows.length);
  return (
    <SettingsCard
      title="Blocked attempts"
      end={
        !blocked.isError && rows.length > 0 ? (
          <span className="text-sm text-muted-foreground">
            {count} {rows.length === 1 ? 'attempt' : 'attempts'}
          </span>
        ) : undefined
      }
    >
      <p className="pb-2 text-xs text-muted-foreground">
        What the cloud tried to do and was stopped. Kept in the database, so the list outlives a
        restart. Payloads can hold a real device secret, so they are masked; revealing them asks for
        your password.
      </p>
      {blocked.isError ? (
        <ErrorBlock
          message={
            reveal
              ? `Payloads were not revealed. ${errorMessage(blocked.error)}`
              : `Blocked attempts could not be loaded. ${errorMessage(blocked.error)}`
          }
          onRetry={() => void blocked.refetch()}
          retrying={blocked.isFetching}
        />
      ) : (
        <Table
          label="Blocked attempts"
          variant="compact"
          columns={COLUMNS}
          rows={rows}
          rowKey={b => String(b.id)}
          minWidth={640}
          emptyText={blocked.isPending ? 'Loading…' : 'No blocked attempts.'}
        />
      )}
      <div className="flex flex-wrap items-center gap-3 py-3">
        <Button
          size="small"
          onClick={() => {
            setReveal(r => !r);
          }}
        >
          {reveal ? 'Mask payloads' : 'Reveal payloads'}
        </Button>
        {reveal && !blocked.isError && rows.length > 0 && (
          <span className="text-sm text-muted-foreground">Payloads shown in full.</span>
        )}
      </div>
    </SettingsCard>
  );
}
