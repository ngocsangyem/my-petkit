import { useCallback, useEffect, useMemo } from 'react';
import { usePersistedState } from '@/shared/ui';

/**
 * Open/closed state of every panel and every section inside one, keyed
 * "<panel>:<section>" where a panel is `d<id>` (device) or `a<id>` (accessory).
 * One map rather than a key per panel because the defaults differ — a panel
 * starts open, a section inside it starts closed — and keying by id is what
 * stops one device's open diagnostics from opening every device's.
 */
export type OpenState = (key: string, fallback: boolean) => boolean;
export type SetOpen = (key: string, open: boolean) => void;

const STORAGE_KEY = 'devices.open';

function asRecord(value: unknown): Record<string, boolean> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(value)) if (typeof v === 'boolean') out[k] = v;
  return out;
}

/** Remembered open state, pruned of panels that no longer exist once `livePanels` is known. */
export function useOpenState(livePanels: readonly string[] | null): [OpenState, SetOpen] {
  const [stored, setStored] = usePersistedState<unknown>(STORAGE_KEY, {});
  const map = useMemo(() => asRecord(stored), [stored]);

  // Forget devices that are gone, so the map does not grow forever across
  // re-registrations. Only once the list has loaded: an empty first render
  // would otherwise wipe everything.
  useEffect(() => {
    if (!livePanels) return;
    const live = new Set(livePanels);
    const kept = Object.entries(map).filter(([k]) => live.has(k.split(':')[0] ?? ''));
    if (kept.length !== Object.keys(map).length) setStored(Object.fromEntries(kept));
  }, [livePanels, map, setStored]);

  const isOpen = useCallback<OpenState>((key, fallback) => map[key] ?? fallback, [map]);
  const setOpen = useCallback<SetOpen>(
    (key, open) => {
      setStored({ ...map, [key]: open });
    },
    [map, setStored],
  );
  return [isOpen, setOpen];
}
