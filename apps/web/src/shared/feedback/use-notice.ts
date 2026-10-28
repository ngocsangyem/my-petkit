import { useCallback, useEffect, useRef, useState } from 'react';

/** A short-lived status sentence ("Copied", "Saved 12 rows"), cleared after a few seconds. */
export function useNotice(ttlMs = 2600): [string, (message: string) => void] {
  const [notice, setNotice] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const show = useCallback(
    (message: string) => {
      setNotice(message);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setNotice('');
      }, ttlMs);
    },
    [ttlMs],
  );
  return [notice, show];
}
