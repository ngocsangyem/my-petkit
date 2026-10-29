import { useQueries, useQuery } from '@tanstack/react-query';
import type { components } from '@/api/schema';
import { api, unwrap } from '@/shared/api/client';
import { previousDateKey } from './lib/device-zone';

export type DeviceSummary = components['schemas']['DeviceSummary'];
export type DeviceDetail = components['schemas']['DeviceDetail'];
export type BleAccessory = components['schemas']['BleAccessory'];
export type TimelineSession = components['schemas']['TimelineSession'];
export type PetWithFaces = components['schemas']['PetWithFaces'];
export type Sound = components['schemas']['Sound'];

// Every key starts with 'devices': the schedules block invalidates that prefix
// after a save, which is how a schedule change refreshes the device detail.
export const deviceKeys = {
  all: ['devices'] as const,
  list: ['devices', 'list'] as const,
  ble: ['devices', 'ble'] as const,
  details: ['devices', 'detail'] as const,
  detail: (id: number) => ['devices', 'detail', id] as const,
  timeline: ['devices', 'timeline'] as const,
  timelineDay: (date: string) => ['devices', 'timeline', date] as const,
  pets: ['devices', 'pets'] as const,
  sounds: (id: number) => ['devices', 'sounds', id] as const,
};

/** `GET /api/devices`: a bare array of summaries. */
export function useDeviceList() {
  return useQuery({
    queryKey: deviceKeys.list,
    queryFn: () => unwrap(api.GET('/api/devices')),
  });
}

/** `GET /api/ble`: every accessory, entities and resolved values included. */
export function useBleAccessories() {
  return useQuery({
    queryKey: deviceKeys.ble,
    queryFn: async () => (await unwrap(api.GET('/api/ble'))).accessories,
  });
}

/** `GET /api/devices/{id}` for every listed device: one request per device. */
export function useDeviceDetails(ids: readonly number[]) {
  return useQueries({
    queries: ids.map(id => ({
      queryKey: deviceKeys.detail(id),
      queryFn: () => unwrap(api.GET('/api/devices/{id}', { params: { path: { id } } })),
    })),
  });
}

/** `GET /api/pets`, for the strip's pet lanes and the AI block's face readback. */
export function usePets() {
  return useQuery({
    queryKey: deviceKeys.pets,
    queryFn: async () => (await unwrap(api.GET('/api/pets'))).pets,
  });
}

/**
 * Sessions of the server's today and yesterday. The timeline cuts days in the
 * server's zone; a device in another zone has a today that can start in the
 * server's yesterday, so both are read and the strip keeps each device's today.
 */
export function useRecentSessions() {
  const today = useQuery({
    queryKey: deviceKeys.timelineDay('today'),
    queryFn: () => unwrap(api.GET('/api/timeline')),
  });
  const before = today.data ? previousDateKey(today.data.date) : null;
  const yesterday = useQuery({
    queryKey: deviceKeys.timelineDay(before ?? 'none'),
    queryFn: () => unwrap(api.GET('/api/timeline', { params: { query: { date: before ?? '' } } })),
    enabled: before !== null,
  });
  return {
    sessions: [...(yesterday.data?.sessions ?? []), ...(today.data?.sessions ?? [])],
    isPending: today.isPending,
    error: today.error ?? yesterday.error,
    refetch: () => {
      void today.refetch();
      if (before) void yesterday.refetch();
    },
  };
}

/** `GET /api/devices/{id}/sounds`, only while the sounds block is open. */
export function useSounds(id: number, enabled: boolean) {
  return useQuery({
    queryKey: deviceKeys.sounds(id),
    queryFn: async () =>
      (await unwrap(api.GET('/api/devices/{id}/sounds', { params: { path: { id } } }))).sounds,
    enabled,
  });
}
