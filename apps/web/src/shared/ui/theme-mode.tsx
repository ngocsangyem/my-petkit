import { useEffect } from 'react';
import { usePersistedState } from './persisted-state';
import { SegmentedChips } from './tabs';

/** What the user picked; "system" follows the operating system as it changes. */
export type ThemeMode = 'system' | 'light' | 'dark';

/** Stored as `mp.theme`, which public/theme-init.js reads before the first paint. */
const STORAGE_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function apply(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle('dark', dark);
}

/** The current mode and a setter that stores it; the page repaints at once. */
export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  const [mode, setMode] = usePersistedState<ThemeMode>(STORAGE_KEY, 'system');

  useEffect(() => {
    apply(mode);
    if (mode !== 'system') return;
    const query = window.matchMedia(DARK_QUERY);
    const follow = () => {
      apply('system');
    };
    query.addEventListener('change', follow);
    return () => {
      query.removeEventListener('change', follow);
    };
  }, [mode]);

  return [mode, setMode];
}

const OPTIONS = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
] as const;

/** System / Light / Dark chips. */
export function ThemeModeControl() {
  const [mode, setMode] = useThemeMode();
  return <SegmentedChips label="Appearance" options={OPTIONS} value={mode} onChange={setMode} />;
}
