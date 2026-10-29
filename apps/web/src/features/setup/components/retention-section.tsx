import { useState } from 'react';
import { cn } from 'cn';
import { errorMessage } from '@/shared/api/errors';
import {
  Button,
  ErrorBlock,
  Missing,
  NumberInput,
  SettingsSection,
  Skeleton,
  Table,
  type TableColumn,
} from '@/shared/ui';
import { useRetention, useSaveRetention, type RetentionPatch } from '../api';
import {
  RETENTION_AGE_ONLY,
  RETENTION_SIZED,
  type RetentionCaps,
} from '../retention-and-blocked-model';

type Category = keyof RetentionCaps;

interface Caps {
  mb: number | null;
  days: number | null;
}

interface Row {
  key: Category;
  label: string;
  sized: boolean;
}

const ROWS: readonly Row[] = [
  ...RETENTION_SIZED.map(([key, label]) => ({ key, label, sized: true })),
  ...RETENTION_AGE_ONLY.map(([key, label]) => ({ key, label, sized: false })),
];

function fromServer(data: RetentionCaps): Partial<Record<Category, Caps>> {
  const caps: Partial<Record<Category, Caps>> = {};
  for (const row of ROWS) {
    const cap = data[row.key];
    caps[row.key] = { mb: cap.max_mb ?? null, days: cap.max_days };
  }
  return caps;
}

/** The save body: every category with a size cap gets both caps; the age-only two get days. */
function toPatch(caps: Partial<Record<Category, Caps>>): RetentionPatch {
  const body: RetentionPatch = {};
  for (const row of ROWS) {
    const c = caps[row.key] ?? { mb: null, days: null };
    body[row.key] = row.sized ? { max_mb: c.mb, max_days: c.days } : { max_days: c.days };
  }
  return body;
}

const DESCRIPTION =
  'Over the size cap the oldest files go first; past the age cap they go regardless of size. The sweep runs about every 10 minutes. Leave a field blank for no cap: 0 also means no cap, not "delete everything". Blocked attempts are tiny and rare, so a long window costs almost nothing.';

interface RetentionTableProps {
  data: RetentionCaps;
  save: ReturnType<typeof useSaveRetention>;
}

function RetentionTable({ data, save }: RetentionTableProps) {
  const [caps, setCaps] = useState(() => fromServer(data));

  const set = (key: Category, part: keyof Caps, value: number | null) => {
    save.reset();
    setCaps(c => ({ ...c, [key]: { ...(c[key] ?? { mb: null, days: null }), [part]: value } }));
  };

  const columns: TableColumn<Row>[] = [
    { key: 'label', header: 'Category', cell: r => r.label },
    {
      key: 'mb',
      header: 'Max size (MB)',
      numeric: true,
      width: '140px',
      cell: r =>
        r.sized ? (
          <NumberInput
            className="w-27.5"
            min={0}
            aria-label={`${r.label}, max size in MB`}
            value={caps[r.key]?.mb ?? null}
            onValueChange={v => {
              set(r.key, 'mb', v);
            }}
          />
        ) : (
          <Missing />
        ),
    },
    {
      key: 'days',
      header: 'Max age (days)',
      numeric: true,
      width: '140px',
      cell: r => (
        <NumberInput
          className="w-27.5"
          min={0}
          aria-label={`${r.label}, max age in days`}
          value={caps[r.key]?.days ?? null}
          onValueChange={v => {
            set(r.key, 'days', v);
          }}
        />
      ),
    },
  ];

  return (
    <>
      <Table
        label="Retention caps"
        variant="compact"
        columns={columns}
        rows={ROWS}
        rowKey={r => r.key}
        minWidth={420}
      />
      <div className="flex flex-wrap items-center gap-3 pt-3">
        <Button
          onClick={() => {
            save.mutate(toPatch(caps));
          }}
          disabled={save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save retention'}
        </Button>
        <span
          role="status"
          className={cn('text-sm', save.isError ? 'text-negative' : 'text-muted-foreground')}
        >
          {save.isError && `Not saved: ${errorMessage(save.error)}`}
          {save.isSuccess && 'Retention saved.'}
        </span>
      </div>
    </>
  );
}

/** Per-category media caps, events history and how long blocked attempts are kept. */
export function RetentionSection() {
  const retention = useRetention();
  // Owned here, not by the table: a save replaces the cached caps, which
  // remounts the table with them, and the "saved" line must survive that.
  const save = useSaveRetention();
  return (
    <SettingsSection title="Retention" description={DESCRIPTION}>
      {retention.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {ROWS.map(r => (
            <Skeleton key={r.key} height={32} />
          ))}
        </div>
      ) : retention.isError ? (
        <ErrorBlock
          message={`Retention could not be loaded. ${errorMessage(retention.error)}`}
          onRetry={() => void retention.refetch()}
          retrying={retention.isFetching}
        />
      ) : (
        <RetentionTable key={retention.dataUpdatedAt} data={retention.data} save={save} />
      )}
    </SettingsSection>
  );
}
