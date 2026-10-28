import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { HubEvent } from '@/shared/ws/hub-event';
import { useHubEvents } from '@/shared/ws/use-event-stream';
import { deviceKeys } from '../api';

// Delays that coalesce a burst of hub events into one round of fetches, as the
// old panel's ws.js did (300 ms for the list, 350 ms for details).
const LIST_DELAY_MS = 300;
const DETAIL_DELAY_MS = 350;

function deviceIdOf(event: HubEvent): number | null {
  const n = typeof event.device_id === 'number' ? event.device_id : Number(event.device_id);
  return event.device_id !== null && Number.isFinite(n) ? n : null;
}

/**
 * Live refresh from the hub, with the old panel's rules:
 * - any event refreshes the device list and accessories;
 * - an event about a device refreshes that device's detail; an unattributed
 *   `connect` refreshes every detail;
 * - `media` and `event` refresh today's sessions (the day strip), since new
 *   events land asynchronously after the request that caused them;
 * - a ping (the server's idle tick) refreshes the list and every detail.
 */
export function useLiveRefresh(): void {
  const queryClient = useQueryClient();
  const timers = useRef<{
    list?: ReturnType<typeof setTimeout>;
    detail?: ReturnType<typeof setTimeout>;
    dirty: Set<number> | 'all';
  }>({ dirty: new Set() });

  useEffect(() => {
    const t = timers.current;
    return () => {
      clearTimeout(t.list);
      clearTimeout(t.detail);
    };
  }, []);

  const refreshList = () => {
    void queryClient.invalidateQueries({ queryKey: deviceKeys.list });
    void queryClient.invalidateQueries({ queryKey: deviceKeys.ble });
  };

  const flushDetails = () => {
    const { dirty } = timers.current;
    timers.current.dirty = new Set();
    if (dirty === 'all') {
      void queryClient.invalidateQueries({ queryKey: deviceKeys.details });
      return;
    }
    for (const id of dirty) void queryClient.invalidateQueries({ queryKey: deviceKeys.detail(id) });
  };

  const scheduleList = () => {
    clearTimeout(timers.current.list);
    timers.current.list = setTimeout(refreshList, LIST_DELAY_MS);
  };

  const scheduleDetail = (id: number | 'all') => {
    const t = timers.current;
    if (id === 'all') t.dirty = 'all';
    else if (t.dirty !== 'all') t.dirty.add(id);
    clearTimeout(t.detail);
    t.detail = setTimeout(flushDetails, DETAIL_DELAY_MS);
  };

  useHubEvents(
    event => {
      scheduleList();
      const id = deviceIdOf(event);
      if (id !== null) scheduleDetail(id);
      else if (event.kind === 'connect') scheduleDetail('all');
      if (event.kind === 'media' || event.kind === 'event') {
        void queryClient.invalidateQueries({ queryKey: deviceKeys.timeline });
      }
    },
    () => {
      refreshList();
      void queryClient.invalidateQueries({ queryKey: deviceKeys.details });
    },
  );
}
