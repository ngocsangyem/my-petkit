import type { Metadata } from 'next';
import { getDictionary } from './i18n-dictionaries';
import { i18n, localizePath, type Locale } from './i18n';
import { appName, siteUrl } from './shared';

/** hreflang links for one path in every language, `x-default` pointing at English. */
export function languageAlternates(path: string, lang: Locale): Metadata['alternates'] {
  const languages: Record<string, string> = {};
  for (const code of i18n.languages) languages[code] = localizePath(path, code);
  languages['x-default'] = localizePath(path, i18n.defaultLanguage);

  return { canonical: localizePath(path, lang), languages };
}

/** Site-wide defaults for a language tree's root layout. */
export function rootMetadata(lang: Locale): Metadata {
  const { meta } = getDictionary(lang);

  return {
    metadataBase: new URL(siteUrl),
    title: { template: `%s | ${appName}`, default: meta.siteTitle },
    description: meta.description,
  };
}

/** The landing page: site title, plus its counterpart in the other language. */
export function landingMetadata(lang: Locale): Metadata {
  return { alternates: languageAlternates('/', lang) };
}
