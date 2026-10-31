import { Navigate, type RouteObject } from 'react-router';
import { SCREENS } from './routes-meta';

/**
 * Any URL no screen claims goes Home. The target is absolute: a relative one resolves against
 * the unmatched URL itself, so `/settings` would redirect to `/settings/devices`, which is
 * unmatched too, and so on forever.
 */
export const unknownScreenRoute: RouteObject = {
  path: '*',
  element: <Navigate to={`/${SCREENS.devices.path}`} replace />,
};
