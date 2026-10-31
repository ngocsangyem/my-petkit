import { useTranslation } from 'react-i18next';
import { Card, DrumMark, FigureContainer, Panel, StatusWord } from '@/shared/ui';
import { BLOCKED_LIMIT } from '../retention-and-blocked-model';
import type { ServerInfo } from '../setup-model';

interface ServerSummaryCardProps {
  info: ServerInfo;
  /** Blocked attempts on record, once known. */
  blocked: number | undefined;
}

/**
 * The server at a glance: the mark, that it answers and over what, its version and mode, then the
 * devices it knows and the blocked attempts on record.
 */
export function ServerSummaryCard({ info, blocked }: ServerSummaryCardProps) {
  const { t } = useTranslation('setup');
  const tls = window.location.protocol === 'https:';
  const mode = [
    info.settings.proxy_mode ? t('summary.proxyMode') : t('summary.localMode'),
    ...(info.settings_writable ? [] : [t('summary.settingsReadOnly')]),
  ].join(' · ');
  return (
    <Card
      as="section"
      aria-label={t('summary.label')}
      className="flex flex-wrap items-center gap-4"
    >
      <Panel padding="none" className="flex-none p-3.5">
        <DrumMark size={56} />
      </Panel>
      <div className="flex min-w-0 flex-[1_1_140px] flex-col gap-0.5">
        <h2>{t('summary.title')}</h2>
        <span className="text-sm">
          <StatusWord tone="positive" dot>
            {tls ? t('summary.runningTls') : t('summary.running')}
          </StatusWord>
        </span>
        <span className="text-xs text-muted-foreground">
          MyPetKit <span className="font-mono wrap-anywhere">{info.version}</span> · {mode}
        </span>
      </div>
      <div className="min-w-[190px] flex-[1_1_200px]">
        <FigureContainer
          label={t('summary.figures')}
          cells={[
            { label: t('summary.devices'), value: info.device_count },
            {
              label: t('summary.blocked'),
              value:
                blocked !== undefined && blocked >= BLOCKED_LIMIT ? `${BLOCKED_LIMIT}+` : blocked,
            },
          ]}
        />
      </div>
    </Card>
  );
}
