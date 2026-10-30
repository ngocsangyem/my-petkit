import { Button, EmptyBlock, ErrorBlock, Skeleton } from '@/shared/ui';
import { errorMessage } from '@/shared/api/errors';
import { DEVICE_LOG_PAGE, useDeviceLogWindow } from '../api';
import { HighlightText } from './highlight-text';

export interface DeviceLogViewerProps {
  rel: string;
  /** The debounced grep query. */
  query: string;
  offset: number;
  onOffset: (offset: number) => void;
}

/** One window of the selected device log, with the file's own line numbers. */
export function DeviceLogViewer({ rel, query, offset, onOffset }: DeviceLogViewerProps) {
  const win = useDeviceLogWindow(rel, query, offset);

  if (win.isPending) {
    return (
      <div
        className="flex max-h-[480px] flex-col gap-2.5 overflow-auto rounded-md bg-raised p-3"
        aria-busy="true"
        aria-label="Loading the device log"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} height={14} />
        ))}
      </div>
    );
  }
  if (win.isError) {
    return (
      <ErrorBlock
        message={`Could not read this log: ${errorMessage(win.error)}`}
        onRetry={() => void win.refetch()}
        retrying={win.isFetching}
      />
    );
  }

  const { lines, matched, total } = win.data;
  const first = lines.length ? offset + 1 : 0;
  const last = offset + lines.length;
  const count = query ? `${matched} of ${total} lines` : `${total} lines`;
  const paged = matched > DEVICE_LOG_PAGE;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span role="status">
          {count}
          {paged && ` · showing ${first}–${last}`}
        </span>
        {paged && (
          <span className="flex gap-2">
            <Button
              size="small"
              disabled={offset === 0 || win.isFetching}
              onClick={() => {
                onOffset(Math.max(0, offset - DEVICE_LOG_PAGE));
              }}
            >
              Previous
            </Button>
            <Button
              size="small"
              disabled={last >= matched || win.isFetching}
              onClick={() => {
                onOffset(offset + DEVICE_LOG_PAGE);
              }}
            >
              Next
            </Button>
          </span>
        )}
      </div>
      {lines.length === 0 ? (
        <EmptyBlock>{query ? 'No line matches.' : 'This log is empty.'}</EmptyBlock>
      ) : (
        <div
          className="flex max-h-[480px] flex-col overflow-auto rounded-md bg-raised py-2.5 font-mono text-xs leading-[1.45]"
          aria-label={`Lines of ${rel}`}
        >
          {lines.map(([n, text]) => (
            <div className="flex gap-3 px-3 py-px" key={n}>
              <span className="min-w-[5ch] flex-none text-right text-muted-foreground select-none">
                {n}
              </span>
              <span className="whitespace-pre-wrap wrap-anywhere">
                <HighlightText text={text} query={query} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
