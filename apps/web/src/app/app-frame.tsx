import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useServerInfo } from '@/auth/use-server-info';
import { Button, Icon, NoticeCard } from '@/shared/ui';
import { useStreamStatus } from '@/shared/ws/use-event-stream';
import { AppShell, type ShellNavGroup } from './app-shell';
import { SCREENS } from './routes-meta';
import { StaleBuildBanner } from './stale-build-banner';

/** The sidebar's destinations, labelled in the active language. */
function useNav(): readonly ShellNavGroup[] {
  const { t } = useTranslation('app');
  return useMemo(
    () => [
      {
        id: 'home',
        ariaLabel: t('nav.groupHome'),
        items: [
          { to: SCREENS.devices.path, label: t(SCREENS.devices.titleKey), icon: 'home' },
          { to: SCREENS.timeline.path, label: t(SCREENS.timeline.titleKey), icon: 'timeline' },
          { to: SCREENS.pets.path, label: t(SCREENS.pets.titleKey), icon: 'pets' },
        ],
      },
      {
        id: 'server',
        label: t('nav.groupServer'),
        items: [
          { to: SCREENS.log.path, label: t(SCREENS.log.titleKey), icon: 'log' },
          { to: SCREENS.provision.path, label: t(SCREENS.provision.titleKey), icon: 'provision' },
          { to: SCREENS.setup.path, label: t(SCREENS.setup.titleKey), icon: 'settings' },
        ],
      },
      {
        id: 'advanced',
        label: t('nav.groupAdvanced'),
        items: [
          { to: SCREENS.capture.path, label: t(SCREENS.capture.titleKey), icon: 'file' },
          { to: SCREENS.patchers.path, label: t(SCREENS.patchers.titleKey), icon: 'wrench' },
        ],
      },
    ],
    [t],
  );
}

/** The signed-in frame: sidebar (or phone bar), the server notices, then the screen. */
export function AppFrame({ children }: { children: ReactNode }) {
  const { t } = useTranslation(['app', 'common']);
  const navGroups = useNav();
  const info = useServerInfo();
  const live = useStreamStatus();
  return (
    <AppShell
      navGroups={navGroups}
      serverLine={info.data ? t('shell.serverLine', { version: info.data.version }) : undefined}
      liveState={live}
      serverLabel={window.location.host}
      // What the browser can truthfully say about the connection. Certificate pinning is
      // something the iOS app does; a browser only knows whether the page arrived over TLS.
      badge={window.location.protocol === 'https:' ? 'TLS' : t('shell.notEncrypted')}
    >
      {info.isError && (
        <NoticeCard
          title={t('shell.unreachableTitle')}
          action={
            <Button
              variant="secondary"
              disabled={info.isFetching}
              onClick={() => {
                void info.refetch();
              }}
            >
              <Icon name="refresh" />
              {t('common:retryNow')}
            </Button>
          }
        >
          {t('shell.unreachableBody')}
        </NoticeCard>
      )}
      <StaleBuildBanner />
      {children}
    </AppShell>
  );
}
