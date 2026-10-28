import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Icon, Skeleton, Table, type TableColumn } from '@/shared/ui';
import { formatTime } from '@/shared/format/format';
import type { HubEvent } from '@/shared/ws/hub-event';
import { deviceText, detailText, entryText, eventKey, levelOf } from '../log-format';

// Within this many pixels of the end counts as "at the bottom": a user who has
// scrolled up to read something is not dragged back down by the next row.
const NEAR_BOTTOM_PX = 60;

export interface LiveLogTableProps {
  rows: readonly HubEvent[];
  autoscroll: boolean;
  loading: boolean;
  emptyText: string;
  onCopy: (text: string) => void;
}

function MessageCell({
  event,
  open,
  onToggle,
}: {
  event: HubEvent;
  open: boolean;
  onToggle: () => void;
}) {
  const detail = useMemo(() => detailText(event.detail), [event.detail]);
  if (!detail) return <span className="log-entry__summary">{event.summary}</span>;
  return (
    <>
      <button type="button" className="log-entry__toggle" aria-expanded={open} onClick={onToggle}>
        <Icon name="chevron" size={12} strokeWidth={2} className="log-entry__chev" />
        <span className="log-entry__summary">{event.summary}</span>
      </button>
      {open && <pre className="log-entry__detail">{detail}</pre>}
    </>
  );
}

/** The live rows: newest at the bottom, expandable, each one copyable whole. */
export function LiveLogTable({ rows, autoscroll, loading, emptyText, onCopy }: LiveLogTableProps) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && autoscroll && nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [rows, autoscroll]);

  const toggle = (key: string) => {
    setOpen(current => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  };

  const columns: TableColumn<HubEvent>[] = [
    { key: 'time', header: 'Time', width: '96px', nowrap: true, cell: e => formatTime(e.ts) },
    { key: 'kind', header: 'Kind', width: '72px', muted: true, cell: e => e.kind },
    { key: 'device', header: 'Device', width: '110px', nowrap: true, cell: deviceText },
    {
      key: 'message',
      header: 'Message',
      cell: e => (
        <MessageCell
          event={e}
          open={open.has(eventKey(e))}
          onToggle={() => {
            toggle(eventKey(e));
          }}
        />
      ),
    },
    {
      key: 'copy',
      header: 'Copy',
      hiddenHeader: true,
      alignEnd: true,
      width: '64px',
      cell: e =>
        e.detail === undefined || e.detail === null ? null : (
          <Button
            variant="text"
            size="small"
            aria-label={`Copy the ${e.kind} entry at ${formatTime(e.ts)}`}
            onClick={() => {
              onCopy(entryText(e));
            }}
          >
            Copy
          </Button>
        ),
    },
  ];

  if (loading && rows.length === 0) {
    return (
      <div className="log-scroll log-scroll--loading" aria-busy="true" aria-label="Loading the log">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={14} />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={scroller}
      className="log-scroll"
      onScroll={e => {
        const el = e.currentTarget;
        nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
      }}
    >
      <Table
        variant="log"
        role="log"
        label="Live log"
        columns={columns}
        rows={rows}
        rowKey={eventKey}
        levelOf={levelOf}
        minWidth={760}
        emptyText={emptyText}
      />
    </div>
  );
}
