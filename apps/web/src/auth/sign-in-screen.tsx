import { useQueryClient } from '@tanstack/react-query';
import { type SyntheticEvent, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { api } from '@/shared/api/client';
import { ApiError, errorMessage, toApiError } from '@/shared/api/errors';
import { Button, Card, DrumMark, TextInput } from '@/shared/ui';
import { AuthField } from './auth-field';
import { AuthPage } from './auth-page';
import { PasswordLengthMeter } from './password-length-meter';
import { SignInLanguageRow } from './sign-in-language-row';
import { FirstRunNote, SignInNote } from './sign-in-notes';

type Mode = 'sign-in' | 'first-run';

/**
 * Sign in with the admin password, or, on a server with no admin yet, create
 * one with the one-time setup code the server printed in its log. Success sets
 * the HttpOnly session cookie; the page never sees a credential it could keep.
 */
export function SignInScreen() {
  const { t } = useTranslation('auth');
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [password, setPassword] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signIn = mode === 'sign-in';

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    setError(null);
    if (!signIn && password !== confirm) {
      setError(t('firstRun.passwordsDiffer'));
      return;
    }
    setBusy(true);
    try {
      const { error: failure, response } = signIn
        ? await api.POST('/api/auth/login', { body: { password } })
        : await api.POST('/api/auth/setup', { body: { password, setup_token: setupToken } });
      if (!response.ok) {
        const refusal = toApiError(response.status, failure);
        if (refusal.code === 'setup_required') {
          switchTo('first-run');
          return;
        }
        throw refusal;
      }
      setPassword('');
      setConfirm('');
      setSetupToken('');
      await queryClient.resetQueries();
    } catch (failure) {
      setError(
        failure instanceof ApiError || failure instanceof Error
          ? errorMessage(failure)
          : t('signIn.failed'),
      );
    } finally {
      setBusy(false);
    }
  }

  const passwordInput = (autoComplete: 'current-password' | 'new-password') => (
    <TextInput
      type="password"
      autoComplete={autoComplete}
      value={password}
      onChange={e => {
        setPassword(e.target.value);
      }}
      required
    />
  );

  return (
    <AuthPage>
      <div
        className={signIn ? 'grid w-full max-w-[420px] gap-4' : 'grid w-full max-w-[480px] gap-4'}
      >
        <Card as="section" aria-labelledby="auth-title" className="p-8">
          <form className="flex flex-col gap-4.5" onSubmit={e => void submit(e)} noValidate>
            <span className="inline-flex items-center gap-2.5 text-base font-semibold">
              <DrumMark size={20} />
              MyPetKit
            </span>
            <div className="flex flex-col gap-1.5">
              <h1 id="auth-title" className="text-[26px]">
                {signIn ? t('signIn.title') : t('firstRun.title')}
              </h1>
              <p className="text-md text-lede">
                {signIn ? (
                  <Trans
                    t={t}
                    i18nKey="signIn.homeServer"
                    values={{ host: window.location.host }}
                    components={{ host: <span className="font-mono text-sm" /> }}
                  />
                ) : (
                  t('firstRun.lede')
                )}
              </p>
            </div>
            {signIn ? (
              <>
                {/* The account is always "admin"; password managers still want a username. */}
                <input
                  className="sr-only"
                  type="text"
                  name="username"
                  autoComplete="username"
                  value="admin"
                  readOnly
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <AuthField label={t('signIn.adminPassword')}>
                  {passwordInput('current-password')}
                </AuthField>
              </>
            ) : (
              <>
                <AuthField label={t('firstRun.setupCode')}>
                  <TextInput
                    mono
                    autoComplete="off"
                    spellCheck={false}
                    value={setupToken}
                    onChange={e => {
                      setSetupToken(e.target.value);
                    }}
                    required
                  />
                </AuthField>
                <div className="flex flex-col">
                  <AuthField label={t('signIn.adminPassword')}>
                    {passwordInput('new-password')}
                  </AuthField>
                  <PasswordLengthMeter password={password} />
                </div>
                <AuthField label={t('firstRun.repeatPassword')}>
                  <TextInput
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={e => {
                      setConfirm(e.target.value);
                    }}
                    required
                  />
                </AuthField>
              </>
            )}
            {error && (
              <p className="text-sm text-negative" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              size="large"
              className="w-full"
              disabled={busy || !password}
            >
              {signIn ? t('signIn.submit') : t('firstRun.submit')}
            </Button>
            {signIn ? (
              <SignInNote
                onFirstRun={() => {
                  switchTo('first-run');
                }}
              />
            ) : (
              <FirstRunNote
                onSignIn={() => {
                  switchTo('sign-in');
                }}
              />
            )}
          </form>
          <SignInLanguageRow />
        </Card>
        <p className="px-2 text-xs text-muted-foreground">{t('certificateNote')}</p>
      </div>
    </AuthPage>
  );
}
