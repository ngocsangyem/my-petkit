import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('capture');
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
      toast(t('downloadFailed', { error: errorMessage(e) }), { error: true });
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
        toast(t('deleted', { name }));
      },
      onError: e => {
        toast(t('deleteFailed', { name, error: errorMessage(e) }), { error: true });
      },
      onSettled: () => {
        setConfirming(null);
      },
    });
  };

  const data = listing.data;
  const finding = data ? (
    t(data.enabled ? 'findingOn' : 'findingOff', {
      files: t('fileCount', { count: data.files.length }),
      size: formatBytes(totalBytes(data)),
    })
  ) : (
    <Skeleton width={420} height={14} />
  );

  return (
    <div className="flex w-full max-w-[980px] flex-col gap-5">
      <PageHeader title={t('title')} badge={<StepUpPill />} finding={finding} />
      <Card className="flex items-start gap-2.5 text-lede">
        <Icon name="warning" size={18} strokeWidth={2} className="mt-0.5 flex-none text-negative" />
        <p>{t('warning')}</p>
      </Card>

      {listing.isPending && <Skeleton height={240} />}
      {listing.isError && (
        <ErrorBlock
          message={t('listFailed', { error: errorMessage(listing.error) })}
          onRetry={() => void listing.refetch()}
          retrying={listing.isFetching}
        />
      )}
      {data && (
        <>
          <Card
            as="section"
            aria-label={t('record.title')}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
          >
            <div className="flex min-w-0 flex-[1_1_240px] flex-col">
              <span className="font-medium">{t('record.title')}</span>
              <span className="text-xs text-muted-foreground">
                {data.enabled ? t('record.on') : t('record.off')}
              </span>
            </div>
            <Link
              to="/setup"
              className={buttonClassName(data.enabled ? 'secondary' : 'primary', 'small')}
            >
              {data.enabled ? t('record.settings') : t('record.start')}
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
        title={t('confirm.title', { name: confirming ?? '' })}
        confirmLabel={t('confirm.delete')}
        busy={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => {
          setConfirming(null);
        }}
      >
        {confirmFile
          ? t('confirm.facts', { size: formatBytes(confirmFile.size), count: confirmFile.lines })
          : ''}
        {t('confirm.body')}
      </ConfirmDialog>
    </div>
  );
}
