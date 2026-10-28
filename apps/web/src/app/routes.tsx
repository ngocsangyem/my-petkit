import { Navigate, Outlet, createHashRouter, useLocation } from 'react-router';
import { CapturePage } from '@/features/capture';
import { DevicesPage } from '@/features/devices';
import { LogPage } from '@/features/log';
import { PatchersPage } from '@/features/patchers';
import { PetsPage } from '@/features/pets';
import { ProvisionPage } from '@/features/provision';
import { SetupPage } from '@/features/setup';
import { TimelinePage } from '@/features/timeline';
import { TokensSection } from '@/features/tokens';
import { AppFrame } from './app-frame';
import { SCREENS } from './routes-meta';

// Hash routing: the server only ever serves the document at `app/`, whatever
// the screen, so a reload or a shared link works under any mount point.

/** The setup screen also carries the client tokens (pairing the iOS app). */
function SetupScreen() {
  return (
    <>
      <SetupPage />
      <TokensSection />
    </>
  );
}

function NotFound() {
  const location = useLocation();
  return <Navigate to={`/${SCREENS.devices.path}`} replace state={{ from: location.pathname }} />;
}

export const router = createHashRouter([
  {
    element: (
      <AppFrame>
        <Outlet />
      </AppFrame>
    ),
    children: [
      { index: true, element: <Navigate to={SCREENS.devices.path} replace /> },
      { path: SCREENS.devices.path, element: <DevicesPage /> },
      { path: SCREENS.timeline.path, element: <TimelinePage /> },
      { path: SCREENS.pets.path, element: <PetsPage /> },
      { path: SCREENS.provision.path, element: <ProvisionPage /> },
      { path: SCREENS.log.path, element: <LogPage /> },
      { path: SCREENS.setup.path, element: <SetupScreen /> },
      { path: SCREENS.capture.path, element: <CapturePage /> },
      { path: SCREENS.patchers.path, element: <PatchersPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
