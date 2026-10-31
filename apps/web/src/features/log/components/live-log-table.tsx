import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, LogLevelText, Skeleton, Table, type TableColumn } from '@/shared/ui';
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
  if (!detail) return <span className="wrap-anywhere">{event.summary}</span>;
  return (
    <>
      <button
        type="button"
        className="group flex w-full items-baseline gap-1.5 text-left"
        aria-expanded={open}
        onClick={onToggle}
      >
        <Icon
          name="chevron"
          size={12}
          strokeWidth={2}
          className="flex-none -rotate-90 text-muted-foreground group-aria-expanded:rotate-0"
        />
        <span className="wrap-anywhere">{event.summary}</span>
      </button>
      {open && (
        <pre className="mt-1.5 mb-1 rounded-md bg-raised px-3 py-2.5 font-mono text-xs whitespace-pre-wrap wrap-anywhere">
          {detail}
        </pre>
      )}
    </>
  );
}

/** The live rows: newest at the bottom, expandable, each one copyable whole. */
export function LiveLogTable({ rows, autoscroll, loading, emptyText, onCopy }: LiveLogTableProps) {
  const { t } = useTranslation('log');
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
    {
      key: 'time',
      header: t('live.time'),
      width: '96px',
      nowrap: true,
      muted: true,
      cell: e => formatTime(e.ts),
    },
    {
      key: 'kind',
      header: t('live.kind'),
      width: '72px',
      cell: e => <LogLevelText level={levelOf(e)}>{e.kind}</LogLevelText>,
    },
    {
      key: 'device',
      header: t('live.device'),
      width: '110px',
      nowrap: true,
      muted: true,
      cell: deviceText,
    },
    {
      key: 'message',
      header: t('live.message'),
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
      header: t('copy'),
      hiddenHeader: true,
      alignEnd: true,
      width: '64px',
      cell: e =>
        e.detail === undefined || e.detail === null ? null : (
          <Button
            variant="text"
            size="small"
            aria-label={t('live.copyEntry', { kind: e.kind, time: formatTime(e.ts) })}
            onClick={() => {
              onCopy(entryText(e));
            }}
          >
            {t('copy')}
          </Button>
        ),
    },
  ];

  if (loading && rows.length === 0) {
    return (
      <div
        className="flex max-h-[480px] flex-col gap-4 overflow-y-auto py-3"
        aria-busy="true"
        aria-label={t('live.loading')}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={14} />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={scroller}
      // Inside the card the log needs no frame of its own: the card is its edge.
      className="max-h-[480px] overflow-y-auto [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-1 [&_thead_th]:bg-card [&>[data-variant=log]]:rounded-none [&>[data-variant=log]]:border-0"
      onScroll={e => {
        const el = e.currentTarget;
        nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
      }}
    >
      <Table
        variant="log"
        role="log"
        label={t('live.label')}
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
