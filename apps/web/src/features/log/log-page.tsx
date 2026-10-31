import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n';
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
  if (!total) return i18n.t('log:live.noEvents');
  return total >= LOG_CAP
    ? i18n.t('log:live.lastEvents', { cap: LOG_CAP })
    : i18n.t('log:live.events', { count: total });
}

export function LogPage() {
  const { t } = useTranslation('log');
  const live = useLiveLog();
  const filters = useLiveLogFilters(live.rows);
  const toast = useToast();
  const { visible } = filters;

  const copy = async (text: string) => {
    if (await copyText(text)) toast(t('copied'));
    else toast(t('copyFailed'), { error: true });
  };

  // Saves what is on screen, in the shape the expanded rows show: the point is
  // attaching it to a bug report, so it honours every filter the user set.
  const download = () => {
    if (!visible.length) {
      toast(t('nothingToDownload'));
      return;
    }
    saveBlob(
      new Blob([entriesText(visible)], { type: 'text/plain' }),
      `my-petkit-traffic-${fileStamp()}.log`,
    );
    toast(t('saved', { count: visible.length }));
  };

  const hidden = filters.hideHeartbeats ? filters.heartbeats : 0;
  return (
    <>
      <PageHeader
        title={t('title')}
        finding={t('finding')}
        actions={
          <>
            <Button disabled={!visible.length} onClick={() => void copy(entriesText(visible))}>
              {t('copy')}
            </Button>
            <Button onClick={download}>{t('download')}</Button>
            <Button variant="destructive" disabled={!live.rows.length} onClick={live.clear}>
              {t('clear')}
            </Button>
          </>
        }
      />

      <Card as="section" className="flex flex-col gap-3.5" aria-label={t('live.label')}>
        <LiveLogToolbar filters={filters} />
        {live.error && (
          <ErrorBlock
            message={t('live.earlierFailed', { error: errorMessage(live.error) })}
            onRetry={live.retry}
          />
        )}
        <LiveLogTable
          rows={visible}
          autoscroll={filters.autoscroll}
          loading={live.loading}
          emptyText={live.rows.length ? t('live.noMatch') : t('live.nothingHeard')}
          onCopy={text => void copy(text)}
        />
        <p className="text-xs text-muted-foreground">
          {countText(live.rows.length)}
          {hidden > 0 && ` ${t('live.hiding', { count: hidden })}`}{' '}
          {t('live.cap', { cap: LOG_CAP })}
        </p>
      </Card>

      <DeviceLogsSection />
    </>
  );
}
