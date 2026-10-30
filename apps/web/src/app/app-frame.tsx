import type { ReactNode } from 'react';
import { useServerInfo } from '@/auth/use-server-info';
import { Button, Icon, NoticeCard } from '@/shared/ui';
import { useStreamStatus } from '@/shared/ws/use-event-stream';
import { AppShell, type ShellNavGroup } from './app-shell';
import { SCREENS } from './routes-meta';
import { StaleBuildBanner } from './stale-build-banner';

const NAV: readonly ShellNavGroup[] = [
  {
    id: 'home',
    ariaLabel: 'Home',
    items: [
      { to: SCREENS.devices.path, label: SCREENS.devices.title, icon: 'home' },
      { to: SCREENS.timeline.path, label: SCREENS.timeline.title, icon: 'timeline' },
      { to: SCREENS.pets.path, label: SCREENS.pets.title, icon: 'pets' },
    ],
  },
  {
    id: 'server',
    label: 'Server',
    items: [
      { to: SCREENS.log.path, label: SCREENS.log.title, icon: 'log' },
      { to: SCREENS.provision.path, label: SCREENS.provision.title, icon: 'provision' },
      { to: SCREENS.setup.path, label: SCREENS.setup.title, icon: 'settings' },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced · needs step-up',
    items: [
      { to: SCREENS.capture.path, label: SCREENS.capture.title, icon: 'file' },
      { to: SCREENS.patchers.path, label: SCREENS.patchers.title, icon: 'wrench' },
    ],
  },
];

/**
 * What the browser can truthfully say about the connection. Certificate pinning is something the
 * iOS app does; a browser only knows whether the page arrived over TLS.
 */
function connectionWords(): string {
  return window.location.protocol === 'https:' ? 'TLS' : 'Not encrypted';
}

/** The signed-in frame: sidebar (or phone bar), the server notices, then the screen. */
export function AppFrame({ children }: { children: ReactNode }) {
  const info = useServerInfo();
  const live = useStreamStatus();
  return (
    <AppShell
      navGroups={NAV}
      serverLine={info.data ? `Home server · v${info.data.version}` : undefined}
      liveState={live}
      serverLabel={window.location.host}
      badge={connectionWords()}
    >
      {info.isError && (
        <NoticeCard
          title="Can't reach your server"
          action={
            <Button
              variant="secondary"
              disabled={info.isFetching}
              onClick={() => {
                void info.refetch();
              }}
            >
              <Icon name="refresh" />
              Retry now
            </Button>
          }
        >
          The server is not answering. Retrying; nothing on this page is lost.
        </NoticeCard>
      )}
      <StaleBuildBanner />
      {children}
    </AppShell>
  );
}
