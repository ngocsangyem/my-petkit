import { useTranslation } from 'react-i18next';
import { Segmented } from '@/shared/ui/chips-and-segmented';
import { LANGUAGE_NAMES, LANGUAGES, useLanguage } from './language';

const OPTIONS = LANGUAGES.map(id => ({ id, label: LANGUAGE_NAMES[id] }));

/** Props for {@link LanguageControl}. */
export interface LanguageControlProps {
  /** Fit the labels instead of stretching across the container, e.g. on the sign-in card. */
  fit?: boolean;
}

/**
 * English / Tiếng Việt as a segmented control, for Settings and the sign-in card. The page
 * switches at once and the choice is kept in this browser only.
 */
export function LanguageControl({ fit }: LanguageControlProps) {
  const { t } = useTranslation();
  const [language, choose] = useLanguage();
  return (
    <Segmented
      label={t('language')}
      options={OPTIONS}
      value={language}
      onChange={choose}
      fit={fit}
    />
  );
}
