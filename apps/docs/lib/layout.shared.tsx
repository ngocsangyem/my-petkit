import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Logo } from '@/components/logo';
import { LanguageSwitch, LanguageSwitchText } from '@/components/language-switch';
import { localizePath, type Locale } from './i18n';
import { appName, gitConfig } from './shared';

export function baseOptions(lang: Locale): BaseLayoutProps {
  return {
    nav: {
      url: localizePath('/', lang),
      title: (
        <>
          <Logo className="size-5" />
          <span className="font-semibold">{appName}</span>
        </>
      ),
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    // Replaces the stock picker wherever the layouts place it (header, menu, sidebar).
    slots: { languageSelect: { root: LanguageSwitch, text: LanguageSwitchText } },
  };
}
