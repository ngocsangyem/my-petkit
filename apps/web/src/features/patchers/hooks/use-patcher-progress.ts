import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHubEvents } from '@/shared/ws/use-event-stream';
import { patcherKeys } from '../api';
import { isFinalLine, MAX_LINES, patcherIdOf, runKey } from '../patcher-model';

/** Delay before re-reading a device's patchers after a run's last line. */
export const RELOAD_DELAY_MS = 2_000;

export interface PatcherProgress {
  /** Progress lines per `runKey(deviceId, patcherId)`. */
  lines: ReadonlyMap<string, readonly string[]>;
  /** Adds a local line (start, refusal) to a run. */
  note: (deviceId: number, patcherId: string, line: string, reset?: boolean) => void;
}

/**
 * Follows `patcher` hub events: the only channel that reports what a run did,
 * since the POST answers as soon as the run is accepted. Lines are routed by
 * their `[patcher_id]` prefix; a run's last line (done or FAILED) re-reads the
 * device's patcher status two seconds later.
 */
export function usePatcherProgress(): PatcherProgress {
  const client = useQueryClient();
  const [lines, setLines] = useState<ReadonlyMap<string, readonly string[]>>(new Map());
  const timers = useRef(new Set<number>());

  const append = useCallback((key: string, line: string, reset = false) => {
    setLines(prev => {
      const next = new Map(prev);
      const kept = reset ? [] : (prev.get(key) ?? []);
      next.set(key, [...kept, line].slice(-MAX_LINES));
      return next;
    });
  }, []);

  useHubEvents(event => {
    if (event.kind !== 'patcher' || event.device_id === null) return;
    const pid = patcherIdOf(event.summary);
    if (!pid) return;
    append(runKey(event.device_id, pid), event.summary);
    if (isFinalLine(event.summary)) {
      const deviceId = Number(event.device_id);
      const timer = window.setTimeout(() => {
        timers.current.delete(timer);
        void client.invalidateQueries({ queryKey: patcherKeys.status(deviceId) });
      }, RELOAD_DELAY_MS);
      timers.current.add(timer);
    }
  });

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(t => {
        window.clearTimeout(t);
      });
      pending.clear();
    };
  }, []);

  const note = useCallback(
    (deviceId: number, patcherId: string, line: string, reset = false) => {
      append(runKey(deviceId, patcherId), line, reset);
    },
    [append],
  );

  return { lines, note };
}
