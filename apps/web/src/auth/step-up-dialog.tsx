import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { api } from '@/shared/api/client';
import { setCredentialHandler } from '@/shared/api/credential-prompt';
import { errorMessage, toApiError } from '@/shared/api/errors';
import { ConfirmDialog, StackedField, TextInput } from '@/shared/ui';
import './auth.css';

/**
 * The password prompt for an action that needs a fresh step-up. The API client
 * opens it when the server answers `step_up_required`, and replays the request
 * once the grant (five minutes) is in place.
 */
export function StepUpDialog() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settle = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    setCredentialHandler(
      () =>
        new Promise<boolean>(resolve => {
          settle.current?.(false);
          settle.current = resolve;
          setPassword('');
          setError(null);
          setOpen(true);
        }),
    );
    return () => {
      setCredentialHandler(null);
    };
  }, []);

  function finish(ok: boolean) {
    setOpen(false);
    setPassword('');
    settle.current?.(ok);
    settle.current = null;
  }

  async function confirm(event?: SyntheticEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: failure, response } = await api.POST('/api/auth/step-up', {
        body: { password },
      });
      if (!response.ok) throw toApiError(response.status, failure);
      finish(true);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      title="Confirm it's you to continue?"
      confirmLabel="Continue"
      busy={busy}
      onConfirm={() => void confirm()}
      onCancel={() => {
        finish(false);
      }}
    >
      <form onSubmit={e => void confirm(e)}>
        <p>
          This action can expose secrets or change devices. Enter your password again to continue.
        </p>
        <StackedField label="Password">
          <TextInput
            large
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => {
              setPassword(e.target.value);
            }}
            autoFocus
          />
        </StackedField>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </ConfirmDialog>
  );
}
