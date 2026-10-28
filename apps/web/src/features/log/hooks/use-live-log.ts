import { useCallback, useEffect, useRef, useState } from 'react';
import type { HubEvent } from '@/shared/ws/hub-event';
import { useHubEvents } from '@/shared/ws/use-event-stream';
import { LOG_CAP, useEventBackfill } from '../api';
import { eventKey } from '../log-format';

/**
 * Merge new events into the list: no duplicates, oldest first, newest `cap` kept.
 * The socket replays its last 80 events on every (re)connect and the backfill
 * overlaps them, so the same event routinely arrives twice.
 */
export function mergeEvents(
  current: readonly HubEvent[],
  incoming: readonly HubEvent[],
  cap = LOG_CAP,
): HubEvent[] {
  const seen = new Set(current.map(eventKey));
  const fresh = incoming.filter(e => {
    const key = eventKey(e);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!fresh.length) return current as HubEvent[];
  const last = current.at(-1);
  const inOrder = !last || fresh.every(e => e.ts >= last.ts);
  const merged = [...current, ...fresh];
  if (!inOrder) merged.sort((a, b) => a.ts - b.ts || a.seq - b.seq);
  return merged.length > cap ? merged.slice(merged.length - cap) : merged;
}

/** The live log: the hub's ring on load, then every event the stream delivers. */
export function useLiveLog() {
  const backfill = useEventBackfill();
  const [rows, setRows] = useState<HubEvent[]>([]);
  // After "clear", a reconnect's replay must not bring the cleared rows back.
  const clearedAt = useRef(-Infinity);

  const add = useCallback((events: readonly HubEvent[]) => {
    const kept = events.filter(e => e.ts > clearedAt.current);
    if (kept.length) setRows(current => mergeEvents(current, kept));
  }, []);

  useEffect(() => {
    if (backfill.data) add(backfill.data);
  }, [backfill.data, add]);

  useHubEvents(event => {
    add([event]);
  });

  const clear = useCallback(() => {
    setRows(current => {
      clearedAt.current = current.at(-1)?.ts ?? Date.now() / 1000;
      return [];
    });
  }, []);

  return {
    rows,
    clear,
    loading: backfill.isPending,
    error: backfill.error,
    retry: () => void backfill.refetch(),
  };
}
