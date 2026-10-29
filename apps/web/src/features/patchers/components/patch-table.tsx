import { formatBytes } from '@/shared/format/format';
import { Button, Table, type TableColumn } from '@/shared/ui';
import type { PatcherEntry } from '../api';
import {
  firstParagraph,
  isFinalLine,
  primaryAction,
  statusOf,
  type StatusTone,
} from '../patcher-model';

/** Status word colour per tone: the word carries the state, never a fill. */
const TONE: Record<StatusTone, string> = {
  positive: 'text-positive',
  warning: 'text-warning',
  muted: 'text-muted-foreground',
};

interface PatchTableProps {
  patchers: readonly PatcherEntry[];
  /** Progress lines per patcher id, for the "Running" state. */
  linesOf: (patcherId: string) => readonly string[] | undefined;
  selected: string | null;
  onPick: (patcher: PatcherEntry, action: 'apply' | 'remove') => void;
}

function running(lines: readonly string[] | undefined): boolean {
  const last = lines?.at(-1);
  return last !== undefined && !isFinalLine(last) && !last.startsWith('ERROR');
}

/** One row per patcher: what it does, the space it needs, its state and one action. */
export function PatchTable({ patchers, linesOf, selected, onPick }: PatchTableProps) {
  const columns: TableColumn<PatcherEntry>[] = [
    {
      key: 'patch',
      header: 'Patch',
      width: '52%',
      cell: p => (
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{p.name}</span>
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {firstParagraph(p.description)}
          </span>
        </span>
      ),
    },
    {
      key: 'space',
      header: 'Needs free',
      numeric: true,
      nowrap: true,
      cell: p => `~${formatBytes(p.needs_bytes)}`,
    },
    {
      key: 'status',
      header: 'Status',
      cell: p => {
        if (running(linesOf(p.id))) return <span className="text-data">Running…</span>;
        const s = statusOf(p);
        return <span className={TONE[s.tone]}>{s.text}</span>;
      },
    },
    {
      key: 'action',
      header: 'Action',
      hiddenHeader: true,
      alignEnd: true,
      cell: p => {
        const action = primaryAction(p);
        return (
          <Button
            size="small"
            aria-label={`${action === 'apply' ? 'Apply' : 'Remove'} ${p.name}…`}
            onClick={() => {
              onPick(p, action);
            }}
          >
            {action === 'apply' ? 'Apply…' : 'Remove…'}
          </Button>
        );
      },
    },
  ];

  return (
    <Table
      label="Patches"
      columns={columns}
      rows={patchers}
      rowKey={p => p.id}
      selectedKey={selected}
      minWidth={680}
    />
  );
}
