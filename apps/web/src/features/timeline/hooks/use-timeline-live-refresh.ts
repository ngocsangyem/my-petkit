import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useHubEvents } from '@/shared/ws/use-event-stream';
import { timelineKeys } from '../api';

/** Hub kinds that change what the Timeline shows. */
const REFRESH_KINDS = new Set(['media', 'event']);
const DEBOUNCE_MS = 400;

/**
 * Re-fetch the day shortly after a new event lands or a media file becomes ready. Media turns
 * "ready" (and stitched video stops "assembling") well after the request that caused it, so
 * without this a card can render before its file exists and never retry. Bursts collapse into
 * one request. Event details are not refetched: their content never changes after ingest.
 */
export function useTimelineLiveRefresh(): void {
  const client = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useHubEvents(event => {
    if (!REFRESH_KINDS.has(event.kind)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void client.invalidateQueries({ queryKey: [...timelineKeys.all, 'day'] });
    }, DEBOUNCE_MS);
  });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
}
