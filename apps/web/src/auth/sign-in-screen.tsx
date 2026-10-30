import { useQueryClient } from '@tanstack/react-query';
import { type SyntheticEvent, useState } from 'react';
import { api } from '@/shared/api/client';
import { ApiError, errorMessage, toApiError } from '@/shared/api/errors';
import { Button, DrumMark, StackedField, TextInput } from '@/shared/ui';
import { AuthPage } from './auth-page';

type Mode = 'sign-in' | 'first-run';

/** Muted 13px copy inside the sign-in card. */
const NOTE = 'text-sm text-muted-foreground';
/** Mono 12px ink for the host and the recovery command. */
const CODE = 'font-mono text-xs text-foreground';

/**
 * Sign in with the admin password, or, on a server with no admin yet, create
 * one with the one-time setup token the server printed in its log. Success sets
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

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    setError(null);
    if (mode === 'first-run' && password !== confirm) {
      setError('The two passwords are different.');
      return;
    }
    setBusy(true);
    try {
      const { error: failure, response } =
        mode === 'sign-in'
          ? await api.POST('/api/auth/login', { body: { password } })
          : await api.POST('/api/auth/setup', { body: { password, setup_token: setupToken } });
      if (!response.ok) {
        const refusal = toApiError(response.status, failure);
        if (refusal.code === 'setup_required') {
          setMode('first-run');
          setError(null);
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

  return (
    <AuthPage>
      <div className="grid w-full max-w-[440px] gap-4">
        <div className="flex items-center gap-2.5 text-[15px] font-semibold">
          <DrumMark size={20} />
          <span>my-petkit</span>
        </div>
        <form
          className="grid gap-4 rounded-2xl border border-border bg-background p-8"
          onSubmit={e => void submit(e)}
          noValidate
        >
          {mode === 'sign-in' ? (
            <>
              <h1>Sign in</h1>
              <div className="grid gap-1 rounded-lg bg-raised px-3.5 py-3 text-xs text-muted-foreground">
                <span>
                  Is this your server? Check the certificate fingerprint your browser shows
                </span>
                <code className={CODE}>{window.location.host}</code>
              </div>
              <StackedField label="Username">
                <TextInput large value="admin" readOnly autoComplete="username" />
              </StackedField>
              <StackedField label="Password">
                <TextInput
                  large
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                  }}
                  required
                />
              </StackedField>
            </>
          ) : (
            <>
              <h1>Set up the admin</h1>
              <p className={NOTE}>
                The server printed a one-time setup token in its log when it started. It works once
                and expires after 30 minutes.
              </p>
              <StackedField label="Setup token">
                <TextInput
                  large
                  mono
                  autoComplete="off"
                  value={setupToken}
                  onChange={e => {
                    setSetupToken(e.target.value);
                  }}
                  required
                />
              </StackedField>
              <StackedField label="New password">
                <TextInput
                  large
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                  }}
                  required
                />
              </StackedField>
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
            {mode === 'sign-in' ? 'Sign in' : 'Create admin'}
          </Button>
          {mode === 'sign-in' ? (
            <p className={NOTE}>
              Forgot it? Run <code className={CODE}>my-petkit admin set-password</code> on the
              server. First time here?{' '}
              <Button
                type="button"
                variant="text"
                size="small"
                onClick={() => {
                  setMode('first-run');
                  setError(null);
                }}
              >
                Set up the admin
              </Button>
            </p>
          ) : (
            <Button
              type="button"
              variant="text"
              size="small"
              onClick={() => {
                setMode('sign-in');
                setError(null);
              }}
            >
              I already have a password
            </Button>
          )}
        </form>
        <p className="text-xs leading-normal text-muted-foreground">
          Your browser warns once about this server&apos;s certificate because the server made it
          itself. Check that the fingerprint it shows matches the one in the server log before you
          continue.
        </p>
      </div>
    </AuthPage>
  );
}
