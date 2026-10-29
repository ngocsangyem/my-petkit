import { useState } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '@/shared/api/errors';
import { formatBytes } from '@/shared/format/format';
import {
  buttonClassName,
  ConfirmDialog,
  ErrorBlock,
  PageHeading,
  RiskNotice,
  Skeleton,
  StepUpPill,
} from '@/shared/ui';
import { fetchCaptureFile, useCaptureListing, useDeleteCapture } from './api';
import { CaptureFiles, totalBytes } from './components/capture-files';
import { CaptureTail } from './components/capture-tail';
import { useNotice } from '@/shared/feedback/use-notice';
import { saveBlob } from '@/shared/feedback/save-file';
import './capture.css';

export function CapturePage() {
  const listing = useCaptureListing();
  const remove = useDeleteCapture();
  const [notice, showNotice] = useNotice();
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
      showNotice(`Download failed: ${errorMessage(e)}`);
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
        showNotice(`Deleted ${name}`);
      },
      onError: e => {
        showNotice(`Could not delete ${name}: ${errorMessage(e)}`);
      },
      onSettled: () => {
        setConfirming(null);
      },
    });
  };

  const data = listing.data;
  const finding = data ? (
    `Raw traffic between devices and this server · ${data.enabled ? 'recording' : 'not recording'} · ` +
    `${data.files.length} ${data.files.length === 1 ? 'file' : 'files'}, ${formatBytes(totalBytes(data))}`
  ) : (
    <Skeleton width={420} height={14} />
  );

  return (
    <>
      <PageHeading
        title="Capture"
        badge={<StepUpPill />}
        finding={finding}
        actions={
          data && (
            <Link to="/setup" className={buttonClassName(data.enabled ? 'secondary' : 'primary')}>
              {data.enabled ? 'Recording settings' : 'Start recording'}
            </Link>
          )
        }
      />
      <span className="capture-notice" role="status">
        {notice}
      </span>
      <RiskNotice>
        Every capture is sensitive. It is an exact recording of what your devices said and were
        told, with nothing filtered: expect the Wi-Fi name, LAN addresses, the device serial and its
        signing secret, and in proxy mode the exchanges with PetKit including your account
        credentials. Read one before you send it anywhere. A deleted file cannot be restored.
      </RiskNotice>

      {listing.isPending && (
        <div className="capture-grid">
          <Skeleton height={240} />
          <Skeleton height={420} />
        </div>
      )}
      {listing.isError && (
        <ErrorBlock
          message={`Could not list the capture files: ${errorMessage(listing.error)}`}
          onRetry={() => void listing.refetch()}
          retrying={listing.isFetching}
        />
      )}
      {data && (
        <div className="capture-grid">
          <CaptureFiles listing={data} selected={current} onSelect={setSelected} />
          <CaptureTail
            name={current}
            downloading={downloading === current}
            deleting={remove.isPending}
            onDownload={name => void download(name)}
            onDelete={setConfirming}
          />
        </div>
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
    </>
  );
}
