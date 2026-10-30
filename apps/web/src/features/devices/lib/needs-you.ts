import type { components } from '@/api/schema';
import type { DeviceRow } from '../hooks/use-overview';
import { consumableText, lowConsumables, problemFor } from './device-status';
import type { DeviceZone } from './device-zone';

type Summary = components['schemas']['DeviceSummary'];
type Detail = components['schemas']['DeviceDetail'];

/** One thing on Home's "Needs you" card, about one device or accessory. */
export interface NeedsYouItem {
  /** Unique within the list. */
  id: string;
  /** The device page it opens. */
  row: DeviceRow;
  /** 500 line, e.g. "Water fountain is not reporting". */
  title: string;
  /** Muted (or coloured) line under it. */
  detail: string;
  tone: 'negative' | 'warning';
}

interface NeedsYouInput {
  devices: readonly Summary[];
  details: ReadonlyMap<number, Detail>;
  rows: readonly DeviceRow[];
  zoneOf: (id: number) => DeviceZone | null;
  nowSeconds: number;
}

/**
 * Everything Home asks the person to act on, worst first: a device that went silent or reports
 * an error, then a problem flag, then each consumable running low. Composed only from what the
 * device list and details already carry.
 */
export function needsYou({
  devices,
  details,
  rows,
  zoneOf,
  nowSeconds,
}: NeedsYouInput): NeedsYouItem[] {
  const out: NeedsYouItem[] = [];
  const rowOf = (key: string) => rows.find(r => r.key === key);
  for (const d of devices) {
    const row = rowOf(`d${d.id}`);
    if (!row) continue;
    const detail = details.get(d.id);
    const problem = problemFor(d, detail, zoneOf(d.id), nowSeconds);
    if (problem && !d.online) {
      out.push({
        id: `${row.key}:silent`,
        row,
        title: `${d.name} is not reporting`,
        detail: problem.text,
        tone: 'negative',
      });
    } else if (problem) {
      out.push({
        id: `${row.key}:problem`,
        row,
        title: problem.text,
        detail: d.name,
        tone: problem.tone,
      });
    }
    for (const c of detail ? lowConsumables(detail) : []) {
      out.push({
        id: `${row.key}:${c.label}`,
        row,
        title: consumableText(c.label, c.days).replace(/ in (\d)/, ' runs out in $1'),
        detail: d.name,
        tone: 'warning',
      });
    }
  }
  for (const row of rows) {
    if (row.kind === 'accessory' && row.attention) {
      out.push({
        id: `${row.key}:parent`,
        row,
        title: row.attention.text,
        detail: row.name,
        tone: row.attention.tone,
      });
    }
  }
  const rank = (i: NeedsYouItem) => (i.tone === 'negative' ? 0 : 1);
  return out.sort((a, b) => rank(a) - rank(b));
}

/** Blocked cloud attempts in the seven days up to `nowSeconds`. */
export function blockedThisWeek(
  records: readonly { created_at: number }[],
  nowSeconds: number,
): number {
  const from = nowSeconds - 7 * 86400;
  return records.filter(r => r.created_at >= from).length;
}
