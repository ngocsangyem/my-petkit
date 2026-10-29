import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMatches } from 'react-router';
import { useServerInfo } from '@/auth/use-server-info';
import { api } from '@/shared/api/client';
import { Button, ThemeModeControl } from '@/shared/ui';
import { useStreamStatus } from '@/shared/ws/use-event-stream';
import { AppShell, type ShellNavGroup } from './app-shell';
import { SCREENS } from './routes-meta';
import { StaleBuildBanner } from './stale-build-banner';

const NAV: readonly ShellNavGroup[] = [
  {
    id: 'home',
    ariaLabel: 'Home',
    items: [
      { to: SCREENS.devices.path, label: SCREENS.devices.title, icon: 'devices' },
      { to: SCREENS.timeline.path, label: SCREENS.timeline.title, icon: 'timeline' },
      { to: SCREENS.pets.path, label: SCREENS.pets.title, icon: 'pets' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    items: [
      { to: SCREENS.provision.path, label: SCREENS.provision.title, icon: 'provision' },
      { to: SCREENS.log.path, label: SCREENS.log.title, icon: 'log' },
      { to: SCREENS.setup.path, label: SCREENS.setup.title, icon: 'setup' },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced · needs step-up',
    items: [
      { to: SCREENS.capture.path, label: SCREENS.capture.title, icon: 'capture' },
      { to: SCREENS.patchers.path, label: SCREENS.patchers.title, icon: 'patchers' },
    ],
  },
];

function SignOut() {
  const queryClient = useQueryClient();
  return (
    <Button
      variant="text"
      size="small"
      onClick={() => {
        // Drop every cached answer (they belong to the old session); the gate's
        // probe then starts empty and its 401 shows the sign-in screen.
        void api.POST('/api/auth/logout').then(() => queryClient.resetQueries());
      }}
    >
      Sign out
    </Button>
  );
}

/** The signed-in frame: sidebar, top bar, the stale-build banner, then the screen. */
export function AppFrame({ children }: { children: ReactNode }) {
  const info = useServerInfo();
  const live = useStreamStatus();
  const path = useMatches().at(-1)?.pathname.replace(/^\//, '') ?? '';
  const title =
    Object.values(SCREENS).find(screen => path.startsWith(screen.path))?.title ?? 'my-petkit';
  const tls = window.location.protocol === 'https:';
  return (
    <AppShell
      navGroups={NAV}
      serverLine={info.data ? `Home server · v${info.data.version}` : undefined}
      account={
        <div className="flex flex-col items-start gap-3">
          <ThemeModeControl />
          <SignOut />
        </div>
      }
      liveState={live}
      serverLabel={window.location.host}
      badge={tls ? 'TLS' : 'Not encrypted'}
      pageTitle={title}
    >
      {info.isError && (
        <p
          className="rounded-lg bg-raised px-3.5 py-2.5 text-sm text-muted-foreground"
          role="status"
        >
          The server is not answering. Retrying; nothing on this page is lost.
        </p>
      )}
      <StaleBuildBanner />
      {children}
    </AppShell>
  );
}
