import { useQueryClient } from '@tanstack/react-query';
import { type SyntheticEvent, useState } from 'react';
import { api } from '@/shared/api/client';
import { ApiError, errorMessage, toApiError } from '@/shared/api/errors';
import { Button, Card, DrumMark, StackedField, TextInput } from '@/shared/ui';
import { AuthPage } from './auth-page';
import { PasswordLengthMeter } from './password-length-meter';

type Mode = 'sign-in' | 'first-run';

/** Muted 12px copy at the foot of the card. */
const NOTE = 'text-xs text-muted-foreground';
/** Mono for the host and the recovery command. */
const CODE = 'font-mono text-foreground';
const RECOVERY = 'my-petkit admin set-password';

/**
 * Sign in with the admin password, or, on a server with no admin yet, create
 * one with the one-time setup code the server printed in its log. Success sets
 * the HttpOnly session cookie; the page never sees a credential it could keep.
 */
export function SignInScreen() {
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
      setError('The two passwords are different.');
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
          : 'Could not sign in.',
      );
    } finally {
      setBusy(false);
    }
  }

  const passwordInput = (autoComplete: 'current-password' | 'new-password') => (
    <TextInput
      large
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
              my-petkit
            </span>
            <div className="flex flex-col gap-1.5">
              <h1 id="auth-title" className="text-[26px]">
                {signIn ? 'Sign in' : 'Set up your server'}
              </h1>
              <p className="text-md text-lede">
                {signIn ? (
                  <>
                    Home server · <span className="font-mono text-sm">{window.location.host}</span>
                  </>
                ) : (
                  'This server has no admin yet. It prints a one-time setup code in its log when it starts.'
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
                <StackedField label="Admin password">
                  {passwordInput('current-password')}
                </StackedField>
              </>
            ) : (
              <>
                <StackedField label="Setup code">
                  <TextInput
                    large
                    mono
                    autoComplete="off"
                    spellCheck={false}
                    value={setupToken}
                    onChange={e => {
                      setSetupToken(e.target.value);
                    }}
                    required
                  />
                </StackedField>
                <div className="flex flex-col">
                  <StackedField label="Admin password">
                    {passwordInput('new-password')}
                  </StackedField>
                  <PasswordLengthMeter password={password} />
                </div>
                <StackedField label="Repeat the password">
                  <TextInput
                    large
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={e => {
                      setConfirm(e.target.value);
                    }}
                    required
                  />
                </StackedField>
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
              {signIn ? 'Sign in' : 'Create admin'}
            </Button>
            {signIn ? (
              <p className={NOTE}>
                Too many tries make you wait a moment. Forgot it? Run{' '}
                <code className={CODE}>{RECOVERY}</code> on the server. First time here?{' '}
                <Button
                  type="button"
                  variant="text"
                  size="small"
                  className="h-auto px-0 text-xs"
                  onClick={() => {
                    switchTo('first-run');
                  }}
                >
                  Set up the admin
                </Button>
              </p>
            ) : (
              <>
                <p className={NOTE}>
                  The code works once, for 30 minutes. Restart the server for a new one, or run{' '}
                  <code className={CODE}>{RECOVERY}</code> there.
                </p>
                <Button
                  type="button"
                  variant="text"
                  size="small"
                  className="self-start px-0"
                  onClick={() => {
                    switchTo('sign-in');
                  }}
                >
                  I already have a password
                </Button>
              </>
            )}
          </form>
        </Card>
        <p className="px-2 text-xs text-muted-foreground">
          Your browser warns once about this server&apos;s certificate because the server made it
          itself. Check that the fingerprint it shows matches the one in the server log before you
          continue.
        </p>
      </div>
    </AuthPage>
  );
}
