import { useMutation, useQuery } from '@tanstack/react-query';
import type { components } from '@/api/schema';
import { api, unwrap } from '@/shared/api/client';

export type DeviceSummary = components['schemas']['DeviceSummary'];
export type PatcherEntry = components['schemas']['PatcherEntry'];
export type PatcherId = PatcherEntry['id'];
export type PatcherStatus = components['schemas']['PatcherStatus'];

export const patcherKeys = {
  devices: ['patchers', 'devices'] as const,
  status: (deviceId: number) => ['patchers', 'status', deviceId] as const,
};

export function usePatcherDevices() {
  return useQuery({
    queryKey: patcherKeys.devices,
    queryFn: () => unwrap(api.GET('/api/devices')),
  });
}

/** Per-patcher state of one device; `supported: false` for non-Linux models. */
export function usePatcherStatus(deviceId: number | null) {
  return useQuery({
    queryKey: patcherKeys.status(deviceId ?? -1),
    queryFn: () =>
      unwrap(api.GET('/api/devices/{id}/patcher', { params: { path: { id: deviceId ?? -1 } } })),
    enabled: deviceId !== null,
  });
}

export interface PatcherRun {
  deviceId: number;
  patcher: PatcherId;
  action: 'apply' | 'remove';
  pubkey?: string;
}

/**
 * Starts an apply or a remove (R3: the client asks for the password first).
 * The answer only means "accepted": progress and the outcome arrive as
 * `patcher` hub events.
 */
export function useRunPatcher() {
  return useMutation({
    mutationFn: ({ deviceId, patcher, action, pubkey }: PatcherRun) =>
      unwrap(
        api.POST('/api/devices/{id}/patcher', {
          params: { path: { id: deviceId } },
          body:
            action === 'apply' ? { patcher, action, pubkey: pubkey ?? '' } : { patcher, action },
        }),
      ),
  });
}
