import { relativeTime } from '@/shared/format/format';
import { Missing, StatusMark, Table, type TableColumn } from '@/shared/ui';
import type { DeviceStatus } from '@/shared/ui';
import type { Attention } from '../lib/device-status';

/** One row of the device list, device or accessory, already worked out. */
export interface DeviceRow {
  key: string;
  name: string;
  model: string;
  id: string;
  status: { status: DeviceStatus; label: string };
  now: string | null;
  attention: Attention | null;
  lastReport: number | null;
}

const COLUMNS: readonly TableColumn<DeviceRow>[] = [
  {
    key: 'device',
    header: 'Device',
    width: '34%',
    cell: r => (
      <a
        className="flex flex-col text-foreground"
        href={`#device-${r.key}`}
        onClick={e => {
          // Hash routing owns the URL fragment, so scroll to the panel instead of navigating.
          e.preventDefault();
          document.getElementById(`device-${r.key}`)?.scrollIntoView({ block: 'start' });
        }}
      >
        <span className="font-medium">{r.name}</span>
        <span className="text-xs text-muted-foreground">
          {r.model} · <span className="font-mono">{r.id}</span>
        </span>
      </a>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: r => <StatusMark status={r.status.status} label={r.status.label} />,
  },
  { key: 'now', header: 'Now', cell: r => r.now ?? <Missing /> },
  {
    key: 'attention',
    header: 'Needs you',
    cell: r =>
      r.attention ? (
        <span className={r.attention.tone === 'negative' ? 'text-negative' : 'text-warning'}>
          {r.attention.text}
        </span>
      ) : (
        <Missing />
      ),
  },
  {
    key: 'last',
    header: 'Last report',
    numeric: true,
    nowrap: true,
    cell: r => (r.lastReport === null ? 'never' : relativeTime(r.lastReport)),
  },
];

/** "All devices": one row per device and accessory; the name jumps to its panel. */
export function DeviceTable({ rows }: { rows: readonly DeviceRow[] }) {
  return (
    <section className="flex min-w-0 flex-col gap-2" aria-labelledby="devices-all-heading">
      <h2 id="devices-all-heading" className="text-lg font-semibold">
        All devices
      </h2>
      <Table label="All devices" columns={COLUMNS} rows={rows} rowKey={r => r.key} minWidth={760} />
    </section>
  );
}
