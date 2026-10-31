import { useCallback, useState } from 'react';

// UI conveniences only (an open panel, a chosen filter). Never credentials:
// the web session is an HttpOnly cookie the page cannot read, by design.
const PREFIX = 'mp.';

/** The stored value under `mp.{key}`, or `initial` when there is none or it cannot be read. */
export function readPersisted<T>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? initial : (JSON.parse(raw) as T);
  } catch {
    return initial;
  }
}

/** Stores `value` under `mp.{key}`; outside React, for state that lives elsewhere (i18next). */
export function writePersisted(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Private mode or a full quota: the value still holds for this page.
  }
}

/** `useState` whose value survives a reload, kept in this browser only. */
export function usePersistedState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => readPersisted(key, initial));
  const set = useCallback(
    (next: T) => {
      setValue(next);
      writePersisted(key, next);
    },
    [key],
  );
  return [value, set];
}
