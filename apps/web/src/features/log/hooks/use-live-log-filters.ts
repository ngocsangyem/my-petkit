import { useMemo, useState } from 'react';
import { usePersistedState } from '@/shared/ui';
import type { HubEvent } from '@/shared/ws/hub-event';
import { deviceText, isHeartbeat } from '../log-format';

export const ALL = '';

/** Whitespace-separated terms, all of which must appear (case-insensitive), like the device-log grep. */
export function matchesGrep(e: HubEvent, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = `${e.kind} ${deviceText(e)} ${e.summary}`.toLowerCase();
  return terms.every(t => hay.includes(t));
}

/** What the live log shows: the filters, and the rows that pass them. */
export function useLiveLogFilters(rows: readonly HubEvent[]) {
  const [hideHeartbeats, setHideHeartbeats] = usePersistedState('log.hideHeartbeats', true);
  const [autoscroll, setAutoscroll] = usePersistedState('log.autoscroll', true);
  const [grep, setGrep] = useState('');
  const [kind, setKind] = useState(ALL);
  const [device, setDevice] = useState(ALL);

  const kinds = useMemo(() => [...new Set(rows.map(e => e.kind))].sort(), [rows]);
  const devices = useMemo(() => [...new Set(rows.map(deviceText))].sort(), [rows]);

  const heartbeats = useMemo(() => rows.filter(isHeartbeat).length, [rows]);
  const visible = useMemo(
    () =>
      rows.filter(
        e =>
          !(hideHeartbeats && isHeartbeat(e)) &&
          (kind === ALL || e.kind === kind) &&
          (device === ALL || deviceText(e) === device) &&
          matchesGrep(e, grep),
      ),
    [rows, hideHeartbeats, kind, device, grep],
  );

  return {
    hideHeartbeats,
    setHideHeartbeats,
    autoscroll,
    setAutoscroll,
    grep,
    setGrep,
    kind,
    setKind,
    device,
    setDevice,
    kinds,
    devices,
    heartbeats,
    visible,
  };
}

export type LiveLogFilters = ReturnType<typeof useLiveLogFilters>;
