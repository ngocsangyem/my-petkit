import { RatioBar } from '@/shared/ui';

/** The server refuses a shorter admin password (`MIN_PASSWORD_LENGTH` in the auth feature). */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * How far a new password is toward the server's minimum length. It measures length only, so it
 * says "long enough", never "strong"; the server has the final word when the form is sent.
 */
export function PasswordLengthMeter({ password }: { password: string }) {
  const enough = password.length >= MIN_PASSWORD_LENGTH;
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <RatioBar
        value={password.length}
        max={MIN_PASSWORD_LENGTH}
        tone={enough ? 'accent' : 'warning'}
        ariaLabel="Password length toward the minimum"
      />
      <span className={enough ? 'text-xs text-data' : 'text-xs text-muted-foreground'}>
        {enough ? 'Long enough' : `At least ${MIN_PASSWORD_LENGTH} characters`}
      </span>
    </div>
  );
}
