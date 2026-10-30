import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { Button, SectionCard, ThemeModeControl, useToast } from '@/shared/ui';

/** Settings › Appearance: System / Light / Dark, kept in this browser only. */
export function AppearanceSection() {
  return (
    <SectionCard title="Appearance">
      <ThemeModeControl />
      <p className="text-xs text-muted-foreground">Saved in this browser only.</p>
    </SectionCard>
  );
}

/** Settings › account: sign this browser out of the server. */
export function AccountSection() {
  const queryClient = useQueryClient();
  const toast = useToast();
  return (
    <SectionCard title="Account">
      <div>
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
    </SectionCard>
  );
}
