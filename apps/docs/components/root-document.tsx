import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import type { ReactNode } from 'react';
import { i18nProvider } from 'fumadocs-ui/i18n';
import { Provider } from '@/components/provider';
import type { Locale } from '@/lib/i18n';
import { translations } from '@/lib/ui-translations';
import '@/app/global.css';

/**
 * The `<html>` shell. A static export has no middleware to pick a language, so each language
 * tree has its own root layout and renders this with its own `lang`.
 */
export function RootDocument({ lang, children }: { lang: Locale; children: ReactNode }) {
  return (
    <html lang={lang} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen font-sans">
        <Provider i18n={i18nProvider(translations, lang)}>{children}</Provider>
      </body>
    </html>
  );
}
