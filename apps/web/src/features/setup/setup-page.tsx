import { useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '@/shared/api/errors';
import { useHubEvents } from '@/shared/ws/use-event-stream';
import { ErrorBlock, PageHeading, Pill, Skeleton } from '@/shared/ui';
import { setupKeys, useBlocked, useSetupInfo } from './api';
import { BlockedSection } from './components/blocked-section';
import { ConnectionFacts } from './components/connection-facts';
import { RetentionSection } from './components/retention-section';
import { SettingsForm } from './components/settings-form';
import { BLOCKED_LIMIT } from './retention-and-blocked-model';
import { BLOCKING_GUARDS, type ServerInfo } from './setup-model';
import './setup.css';

/** "Cloud guards are on. Proxying to PetKit's cloud is off." from the saved settings. */
function Finding({ info, blocked }: { info: ServerInfo; blocked: number | undefined }) {
  const off = BLOCKING_GUARDS.filter(k => !info.settings[k]).length;
  return (
    <>
      {off === 0
        ? 'Cloud guards are on. '
        : `${off} of ${BLOCKING_GUARDS.length} cloud guards are off. `}
      <span className="setup-strong">
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

/** Live settings and guards, the upstream, connection facts, retention and blocked attempts. */
export function SetupPage() {
  const info = useSetupInfo();
  // The same cache entry the blocked table reads: no second request.
  const blocked = useBlocked(false);
  const client = useQueryClient();

  // A new blocked attempt lands as a `blocked` hub event; the table follows it.
  useHubEvents(event => {
    if (event.kind === 'blocked') void client.invalidateQueries({ queryKey: setupKeys.blockedAll });
  });

  if (info.isPending) {
    return (
      <>
        <PageHeading title="Setup" finding={<Skeleton width={420} height={20} />} />
        <Skeleton height={320} />
      </>
    );
  }
  if (info.isError) {
    return (
      <>
        <PageHeading title="Setup" />
        <ErrorBlock
          message={`The server's settings could not be loaded. ${errorMessage(info.error)}`}
          onRetry={() => void info.refetch()}
          retrying={info.isFetching}
        />
      </>
    );
  }

  const data = info.data;
  return (
    <>
      <PageHeading
        title="Setup"
        badge={data.settings_writable ? undefined : <Pill tone="warning">Read-only</Pill>}
        aside={
          <>
            version <span className="setup-mono">{data.version}</span>
          </>
        }
        finding={<Finding info={data} blocked={blocked.data?.records.length} />}
      />
      <SettingsForm info={data} />
      <ConnectionFacts info={data} />
      <RetentionSection />
      <BlockedSection />
    </>
  );
}
