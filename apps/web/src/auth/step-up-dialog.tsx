import { type SyntheticEvent, useEffect, useId, useRef, useState } from 'react';
import { api } from '@/shared/api/client';
import { setCredentialHandler } from '@/shared/api/credential-prompt';
import { errorMessage, toApiError } from '@/shared/api/errors';
import { Button } from '@/shared/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/shadcn/dialog';
import { Field, FieldError, FieldLabel } from '@/shared/ui/shadcn/field';
import { Input } from '@/shared/ui/shadcn/input';

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
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordId = useId();

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
    if (!password) return; // an empty attempt would only spend a rate-limit slot
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
    <Dialog
      open={open}
      onOpenChange={next => {
        // Escape and a click outside cancel, except while the password is being checked.
        if (!next && !busy) finish(false);
      }}
    >
      <DialogContent
        showCloseButton={false}
        initialFocus={passwordRef}
        aria-busy={busy || undefined}
        className="max-h-[calc(100vh-32px)] w-[calc(100%-32px)] max-w-[440px] gap-4 overflow-y-auto sm:max-w-[440px]"
      >
        <DialogHeader className="gap-1.5">
          <DialogTitle className="text-[18px] leading-snug font-semibold">
            Confirm it&apos;s you to continue?
          </DialogTitle>
          <DialogDescription className="text-base">
            This action can expose secrets or change devices. Enter your password again to continue.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={e => void confirm(e)} noValidate>
          <Field className="gap-1.5" data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={passwordId}>Password</FieldLabel>
            <Input
              ref={passwordRef}
              id={passwordId}
              type="password"
              autoComplete="current-password"
              className="h-9"
              value={password}
              aria-invalid={error ? true : undefined}
              onChange={e => {
                setPassword(e.target.value);
              }}
            />
            {error && <FieldError className="text-sm text-negative">{error}</FieldError>}
          </Field>
          <DialogFooter className="m-0 flex-row flex-wrap justify-end gap-2 rounded-none border-0 bg-transparent p-0">
            <Button
              variant="secondary"
              size="large"
              disabled={busy}
              onClick={() => {
                finish(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="large" disabled={busy || !password}>
              Continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
