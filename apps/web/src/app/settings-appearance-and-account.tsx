import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { Button, Card, SectionCard, ThemeModeControl, useToast } from '@/shared/ui';

/** Settings › Appearance: System / Light / Dark, kept in this browser only. */
export function AppearanceSection() {
  return (
    <SectionCard title="Appearance">
      <ThemeModeControl />
      <p className="text-xs text-muted-foreground">Saved in this browser only.</p>
    </SectionCard>
  );
}

/** Settings › account: who is signed in, how to change the password, and Sign out. */
export function AccountSection() {
  const queryClient = useQueryClient();
  const toast = useToast();
  return (
    <Card as="section" aria-label="Account" className="flex flex-col px-5 py-2">
      <div className="flex min-h-13 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
        <span>Signed in to this server</span>
        <span className="text-xs text-muted-foreground">
          Change the password with{' '}
          <code className="font-mono text-foreground">my-petkit admin set-password</code>
        </span>
      </div>
      <div className="flex min-h-13 items-center border-t border-rule py-2">
        <Button
          variant="destructive"
          className="-ml-1 px-1"
          onClick={() => {
            // Drop every cached answer (they belong to the old session); the gate's probe then
            // starts empty and its 401 shows the sign-in screen.
            api
              .POST('/api/auth/logout')
              .then(() => queryClient.resetQueries())
              .catch(() => {
                toast('Could not sign out. The server did not answer.', { error: true });
              });
          }}
        >
          Sign out
        </Button>
      </div>
    </Card>
  );
}
