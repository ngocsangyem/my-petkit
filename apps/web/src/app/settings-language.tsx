import { useTranslation } from 'react-i18next';
import { LanguageControl } from '@/i18n/language-control';
import { SectionCard } from '@/shared/ui';

/**
 * Settings › Language: English / Tiếng Việt, kept in this browser only. What the server sends
 * (event names, device logs, its messages) is not the dashboard's to translate.
 */
export function LanguageSection() {
  const { t } = useTranslation(['app', 'common']);
  return (
    <SectionCard title={t('common:language')} aside={t('settings.language.hint')}>
      <LanguageControl />
      <p className="text-xs text-muted-foreground">{t('settings.language.note')}</p>
    </SectionCard>
  );
}
