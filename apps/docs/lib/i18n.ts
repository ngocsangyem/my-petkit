import { defineI18n } from 'fumadocs-core/i18n';

// English keeps the unprefixed URLs (`/`, `/docs/...`); every other language lives under
// `/{lang}`. Translated pages sit beside the English file as `page.vi.mdx` / `meta.vi.json`,
// and a page without one falls back to the English content under the `/vi` URL.
export const i18n = defineI18n({
  languages: ['en', 'vi'],
  defaultLanguage: 'en',
  hideLocale: 'default-locale',
  parser: 'dot',
});

export type Locale = (typeof i18n.languages)[number];

/**
 * Language picker: the code shown on the button, the name in its own language, and the
 * menu's accessible label in that language. Kept here, not in the page dictionaries, so the
 * client-side picker does not ship the landing copy.
 */
export const localeLabels: Record<Locale, { code: string; name: string; menuLabel: string }> = {
  en: { code: 'EN', name: 'English', menuLabel: 'Choose a language' },
  vi: { code: 'VI', name: 'Tiếng Việt', menuLabel: 'Chọn ngôn ngữ' },
};

export function isLocale(value: string): value is Locale {
  return (i18n.languages as string[]).includes(value);
}

/** `/` → `/vi`, `/docs/x` → `/vi/docs/x`; English paths come back unchanged. */
export function localizePath(path: string, lang: Locale): string {
  if (lang === i18n.defaultLanguage) return path;
  return path === '/' ? `/${lang}` : `/${lang}${path}`;
}

/** Strips a non-default language prefix, so `/vi/docs/x` becomes `/docs/x`. */
export function delocalizePath(path: string): string {
  const [, first = ''] = path.split('/');
  if (!isLocale(first) || first === i18n.defaultLanguage) return path || '/';
  const rest = path.slice(first.length + 1);
  return rest === '' ? '/' : rest;
}

/** The same page in another language. */
export function switchLocalePath(pathname: string, lang: Locale): string {
  return localizePath(delocalizePath(pathname), lang);
}

export function localeFromPathname(pathname: string): Locale {
  const [, first = ''] = pathname.split('/');
  return isLocale(first) ? first : i18n.defaultLanguage;
}
