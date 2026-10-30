// Entry of the fixture preview: the real app, signed in to a server that exists
// only as fixtures. Dev-only; never part of the production build.
//
// The stubs go in first and the app is imported after, so nothing in it can
// read the real clock, socket or network before they are replaced.
import { NOW } from '@/features/devices/devices-fixtures';
import { freezeClock } from './preview-clock';
import { installBluetoothStub, installSocketStub } from './preview-device-stubs';
import { installFetchStub } from './preview-fetch-stub';

freezeClock(NOW);
installFetchStub();
installSocketStub();
installBluetoothStub();

import('@/main').catch((error: unknown) => {
  console.error('[preview] the app failed to load', error);
});
