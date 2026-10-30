import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { usePersistedState } from './persisted-state';
import { SegmentedChips } from './tabs';

/** What the user picked; "system" follows the operating system as it changes. */
export type ThemeMode = 'system' | 'light' | 'dark';

/** Stored as `mp.theme`, which public/theme-init.js reads before the first paint. */
const STORAGE_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Anything but an explicit light or dark follows the system, as theme-init.js does. */
function normalize(mode: unknown): ThemeMode {
  return mode === 'light' || mode === 'dark' ? mode : 'system';
}

function apply(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle('dark', dark);
}

const ThemeModeContext = createContext<[ThemeMode, (mode: ThemeMode) => void] | null>(null);

/**
 * Wraps the app once. The one owner of the choice and of the operating-system
 * listener, so every control shows the same mode and "system" keeps following
 * the OS whichever controls are mounted.
 */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [stored, setMode] = usePersistedState<ThemeMode>(STORAGE_KEY, 'system');
  const mode = normalize(stored);

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

  const value = useMemo(
    (): [ThemeMode, (mode: ThemeMode) => void] => [mode, setMode],
    [mode, setMode],
  );
  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

/** The current mode and a setter that stores it; the page repaints at once. */
export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  const value = useContext(ThemeModeContext);
  if (!value) throw new Error('useThemeMode needs a ThemeModeProvider');
  return value;
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
