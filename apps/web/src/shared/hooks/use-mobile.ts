import { useSyncExternalStore } from 'react';

/** The phone layout's upper bound: at or under 900px the shell folds into a phone bar. */
export const MOBILE_BREAKPOINT = 900;

const QUERY = `(max-width: ${MOBILE_BREAKPOINT}px)`;

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => {
    mql.removeEventListener('change', onChange);
  };
}

function snapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** True while the window is phone-sized (the same bound as the `min-[901px]:` classes). */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
