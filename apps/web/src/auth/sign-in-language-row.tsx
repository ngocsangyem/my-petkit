import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageControl } from '@/i18n/language-control';

/** The foot of the sign-in card: the language can be changed before signing in. */
export function SignInLanguageRow() {
  const { t } = useTranslation();
  return (
    <div className="mt-4.5 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4.5">
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Globe size={16} aria-hidden="true" />
        {t('language')}
      </span>
      <LanguageControl fit />
    </div>
  );
}
