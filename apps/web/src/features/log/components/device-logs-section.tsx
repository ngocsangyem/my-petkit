import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@/api/schema';
import { i18n } from '@/i18n';
import { errorMessage } from '@/shared/api/errors';
import { formatBytes, formatDateTime } from '@/shared/format/format';
import {
  Button,
  Card,
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

/** Reasons the server gives as codes; an unknown code is shown as it came. */
const REASONS = ['no_log_root', 'no_bucket_endpoint', 'authority_not_splittable'] as const;
type Reason = (typeof REASONS)[number];

function isKnownReason(code: string): code is Reason {
  return (REASONS as readonly string[]).includes(code);
}

/** Why there is nothing to show, in one sentence. */
export function emptyReason(listing: DeviceLogListing): string {
  if (listing.reason) {
    const code = listing.reason;
    const reason = isKnownReason(code) ? i18n.t(`log:device.reason.${code}`) : code;
    return i18n.t('log:device.cannotCollect', { reason });
  }
  return listing.enabled_devices.length
    ? i18n.t('log:device.collecting')
    : i18n.t('log:device.notCollecting');
}

export function DeviceLogsSection() {
  const { t } = useTranslation('log');
  const toast = useToast();
  const list = useDeviceLogList();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string | null>(null);
  const [grep, setGrep] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(grep);
      setOffset(0);
    }, GREP_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
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
      toast(t('device.downloadFailed', { error: errorMessage(e) }), { error: true });
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
        message={t('device.listFailed', { error: errorMessage(list.error) })}
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
          label={t('device.title')}
          variant="compact"
          minWidth={560}
          rows={files}
          rowKey={f => f.rel}
          selectedKey={selected}
          columns={[
            {
              key: 'uploaded',
              header: t('device.uploaded'),
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
              header: t('device.device'),
              mono: true,
              cell: f => <ValueText value={f.device} />,
            },
            { key: 'file', header: t('device.file'), mono: true, cell: f => f.name },
            {
              key: 'size',
              header: t('device.size'),
              numeric: true,
              cell: f => formatBytes(f.size),
            },
            {
              key: 'download',
              header: t('device.download'),
              hiddenHeader: true,
              alignEnd: true,
              cell: f => (
                <Button
                  variant="text"
                  size="small"
                  disabled={downloading === f.rel}
                  aria-label={t('device.downloadFile', { name: f.name })}
                  onClick={() => void download(f)}
                >
                  {t('device.download')}
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
    <Card as="section" className="flex flex-col gap-3" aria-labelledby="devlog-title">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 id="devlog-title">{t('device.title')}</h2>
        <SearchField
          className="w-[240px] max-[900px]:w-full"
          aria-label={t('device.search')}
          placeholder={t('device.searchPlaceholder')}
          mono
          autoComplete="off"
          spellCheck={false}
          value={grep}
          onValueChange={setGrep}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('device.intro')}</p>
      {body}
    </Card>
  );
}
