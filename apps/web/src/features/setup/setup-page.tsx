import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { errorMessage } from '@/shared/api/errors';
import { useHubEvents } from '@/shared/ws/use-event-stream';
import { ErrorBlock, PageHeader, Pill, Skeleton } from '@/shared/ui';
import { setupKeys, useBlocked, useSetupInfo } from './api';
import { BlockedSection } from './components/blocked-section';
import { ConnectionFacts } from './components/connection-facts';
import { RetentionSection } from './components/retention-section';
import { ServerSummaryCard } from './components/server-summary-card';
import { CloudGuardsCard, ProxyModeCard } from './components/settings-form';
import { GuardOffDialog, SettingsSaveActions } from './components/settings-save-actions';
import { BLOCKED_LIMIT } from './retention-and-blocked-model';
import { BLOCKING_GUARDS, type ServerInfo } from './setup-model';
import { useSettingsDraft } from './use-settings-draft';

const COLUMNS = 'grid grid-cols-1 items-start gap-5 min-[901px]:grid-cols-2';
const COLUMN = 'flex min-w-0 flex-col gap-5';

/** "Cloud guards are on. Proxying to PetKit's cloud is off." from the saved settings. */
function Finding({ info, blocked }: { info: ServerInfo; blocked: number | undefined }) {
  const { t } = useTranslation('setup');
  const off = BLOCKING_GUARDS.filter(k => !info.settings[k]).length;
  const many = blocked !== undefined && blocked >= BLOCKED_LIMIT;
  return (
    <>
      {off === 0
        ? t('finding.guardsOn')
        : t('finding.guardsOff', { off, total: BLOCKING_GUARDS.length })}{' '}
      <Trans
        t={t}
        i18nKey={info.settings.proxy_mode ? 'finding.proxyOn' : 'finding.proxyOff'}
        components={{ b: <span className="font-medium" /> }}
      />{' '}
      {blocked !== undefined &&
        blocked > 0 &&
        `${many ? t('finding.blockedMany', { count: BLOCKED_LIMIT }) : t('finding.blocked', { count: blocked })} `}
      {info.settings.capture && `${t('finding.capture')} `}
      {!info.settings_writable && t('finding.readOnly')}
    </>
  );
}

/** The parts of Settings that other features own, placed in this screen's right column. */
export interface SetupPageSlots {
  /** Phones and apps: the paired clients and "Pair a phone". */
  phones?: ReactNode;
  /** This browser's light or dark appearance. */
  appearance?: ReactNode;
  /** Who is signed in, and Sign out. */
  account?: ReactNode;
}

/** The server card, its settings and guards, and what this server keeps. */
function ServerColumns({ info, slots }: { info: ServerInfo; slots: SetupPageSlots }) {
  const { t } = useTranslation('setup');
  // The same cache entry the blocked table reads: no second request.
  const blocked = useBlocked(false).data?.records.length;
  const form = useSettingsDraft(info);
  return (
    <>
      <PageHeader
        title={t('title')}
        badge={info.settings_writable ? undefined : <Pill tone="warning">{t('readOnly')}</Pill>}
        finding={<Finding info={info} blocked={blocked} />}
        actions={<SettingsSaveActions form={form} />}
      />
      <div className={COLUMNS}>
        <div className={COLUMN}>
          <ServerSummaryCard info={info} blocked={blocked} />
          <CloudGuardsCard form={form} />
          <ProxyModeCard form={form} info={info} />
          <RetentionSection />
          <BlockedSection />
        </div>
        <div className={COLUMN}>
          {slots.phones}
          {slots.appearance}
          <ConnectionFacts info={info} />
          {slots.account}
        </div>
      </div>
      <GuardOffDialog form={form} />
    </>
  );
}

/**
 * Settings: this server, what PetKit's cloud may do through it, what it keeps, the phones that
 * may reach it, this browser's appearance and the account. While the server's facts load or fail,
 * the right column still renders, so pairing and Sign out stay within reach.
 */
export function SetupPage(slots: SetupPageSlots) {
  const { t } = useTranslation('setup');
  const info = useSetupInfo();
  const client = useQueryClient();

  // A new blocked attempt lands as a `blocked` hub event; the table follows it.
  useHubEvents(event => {
    if (event.kind === 'blocked') void client.invalidateQueries({ queryKey: setupKeys.blockedAll });
  });

  // Kept on a failed background poll, so a blip does not drop unsaved edits.
  if (info.data !== undefined) return <ServerColumns info={info.data} slots={slots} />;
  return (
    <>
      <PageHeader
        title={t('title')}
        finding={info.isPending ? <Skeleton width={420} height={20} /> : undefined}
      />
      <div className={COLUMNS}>
        <div className={COLUMN}>
          {info.isPending ? (
            <Skeleton height={320} />
          ) : (
            <ErrorBlock
              message={t('loadFailed', { error: errorMessage(info.error) })}
              onRetry={() => void info.refetch()}
              retrying={info.isFetching}
            />
          )}
        </div>
        <div className={COLUMN}>
          {slots.phones}
          {slots.appearance}
          {slots.account}
        </div>
      </div>
    </>
  );
}
