import { useState } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '@/shared/api/errors';
import { formatBytes } from '@/shared/format/format';
import {
  buttonClassName,
  Card,
  ConfirmDialog,
  ErrorBlock,
  Icon,
  PageHeader,
  Skeleton,
  StepUpPill,
  useToast,
} from '@/shared/ui';
import { fetchCaptureFile, useCaptureListing, useDeleteCapture } from './api';
import { CaptureFiles, totalBytes } from './components/capture-files';
import { CaptureTail } from './components/capture-tail';
import { saveBlob } from '@/shared/feedback/save-file';

export function CapturePage() {
  const listing = useCaptureListing();
  const remove = useDeleteCapture();
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const files = listing.data?.files ?? [];
  // A file that vanished (deleted here or elsewhere) is no longer selected.
  const current = selected !== null && files.some(f => f.name === selected) ? selected : null;
  const confirmFile = files.find(f => f.name === confirming);

  const download = async (name: string) => {
    setDownloading(name);
    try {
      saveBlob(await fetchCaptureFile(name), name);
    } catch (e) {
      toast(`Download failed: ${errorMessage(e)}`, { error: true });
    } finally {
      setDownloading(null);
    }
  };

  const confirmDelete = () => {
    if (confirming === null) return;
    const name = confirming;
    remove.mutate(name, {
      onSuccess: () => {
        if (selected === name) setSelected(null);
        toast(`Deleted ${name}`);
      },
      onError: e => {
        toast(`Could not delete ${name}: ${errorMessage(e)}`, { error: true });
      },
      onSettled: () => {
        setConfirming(null);
      },
    });
  };

  const data = listing.data;
  const finding = data ? (
    `Recording is ${data.enabled ? 'on' : 'off'}. ` +
    `${data.files.length} ${data.files.length === 1 ? 'file' : 'files'} on the server, ${formatBytes(totalBytes(data))}.`
  ) : (
    <Skeleton width={420} height={14} />
  );

  return (
    <div className="flex w-full max-w-[980px] flex-col gap-5">
      <PageHeader title="Capture" badge={<StepUpPill />} finding={finding} />
      <Card className="flex items-start gap-2.5 text-lede">
        <Icon name="warning" size={18} strokeWidth={2} className="mt-0.5 flex-none text-negative" />
        <p>
          Every capture is sensitive. It is an exact recording of what your devices said and were
          told, with nothing filtered: expect the Wi-Fi name, LAN addresses, the device serial and
          its signing secret, and in proxy mode the exchanges with PetKit including your account
          credentials. Read one before you send it anywhere. A deleted file cannot be restored.
        </p>
      </Card>

      {listing.isPending && <Skeleton height={240} />}
      {listing.isError && (
        <ErrorBlock
          message={`Could not list the capture files: ${errorMessage(listing.error)}`}
          onRetry={() => void listing.refetch()}
          retrying={listing.isFetching}
        />
      )}
      {data && (
        <>
          <Card
            as="section"
            aria-label="Record traffic"
            className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
          >
            <div className="flex min-w-0 flex-[1_1_240px] flex-col">
              <span className="font-medium">Record traffic</span>
              <span className="text-xs text-muted-foreground">
                {data.enabled
                  ? 'On. Every device request and broker frame is written as it happens.'
                  : 'Off. It is a setting under Settings, and turning it on asks for your password.'}
              </span>
            </div>
            <Link
              to="/setup"
              className={buttonClassName(data.enabled ? 'secondary' : 'primary', 'small')}
            >
              {data.enabled ? 'Recording settings' : 'Start recording'}
            </Link>
          </Card>
          <CaptureFiles listing={data} selected={current} onSelect={setSelected} />
          <CaptureTail
            name={current}
            downloading={downloading === current}
            deleting={remove.isPending}
            onDownload={name => void download(name)}
            onDelete={setConfirming}
          />
        </>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title={`Delete ${confirming ?? ''}?`}
        confirmLabel="Delete"
        busy={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => {
          setConfirming(null);
        }}
      >
        {confirmFile ? `${formatBytes(confirmFile.size)}, ${confirmFile.lines} lines. ` : ''}
        This cannot be undone: a capture is usually the only record of what it was recorded to
        investigate.
      </ConfirmDialog>
    </div>
  );
}
