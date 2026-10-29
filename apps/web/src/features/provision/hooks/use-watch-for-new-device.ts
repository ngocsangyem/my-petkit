import { useCallback, useEffect, useMemo, useRef } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { fetchDeviceList } from '../api';

const WATCH_INTERVAL_MS = 5000;
const WATCH_MAX_TRIES = 60;

interface WatchCallbacks {
  log: (line: string) => void;
  /** A device beyond those present when watching started has registered. */
  onConnected: () => void;
}

/**
 * After a send, poll the device list until it grows: the first sign a
 * provisioned device reached this server. Gives up after five minutes with a
 * pointer to the Log page, where its first HTTP call would show.
 */
export function useWatchForNewDevice({ log, onConnected }: WatchCallbacks) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacks = useRef({ log, onConnected });
  useEffect(() => {
    callbacks.current = { log, onConnected };
  });

  const stop = useCallback(() => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    stop();
    let before: number;
    try {
      before = (await fetchDeviceList()).length;
    } catch (err) {
      callbacks.current.log(`(could not read the device list to watch it: ${errorMessage(err)})`);
      return;
    }
    let tries = 0;
    let inFlight = false;
    const handle = setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      tries++;
      fetchDeviceList()
        .then(devices => {
          if (timer.current !== handle) return;
          const newest = devices.at(-1);
          if (devices.length > before && newest) {
            stop();
            callbacks.current.onConnected();
            callbacks.current.log(`device connected: ${newest.name} #${newest.id}`);
          } else if (tries > WATCH_MAX_TRIES) {
            stop();
            callbacks.current.log('(still waiting — check the Log page for its first HTTP call)');
          }
        })
        .catch(() => {
          // A failed poll is retried on the next tick; the server may be restarting.
          if (timer.current === handle && tries > WATCH_MAX_TRIES) stop();
        })
        .finally(() => {
          inFlight = false;
        });
    }, WATCH_INTERVAL_MS);
    timer.current = handle;
  }, [stop]);

  return useMemo(() => ({ start, stop }), [start, stop]);
}
