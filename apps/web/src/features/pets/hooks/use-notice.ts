import { useCallback, useEffect, useState } from 'react';

/** One outcome line, the way the old panel's toast reported a saved change. */
export interface Notice {
  text: string;
  error: boolean;
  /** Bumped per notice so the same sentence twice still restarts the timer. */
  id: number;
}

const VISIBLE_MS = 6000;

/** The latest outcome of an action; a success clears itself after a few seconds. */
export function useNotice(): [Notice | null, (text: string, error?: boolean) => void] {
  const [notice, setNotice] = useState<Notice | null>(null);
  const show = useCallback((text: string, error = false) => {
    setNotice(prev => ({ text, error, id: (prev?.id ?? 0) + 1 }));
  }, []);
  useEffect(() => {
    // A failure stays until the next outcome replaces it; it may need reading twice.
    if (!notice || notice.error) return;
    const timer = setTimeout(() => {
      setNotice(null);
    }, VISIBLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [notice]);
  return [notice, show];
}
