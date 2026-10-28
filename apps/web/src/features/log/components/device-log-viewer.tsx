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
      <div className="devlog-view" aria-busy="true" aria-label="Loading the device log">
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
    <div className="devlog">
      <div className="devlog__bar">
        <span className="devlog__count" role="status">
          {count}
          {paged && ` · showing ${first}–${last}`}
        </span>
        {paged && (
          <span className="devlog__pager">
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
        <div className="devlog-view" aria-label={`Lines of ${rel}`}>
          {lines.map(([n, text]) => (
            <div className="devlog-view__line" key={n}>
              <span className="devlog-view__n">{n}</span>
              <span className="devlog-view__text">
                <HighlightText text={text} query={query} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
