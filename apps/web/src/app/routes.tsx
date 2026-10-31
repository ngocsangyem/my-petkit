import { Navigate, Outlet, createHashRouter } from 'react-router';
import { AppFrame } from './app-frame';
import { RouteError } from './route-error';
import { SCREENS } from './routes-meta';

// Hash routing: the server only ever serves the document at `app/`, whatever
// the screen, so a reload or a shared link works under any mount point.
//
// Each screen is its own chunk, loaded when first opened: most visits open one
// or two screens, and the provisioning protocol or the face cropper should not
// delay the Devices page.

export const router = createHashRouter([
  {
    element: (
      <AppFrame>
        <Outlet />
      </AppFrame>
    ),
    errorElement: (
      <AppFrame>
        <RouteError />
      </AppFrame>
    ),
    children: [
      { index: true, element: <Navigate to={SCREENS.devices.path} replace /> },
      {
        path: SCREENS.devices.path,
        lazy: async () => ({ Component: (await import('@/features/devices')).DevicesPage }),
      },
      {
        path: SCREENS.timeline.path,
        lazy: async () => ({ Component: (await import('@/features/timeline')).TimelinePage }),
      },
      {
        path: SCREENS.pets.path,
        lazy: async () => ({ Component: (await import('@/features/pets')).PetsPage }),
      },
      {
        path: SCREENS.provision.path,
        lazy: async () => ({ Component: (await import('@/features/provision')).ProvisionPage }),
      },
      {
        path: SCREENS.log.path,
        lazy: async () => ({ Component: (await import('@/features/log')).LogPage }),
      },
      {
        path: SCREENS.setup.path,
        // Settings: the server setup lays out the screen; the paired phones (tokens), this
        // browser's appearance and the account go in its right column.
        lazy: async () => {
          const [{ SetupPage }, { TokensSection }, { AppearanceSection, AccountSection }] =
            await Promise.all([
              import('@/features/setup'),
              import('@/features/tokens'),
              import('./settings-appearance-and-account'),
            ]);
          return {
            Component: () => (
              <SetupPage
                phones={<TokensSection />}
                appearance={<AppearanceSection />}
                account={<AccountSection />}
              />
            ),
          };
        },
      },
      {
        path: SCREENS.capture.path,
        lazy: async () => ({ Component: (await import('@/features/capture')).CapturePage }),
      },
      {
        path: SCREENS.patchers.path,
        lazy: async () => ({ Component: (await import('@/features/patchers')).PatchersPage }),
      },
      { path: '*', element: <Navigate to={SCREENS.devices.path} replace /> },
    ],
  },
]);
