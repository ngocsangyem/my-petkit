import { useEffect, useState } from 'react';

/** Epoch seconds, refreshed every `everyMs` so "ago" texts and the now line move. */
export function useNowSeconds(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now() / 1000);
    }, everyMs);
    return () => {
      clearInterval(timer);
    };
  }, [everyMs]);
  return now;
}
