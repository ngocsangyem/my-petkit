import { errorMessage } from '@/shared/api/errors';
import { copyText } from '@/shared/format/copy-text';
import { Button, Card, ErrorBlock, PageHeader, useToast } from '@/shared/ui';
import { LOG_CAP } from './api';
import { DeviceLogsSection } from './components/device-logs-section';
import { LiveLogTable } from './components/live-log-table';
import { LiveLogToolbar } from './components/live-log-toolbar';
import { useLiveLog } from './hooks/use-live-log';
import { useLiveLogFilters } from './hooks/use-live-log-filters';
import { entriesText } from './log-format';
import { fileStamp, saveBlob } from '@/shared/feedback/save-file';

/** The count beside the cap: the view silently drops its oldest row past it, so it says so. */
function countText(total: number): string {
  if (!total) return 'No events yet.';
  return total >= LOG_CAP ? `Last ${LOG_CAP} events.` : `${total} events.`;
}

export function LogPage() {
  const live = useLiveLog();
  const filters = useLiveLogFilters(live.rows);
  const toast = useToast();
  const { visible } = filters;

  const copy = async (text: string) => {
    if (await copyText(text)) toast('Copied');
    else toast('Copy failed', { error: true });
  };

  // Saves what is on screen, in the shape the expanded rows show: the point is
  // attaching it to a bug report, so it honours every filter the user set.
  const download = () => {
    if (!visible.length) {
      toast('Nothing to download yet');
      return;
    }
    saveBlob(
      new Blob([entriesText(visible)], { type: 'text/plain' }),
      `my-petkit-traffic-${fileStamp()}.log`,
    );
    toast(`Saved ${visible.length} rows`);
  };

  const hidden = filters.hideHeartbeats ? filters.heartbeats : 0;
  return (
    <>
      <PageHeader
        title="Logs"
        finding="What the server and your devices are saying, as it happens."
        actions={
          <>
            <Button disabled={!visible.length} onClick={() => void copy(entriesText(visible))}>
              Copy
            </Button>
            <Button onClick={download}>Download</Button>
            <Button variant="destructive" disabled={!live.rows.length} onClick={live.clear}>
              Clear
            </Button>
          </>
        }
      />

      <Card as="section" className="flex flex-col gap-3.5" aria-label="Live log">
        <LiveLogToolbar filters={filters} />
        {live.error && (
          <ErrorBlock
            message={`Could not load earlier events: ${errorMessage(live.error)}`}
            onRetry={live.retry}
          />
        )}
        <LiveLogTable
          rows={visible}
          autoscroll={filters.autoscroll}
          loading={live.loading}
          emptyText={
            live.rows.length ? 'No event matches these filters.' : 'Nothing has been heard yet.'
          }
          onCopy={text => void copy(text)}
        />
        <p className="text-xs text-muted-foreground">
          {countText(live.rows.length)}
          {hidden > 0 && ` Hiding ${hidden} heartbeats.`} Shows the last {LOG_CAP} events; older
          ones are dropped from this view.
        </p>
      </Card>

      <DeviceLogsSection />
    </>
  );
}
