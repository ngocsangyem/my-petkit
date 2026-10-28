import { useState } from 'react';
import type { components } from '@/api/schema';
import { errorMessage } from '@/shared/api/errors';
import { Button, Skeleton } from '@/shared/ui';
import { useTimelineEvent } from '../api';
import './timeline-debug-info.css';

type EventDetail = components['schemas']['TimelineEventDetail'];
type DecodedField = EventDetail['decoded'][number];

/**
 * A grade is the honest part of this panel: a value we confirmed, one inferred from captures,
 * one the firmware names but we never saw, or one passed through without understanding.
 */
function Grade({ grade }: { grade: string | null | undefined }) {
  const g = grade || 'unknown';
  return <span className={`tl-grade tl-grade--${g.replace(/[^a-z]/g, '')}`}>{g}</span>;
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
    <div className="tl-dbg">
      <h4>What this code means</h4>
      {c ? (
        <table className="tl-dbg__table">
          <tbody>
            <tr>
              <td>Means</td>
              <td colSpan={2}>
                <b>{c.label}</b>
              </td>
              <td>
                <Grade grade={c.grade} />
              </td>
            </tr>
            {c.firmware && (
              <tr>
                <td>Firmware</td>
                <td colSpan={3}>
                  <code>{c.firmware}</code>
                </td>
              </tr>
            )}
            {c.note && (
              <tr>
                <td />
                <td colSpan={3} className="tl-muted">
                  {c.note}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <p className="tl-muted">This code is in no table yet; it reads as a bare "Event N".</p>
      )}
      <h4>Decoded payload</h4>
      {d.decoded.length ? (
        <table className="tl-dbg__table">
          <tbody>
            {d.decoded.map(f => [
              <tr key={f.key}>
                <td>{f.label}</td>
                <td>
                  <b>{fieldText(f)}</b>
                </td>
                <td className="tl-muted">
                  <code>{JSON.stringify(f.raw)}</code>
                </td>
                <td>
                  <Grade grade={f.grade} />
                </td>
              </tr>,
              f.note ? (
                <tr key={`${f.key}-note`}>
                  <td />
                  <td colSpan={3} className="tl-muted">
                    {f.note}
                  </td>
                </tr>
              ) : null,
            ])}
          </tbody>
        </table>
      ) : (
        <p className="tl-muted">The device sent no content.</p>
      )}
      <h4>Event record</h4>
      <table className="tl-dbg__table">
        <tbody>
          {meta
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td colSpan={3}>
                  <code>{text(v)}</code>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      <details className="tl-dbg__raw">
        <summary>Raw content JSON</summary>
        <pre>{JSON.stringify(d.content, null, 2)}</pre>
      </details>
      <details className="tl-dbg__raw">
        <summary>Raw state snapshot</summary>
        <pre>{JSON.stringify(d.state, null, 2)}</pre>
      </details>
    </div>
  );
}

function EventDebug({ id, title }: { id: number; title: string }) {
  const [open, setOpen] = useState(false);
  const q = useTimelineEvent(id, open);
  return (
    <details
      className="tl-dbg__event"
      onToggle={e => {
        setOpen(e.currentTarget.open);
      }}
    >
      <summary>{title}</summary>
      {open &&
        (q.error ? (
          <div className="tl-dbg__error" role="alert">
            <span>Could not load this event. {errorMessage(q.error)}</span>
            <Button variant="text" onClick={() => void q.refetch()}>
              Retry
            </Button>
          </div>
        ) : q.data ? (
          <DetailBody d={q.data} />
        ) : (
          <Skeleton height={120} />
        ))}
    </details>
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
    <details className="tl-debug">
      <summary>Debug info</summary>
      <div className="tl-debug__list">
        {entries.map(e => (
          <EventDebug key={e.id} id={e.id} title={e.title} />
        ))}
      </div>
    </details>
  );
}
