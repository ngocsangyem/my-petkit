// The dashboard's languages: English (the default) and Vietnamese, on i18next.
//
// Resources
//   `locales/{en,vi}/{namespace}.json`, bundled by locale-resources.ts with no
//   registration list. One namespace per feature folder (`devices`, `timeline`,
//   ...), `app` for the frame and Settings, `auth` for sign-in and step-up,
//   `common` for words every screen uses (Save, Cancel, Retry, Loading...).
//   Both languages carry the same keys; locale-keys.test.ts fails otherwise.
//
// Adding a namespace
//   1. Add `locales/en/{ns}.json` and `locales/vi/{ns}.json`.
//   2. In i18next.d.ts add `import type {ns} from './locales/en/{ns}.json';`
//      and `{ns}: typeof {ns};` under `resources`, so its keys type-check.
//
// In a component
//   `const { t } = useTranslation('devices');` then `t('card.title')`. With
//   common words too: `useTranslation(['devices', 'common'])` and
//   `t('common:save')` (keys of the first namespace stay unprefixed). Values with markup use `<Trans>` with named
//   tags (`"Run <code>{{command}}</code>"`), never concatenated fragments.
//   Counts use `t('key', { count })` with `key_one` and `key_other`, in BOTH
//   languages (the Vietnamese pair usually reads the same): runtimes disagree on
//   Vietnamese plural rules, and some pick `_one` for 1, which without the key
//   would fall back to English.
//
// The switch
//   `<LanguageControl />` from '@/i18n/language-control' (Settings, sign-in).
//
// Outside React (pure model code)
//   `i18n.t('timeline:kind.visit')` and `currentLocale()` read the active
//   language. The component that renders the result must itself re-render on a
//   change: it calls `useTranslation()` or `useLocale()`, and a `useMemo` over
//   such text lists the locale among its dependencies.
//
// Dates and numbers
//   `useLocale()` in a component, `currentLocale()` elsewhere, passed to `Intl`
//   and `toLocale*` instead of `undefined` or a fixed 'en-GB'. Parsing that
//   needs a fixed format (device-zone.ts) keeps its fixed locale.
//
// Tests
//   src/test/setup.ts initialises this module in English and switches back
//   after every test, so `render()` and `renderWithProviders()` need nothing
//   more and assert English text. A test of Vietnamese copy calls
//   `await i18n.changeLanguage('vi')` (inside `act`) first.
//
// Not translated
//   Text the server sends (event labels, API error messages, device logs),
//   product and model names, units and code.
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, LANGUAGES, storedLanguage } from './language';
import { resources } from './locale-resources';

export {
  currentLanguage,
  currentLocale,
  DEFAULT_LANGUAGE,
  LANGUAGE_NAMES,
  LANGUAGES,
  normalizeLanguage,
  setLanguage,
  useLanguage,
  useLocale,
} from './language';
export type { Language } from './language';

/** Screen readers and the browser's own hyphenation and spelling follow the page language. */
function markDocument(language: string) {
  document.documentElement.lang = language;
}

i18next.on('languageChanged', markDocument);

// Resources are bundled, so initialisation completes before this module returns
// and the first render already has every string.
void i18next.use(initReactI18next).init({
  resources,
  lng: storedLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES,
  defaultNS: 'common',
  ns: Object.keys(resources.en ?? {}),
  // React escapes what it renders; escaping here as well would show `&amp;`.
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});

export { i18next as i18n };
