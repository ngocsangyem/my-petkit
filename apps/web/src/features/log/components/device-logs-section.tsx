import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { components } from '@/api/schema';
import { errorMessage } from '@/shared/api/errors';
import { formatBytes, formatDateTime } from '@/shared/format/format';
import {
  Button,
  EmptyBlock,
  ErrorBlock,
  SearchField,
  Skeleton,
  Table,
  useToast,
  ValueText,
} from '@/shared/ui';
import { useHubEvents } from '@/shared/ws/use-event-stream';
import { fetchDeviceLogFile, logKeys, useDeviceLogList } from '../api';
import { saveBlob } from '@/shared/feedback/save-file';
import { DeviceLogViewer } from './device-log-viewer';

type DeviceLogFile = components['schemas']['DeviceLogFile'];
type DeviceLogListing = components['schemas']['DeviceLogListing'];

// Grep runs on the server: a devRun.log runs to thousands of lines, so a fast
// typist should queue one request, not ten.
const GREP_DEBOUNCE_MS = 200;

const REASONS: Record<string, string> = {
  no_log_root: 'no log directory is configured',
  no_bucket_endpoint: 'this app has no bucket address, so there is nowhere to send the device',
  authority_not_splittable:
    'the bucket address cannot be split into a host the device can build — it needs a dotted name or IP',
};

/** Why there is nothing to show, in one sentence. */
export function emptyReason(listing: DeviceLogListing): string {
  if (listing.reason) return `Cannot collect: ${REASONS[listing.reason] ?? listing.reason}.`;
  return listing.enabled_devices.length
    ? 'Collection is on. The device uploads on its own schedule; a reboot is the usual trigger.'
    : 'No device has debug log collection turned on.';
}

export function DeviceLogsSection() {
  const toast = useToast();
  const list = useDeviceLogList();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string | null>(null);
  const [grep, setGrep] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(grep);
      setOffset(0);
    }, GREP_DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
    };
  }, [grep]);

  // A device uploading a log is announced on the stream: list it straight away.
  useHubEvents(event => {
    if (event.kind === 'devlog')
      void queryClient.invalidateQueries({ queryKey: logKeys.deviceLogs });
  });

  const files = list.data?.files ?? [];
  // The picked file, or the newest one when nothing (or a vanished file) is picked.
  const selected = files.some(f => f.rel === picked) ? picked : (files.at(0)?.rel ?? null);

  const download = async (file: DeviceLogFile) => {
    setDownloading(file.rel);
    try {
      saveBlob(await fetchDeviceLogFile(file.rel), file.name);
    } catch (e) {
      toast(`Download failed: ${errorMessage(e)}`, { error: true });
    } finally {
      setDownloading(null);
    }
  };

  let body;
  if (list.isPending) {
    body = <Skeleton height={112} />;
  } else if (list.isError) {
    body = (
      <ErrorBlock
        message={`Could not list the device logs: ${errorMessage(list.error)}`}
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
      />
    );
  } else if (!files.length) {
    body = <EmptyBlock>{emptyReason(list.data)}</EmptyBlock>;
  } else {
    body = (
      <>
        <Table
          label="Device logs"
          variant="compact"
          minWidth={560}
          rows={files}
          rowKey={f => f.rel}
          selectedKey={selected}
          columns={[
            {
              key: 'uploaded',
              header: 'Uploaded',
              nowrap: true,
              cell: f => (
                <button
                  type="button"
                  className="text-left hover:text-data aria-pressed:font-medium"
                  aria-pressed={f.rel === selected}
                  onClick={() => {
                    setPicked(f.rel);
                    setOffset(0);
                  }}
                >
                  {formatDateTime(f.mtime)}
                </button>
              ),
            },
            {
              key: 'device',
              header: 'Device',
              mono: true,
              cell: f => <ValueText value={f.device} />,
            },
            { key: 'file', header: 'File', mono: true, cell: f => f.name },
            { key: 'size', header: 'Size', numeric: true, cell: f => formatBytes(f.size) },
            {
              key: 'download',
              header: 'Download',
              hiddenHeader: true,
              alignEnd: true,
              cell: f => (
                <Button
                  variant="text"
                  size="small"
                  disabled={downloading === f.rel}
                  aria-label={`Download ${f.name}`}
                  onClick={() => void download(f)}
                >
                  Download
                </Button>
              ),
            },
          ]}
        />
        {selected && (
          <DeviceLogViewer rel={selected} query={query} offset={offset} onOffset={setOffset} />
        )}
      </>
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="devlog-title">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 id="devlog-title">Device logs</h2>
        <SearchField
          className="w-[220px]"
          aria-label="Search the device log"
          placeholder="grep pattern"
          mono
          autoComplete="off"
          spellCheck={false}
          value={grep}
          onValueChange={setGrep}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        The device’s own devRun.log, uploaded here instead of to PetKit. Off until you turn on
        Collect debug logs on a device, and the device decides when to send one.
      </p>
      {body}
    </section>
  );
}
