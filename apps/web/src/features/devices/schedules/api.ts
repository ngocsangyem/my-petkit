import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@/api/schema';
import { api, unwrap } from '@/shared/api/client';

// Query keys sit under the devices feature's `['devices']` prefix, so a save
// that changes the device (a schedule, a deferred feed) refreshes this block
// and the device detail it was drawn from with one invalidation.

type DeliveryResult = components['schemas']['DeviceDeliveryResult'];
export type DeferredFeed = components['schemas']['DeferredFeed'];
export type DeferredFeedRequest = components['schemas']['DeferredFeedCreateRequest'];

export const scheduleKeys = {
  deferred: (id: number) => ['devices', 'schedules', id, 'deferred'] as const,
};

/** Pending one-off feeds of a feeder. */
export function useDeferredFeeds(id: number) {
  return useQuery({
    queryKey: scheduleKeys.deferred(id),
    queryFn: () =>
      unwrap(api.GET('/api/devices/{id}/deferred-feed', { params: { path: { id } } })).then(
        r => r.deferred,
      ),
  });
}

function useRefreshDevice() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ['devices'] });
}

/** Store one schedule and push it to the device. */
export function useSaveSchedule(id: number) {
  const refresh = useRefreshDevice();
  return useMutation({
    mutationFn: (body: { target: string; value: unknown }): Promise<DeliveryResult> =>
      unwrap(api.POST('/api/devices/{id}/schedule', { params: { path: { id } }, body })),
    onSuccess: refresh,
  });
}

/** Add a one-off feed at a date and time on the device's clock. */
export function useAddDeferredFeed(id: number) {
  const refresh = useRefreshDevice();
  return useMutation({
    mutationFn: (body: DeferredFeedRequest) =>
      unwrap(api.POST('/api/devices/{id}/deferred-feed', { params: { path: { id } }, body })),
    onSuccess: refresh,
  });
}

/** Remove a pending one-off feed. */
export function useDeleteDeferredFeed(id: number) {
  const refresh = useRefreshDevice();
  return useMutation({
    mutationFn: (feedId: string) =>
      unwrap(
        api.DELETE('/api/devices/{id}/deferred-feed/{feed_id}', {
          params: { path: { id, feed_id: feedId } },
        }),
      ),
    onSuccess: refresh,
  });
}
