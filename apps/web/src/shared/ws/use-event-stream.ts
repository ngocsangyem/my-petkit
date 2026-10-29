import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { eventStream, type StreamStatus } from './event-stream';
import type { HubEvent } from './hub-event';

/** The stream's connection state, for the Live indicator. */
export function useStreamStatus(): StreamStatus {
  return useSyncExternalStore(
    listener => eventStream.onStatus(listener),
    () => eventStream.currentStatus,
  );
}

/** Call `handler` for every hub event (and, optionally, every ping). */
export function useHubEvents(handler: (event: HubEvent) => void, onPing?: () => void): void {
  const latest = useRef({ handler, onPing });
  useLayoutEffect(() => {
    latest.current = { handler, onPing };
  });
  useEffect(() => {
    const offEvent = eventStream.onEvent(event => {
      latest.current.handler(event);
    });
    const offPing = eventStream.onPing(() => latest.current.onPing?.());
    return () => {
      offEvent();
      offPing();
    };
  }, []);
}
