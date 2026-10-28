import { useCallback, useState } from 'react';

// UI conveniences only (an open panel, a chosen filter). Never credentials:
// the web session is an HttpOnly cookie the page cannot read, by design.
const PREFIX = 'mp.';

function read<T>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? initial : (JSON.parse(raw) as T);
  } catch {
    return initial;
  }
}

/** `useState` whose value survives a reload, kept in this browser only. */
export function usePersistedState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => read(key, initial));
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(next));
      } catch {
        // Private mode or a full quota: the value still holds for this page.
      }
    },
    [key],
  );
  return [value, set];
}
