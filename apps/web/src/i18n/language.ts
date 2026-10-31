import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import { readPersisted, writePersisted } from '@/shared/ui/persisted-state';

/** The languages the dashboard ships, English first: it is the default. */
export const LANGUAGES = ['en', 'vi'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

/** Each language's own name, never translated: a reader must find theirs in any language. */
export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  en: 'English',
  vi: 'Tiếng Việt',
};

/** Stored as `mp.language`, in this browser only. */
const STORAGE_KEY = 'language';

/** Anything but a shipped language (a stale or hand-edited value) is English. */
export function normalizeLanguage(value: unknown): Language {
  return LANGUAGES.find(l => l === value) ?? DEFAULT_LANGUAGE;
}

/** The language this browser chose last time, read before the first render. */
export function storedLanguage(): Language {
  return normalizeLanguage(readPersisted<unknown>(STORAGE_KEY, DEFAULT_LANGUAGE));
}

/** Stores the choice and switches the page; every subscribed component re-renders at once. */
export function setLanguage(language: Language): void {
  writePersisted(STORAGE_KEY, language);
  void i18next.changeLanguage(language);
}

/** The active language, outside React. */
export function currentLanguage(): Language {
  return normalizeLanguage(i18next.resolvedLanguage ?? i18next.language);
}

/**
 * The BCP 47 locale for `Intl` and `toLocale*` in the active language. English keeps the
 * browser's own locale, whatever its language, so day and clock order stay as they were before
 * languages existed; Vietnamese is always vi-VN.
 */
export function currentLocale(): string {
  if (currentLanguage() === 'vi') return 'vi-VN';
  const browser = typeof navigator === 'undefined' ? '' : navigator.language;
  return browser || 'en-US';
}

/** The active language and its setter; the caller re-renders when the language changes. */
export function useLanguage(): [Language, (language: Language) => void] {
  const { i18n } = useTranslation();
  return [normalizeLanguage(i18n.resolvedLanguage ?? i18n.language), setLanguage];
}

/** {@link currentLocale} for a component, which re-renders when the language changes. */
export function useLocale(): string {
  useLanguage();
  return currentLocale();
}
