import { Trans, useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui';

/** Muted 12px copy at the foot of the card. */
const NOTE = 'text-xs text-muted-foreground';
/** Mono for the recovery command. */
const CODE = <code className="font-mono text-foreground" />;
const RECOVERY = 'my-petkit admin set-password';

/** Under the Sign in button: rate limiting, the recovery command, and the way to first run. */
export function SignInNote({ onFirstRun }: { onFirstRun: () => void }) {
  const { t } = useTranslation('auth');
  return (
    <p className={NOTE}>
      <Trans
        t={t}
        i18nKey="signIn.note"
        values={{ command: RECOVERY }}
        components={{
          code: CODE,
          setup: (
            <Button
              type="button"
              variant="text"
              size="small"
              className="h-auto px-0 text-xs"
              onClick={onFirstRun}
            />
          ),
        }}
      />
    </p>
  );
}

/** Under the Create admin button: how long the code lives, and the way back to sign-in. */
export function FirstRunNote({ onSignIn }: { onSignIn: () => void }) {
  const { t } = useTranslation('auth');
  return (
    <>
      <p className={NOTE}>
        <Trans
          t={t}
          i18nKey="firstRun.note"
          values={{ command: RECOVERY }}
          components={{ code: CODE }}
        />
      </p>
      <Button
        type="button"
        variant="text"
        size="small"
        className="self-start px-0"
        onClick={onSignIn}
      >
        {t('firstRun.havePassword')}
      </Button>
    </>
  );
}
