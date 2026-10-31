import { useState } from 'react';
import { cn } from 'cn';
import type { components } from '@/api/schema';
import { errorMessage } from '@/shared/api/errors';
import { Button, Icon, Skeleton } from '@/shared/ui';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/ui/shadcn/collapsible';
import { Table, TableBody, TableCell, TableRow } from '@/shared/ui/shadcn/table';
import { useTimelineEvent } from '../api';

type EventDetail = components['schemas']['TimelineEventDetail'];
type DecodedField = EventDetail['decoded'][number];

/**
 * A grade is the honest part of this panel: a value we confirmed, one inferred from captures,
 * one the firmware names but we never saw, or one passed through without understanding.
 */
const GRADE_TONE = new Map([
  ['confirmed', 'text-positive'],
  ['inferred', 'text-chart-2'],
  ['unverified', 'text-warning'],
  ['conflicted', 'text-negative'],
]);

function Grade({ grade }: { grade: string | null | undefined }) {
  const g = grade || 'unknown';
  return (
    <span className={cn('whitespace-nowrap', GRADE_TONE.get(g) ?? 'text-muted-foreground')}>
      {g}
    </span>
  );
}

// Key-value rows: a 1px rule above each, no row hover, text allowed to wrap anywhere.
const ROW = 'border-0 hover:bg-transparent';
const CELL = 'border-t border-rule py-[3px] pr-1.5 pl-0 align-top whitespace-normal';
const TABLE = 'text-xs wrap-anywhere';
const HEADING = 'mt-1 text-sm font-semibold';
const TRIGGER =
  'cursor-pointer border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-ring';
const PRE = 'mt-1.5 max-h-80 overflow-auto font-mono text-xs whitespace-pre-wrap wrap-anywhere';

/** A collapsed raw JSON block. */
function RawBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className={TRIGGER}>{title}</CollapsibleTrigger>
      <CollapsibleContent>
        <pre className={PRE}>{JSON.stringify(value, null, 2)}</pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * An epoch field is rendered here, in the reader's zone, so the page speaks one timezone: the
 * server formats in its container's zone, which could put the same instant two hours apart in
 * adjacent rows. Anything not flagged keeps the server's text.
 */
function fieldText(f: DecodedField): string {
  if (!f.epoch) return f.text;
  const n = Number(f.raw);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toLocaleString() : f.text;
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function DetailBody({ d }: { d: EventDetail }) {
  const e = d.event;
  const c = d.code;
  const meta: [string, unknown][] = [
    ['Event id', e.id],
    ['Code', e.event_type],
    ['Kind', e.event_kind],
    ['Transport', e.source],
    ['Device', [e.device_id, e.device_type].filter(v => v !== null && v !== '').join(' · ')],
    ['Received', e.ts ? new Date(e.ts * 1000).toLocaleString() : null],
    ['Episode', e.related_event],
    ['Parent episode', e.parent_event],
    ['Dedup key', e.event_uid],
    // Reported vs resolved: a ref with no pet means the box still matches against faces cached
    // from PetKit's cloud; bind it in the Pets tab.
    ['Reported pet id', e.pet_ref],
    ['Pet', e.pet_name ?? e.pet_id],
    ['Match score', e.score],
  ];
  return (
    <div className="flex flex-col gap-1.5 pt-2 text-foreground">
      <h4 className={HEADING}>What this code means</h4>
      {c ? (
        <Table className={TABLE}>
          <TableBody>
            <TableRow className={ROW}>
              <TableCell className={CELL}>Means</TableCell>
              <TableCell className={CELL} colSpan={2}>
                <b className="font-semibold">{c.label}</b>
              </TableCell>
              <TableCell className={CELL}>
                <Grade grade={c.grade} />
              </TableCell>
            </TableRow>
            {c.firmware && (
              <TableRow className={ROW}>
                <TableCell className={CELL}>Firmware</TableCell>
                <TableCell className={CELL} colSpan={3}>
                  <code className="font-mono text-xs">{c.firmware}</code>
                </TableCell>
              </TableRow>
            )}
            {c.note && (
              <TableRow className={ROW}>
                <TableCell className={CELL} />
                <TableCell className={cn(CELL, 'text-muted-foreground')} colSpan={3}>
                  {c.note}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      ) : (
        <p className="text-muted-foreground">
          This code is in no table yet; it reads as a bare "Event N".
        </p>
      )}
      <h4 className={HEADING}>Decoded payload</h4>
      {d.decoded.length ? (
        <Table className={TABLE}>
          <TableBody>
            {d.decoded.map(f => [
              <TableRow className={ROW} key={f.key}>
                <TableCell className={CELL}>{f.label}</TableCell>
                <TableCell className={CELL}>
                  <b className="font-semibold">{fieldText(f)}</b>
                </TableCell>
                <TableCell className={cn(CELL, 'text-muted-foreground')}>
                  <code className="font-mono text-xs">{JSON.stringify(f.raw)}</code>
                </TableCell>
                <TableCell className={CELL}>
                  <Grade grade={f.grade} />
                </TableCell>
              </TableRow>,
              f.note ? (
                <TableRow className={ROW} key={`${f.key}-note`}>
                  <TableCell className={CELL} />
                  <TableCell className={cn(CELL, 'text-muted-foreground')} colSpan={3}>
                    {f.note}
                  </TableCell>
                </TableRow>
              ) : null,
            ])}
          </TableBody>
        </Table>
      ) : (
        <p className="text-muted-foreground">The device sent no content.</p>
      )}
      <h4 className={HEADING}>Event record</h4>
      <Table className={TABLE}>
        <TableBody>
          {meta
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => (
              <TableRow className={ROW} key={k}>
                <TableCell className={CELL}>{k}</TableCell>
                <TableCell className={CELL} colSpan={3}>
                  <code className="font-mono text-xs">{text(v)}</code>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
      <RawBlock title="Raw content JSON" value={d.content} />
      <RawBlock title="Raw state snapshot" value={d.state} />
    </div>
  );
}

function EventDebug({ id, title }: { id: number; title: string }) {
  const [open, setOpen] = useState(false);
  const q = useTimelineEvent(id, open);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md bg-raised px-2.5 py-1.5">
      <CollapsibleTrigger className={TRIGGER}>{title}</CollapsibleTrigger>
      <CollapsibleContent>
        {q.error ? (
          <div className="flex flex-wrap items-center gap-2 pt-1.5 text-foreground" role="alert">
            <span>Could not load this event. {errorMessage(q.error)}</span>
            <Button variant="text" onClick={() => void q.refetch()}>
              Retry
            </Button>
          </div>
        ) : q.data ? (
          <DetailBody d={q.data} />
        ) : (
          <Skeleton height={120} />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export interface DebugEntry {
  id: number;
  title: string;
}

/** What each device actually reported, per event, fetched only when opened. */
export function TimelineDebugInfo({ entries }: { entries: readonly DebugEntry[] }) {
  if (!entries.length) return null;
  return (
    <Collapsible className="text-sm text-muted-foreground">
      <CollapsibleTrigger
        className={cn(
          TRIGGER,
          'flex min-h-11 w-full items-center gap-3 text-foreground data-panel-open:[&_svg]:rotate-180',
        )}
      >
        <span className="min-w-0 flex-1">
          <span>Debug info</span>
          <span className="text-muted-foreground"> · event codes, raw payload</span>
        </span>
        <Icon name="chevron" size={16} className="text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-1.5 pt-1.5">
        {entries.map(e => (
          <EventDebug key={e.id} id={e.id} title={e.title} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
