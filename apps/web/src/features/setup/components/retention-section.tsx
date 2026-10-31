import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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

/** The categories this screen edits (`rawUpload` keeps its server default). */
type Category = (typeof RETENTION_SIZED)[number] | (typeof RETENTION_AGE_ONLY)[number];

interface Caps {
  mb: number | null;
  days: number | null;
}

interface Row {
  key: Category;
  sized: boolean;
}

const ROWS: readonly Row[] = [
  ...RETENTION_SIZED.map(key => ({ key, sized: true })),
  ...RETENTION_AGE_ONLY.map(key => ({ key, sized: false })),
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

interface RetentionTableProps {
  data: RetentionCaps;
  save: ReturnType<typeof useSaveRetention>;
}

function RetentionTable({ data, save }: RetentionTableProps) {
  const { t } = useTranslation('setup');
  const name = (key: Category) => t(`retention.kind.${key}`);
  const [caps, setCaps] = useState(() => fromServer(data));

  const set = (key: Category, part: keyof Caps, value: number | null) => {
    save.reset();
    setCaps(c => ({ ...c, [key]: { ...(c[key] ?? { mb: null, days: null }), [part]: value } }));
  };

  const columns: TableColumn<Row>[] = [
    { key: 'label', header: t('retention.category'), cell: r => name(r.key) },
    {
      key: 'mb',
      header: t('retention.maxSize'),
      numeric: true,
      width: '100px',
      cell: r =>
        r.sized ? (
          <NumberInput
            className="w-22"
            min={0}
            aria-label={t('retention.maxSizeOf', { label: name(r.key) })}
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
      header: t('retention.maxAge'),
      numeric: true,
      width: '100px',
      cell: r => (
        <NumberInput
          className="w-22"
          min={0}
          aria-label={t('retention.maxAgeOf', { label: name(r.key) })}
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
        label={t('retention.caps')}
        variant="compact"
        columns={columns}
        rows={ROWS}
        rowKey={r => r.key}
        minWidth={300}
      />
      <p className="pt-3 text-xs text-muted-foreground">{t('retention.description')}</p>
      <div className="flex flex-wrap items-center gap-3 py-3">
        <Button
          size="small"
          onClick={() => {
            save.mutate(toPatch(caps));
          }}
          disabled={save.isPending}
        >
          {save.isPending ? t('retention.saving') : t('retention.save')}
        </Button>
        <span
          role="status"
          className={cn('text-sm', save.isError ? 'text-negative' : 'text-muted-foreground')}
        >
          {save.isError && t('retention.failed', { error: errorMessage(save.error) })}
          {save.isSuccess && t('retention.saved')}
        </span>
      </div>
    </>
  );
}

/** Keep: per-category media caps, events history and how long blocked attempts are kept. */
export function RetentionSection() {
  const { t } = useTranslation('setup');
  const retention = useRetention();
  // Owned here, not by the table: a save replaces the cached caps, which
  // remounts the table with them, and the "saved" line must survive that.
  const save = useSaveRetention();
  return (
    <SettingsSection title={t('retention.title')}>
      {retention.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {ROWS.map(r => (
            <Skeleton key={r.key} height={32} />
          ))}
        </div>
      ) : retention.isError ? (
        <ErrorBlock
          message={t('retention.loadFailed', { error: errorMessage(retention.error) })}
          onRetry={() => void retention.refetch()}
          retrying={retention.isFetching}
        />
      ) : (
        <RetentionTable key={retention.dataUpdatedAt} data={retention.data} save={save} />
      )}
    </SettingsSection>
  );
}
