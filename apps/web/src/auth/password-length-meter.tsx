import { useTranslation } from 'react-i18next';
import { RatioBar } from '@/shared/ui';

/** The server refuses a shorter admin password (`MIN_PASSWORD_LENGTH` in the auth feature). */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * How far a new password is toward the server's minimum length. It measures length only, so it
 * says "long enough", never "strong"; the server has the final word when the form is sent.
 */
export function PasswordLengthMeter({ password }: { password: string }) {
  const { t } = useTranslation('auth');
  const enough = password.length >= MIN_PASSWORD_LENGTH;
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <RatioBar
        value={password.length}
        max={MIN_PASSWORD_LENGTH}
        tone={enough ? 'accent' : 'warning'}
        ariaLabel={t('meter.label')}
      />
      <span className={enough ? 'text-xs text-data' : 'text-xs text-muted-foreground'}>
        {enough ? t('meter.longEnough') : t('meter.atLeast', { count: MIN_PASSWORD_LENGTH })}
      </span>
    </div>
  );
}
