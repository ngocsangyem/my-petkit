import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
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

const TITLE = 'Settings';
const COLUMNS = 'grid grid-cols-1 items-start gap-5 min-[901px]:grid-cols-2';
const COLUMN = 'flex min-w-0 flex-col gap-5';

/** "Cloud guards are on. Proxying to PetKit's cloud is off." from the saved settings. */
function Finding({ info, blocked }: { info: ServerInfo; blocked: number | undefined }) {
  const off = BLOCKING_GUARDS.filter(k => !info.settings[k]).length;
  return (
    <>
      {off === 0
        ? 'Cloud guards are on. '
        : `${off} of ${BLOCKING_GUARDS.length} cloud guards are off. `}
      <span className="font-medium">
        Proxying to PetKit’s cloud is {info.settings.proxy_mode ? 'on' : 'off'}
      </span>
      {'. '}
      {blocked !== undefined &&
        blocked > 0 &&
        `${blocked >= BLOCKED_LIMIT ? `${BLOCKED_LIMIT} or more` : blocked} blocked ${blocked === 1 ? 'attempt is' : 'attempts are'} on record. `}
      {info.settings.capture && 'Traffic is being saved to disk.'}
      {!info.settings_writable && ' Settings are read-only in this mode.'}
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
  // The same cache entry the blocked table reads: no second request.
  const blocked = useBlocked(false).data?.records.length;
  const form = useSettingsDraft(info);
  return (
    <>
      <PageHeader
        title={TITLE}
        badge={info.settings_writable ? undefined : <Pill tone="warning">Read-only</Pill>}
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
        title={TITLE}
        finding={info.isPending ? <Skeleton width={420} height={20} /> : undefined}
      />
      <div className={COLUMNS}>
        <div className={COLUMN}>
          {info.isPending ? (
            <Skeleton height={320} />
          ) : (
            <ErrorBlock
              message={`The server's settings could not be loaded. ${errorMessage(info.error)}`}
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
