import { useQueryClient } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { api } from '@/shared/api/client';
import { Button, Card, SectionCard, ThemeModeControl, useToast } from '@/shared/ui';

const RECOVERY = 'my-petkit admin set-password';

/** Settings › Appearance: System / Light / Dark, kept in this browser only. */
export function AppearanceSection() {
  const { t } = useTranslation('app');
  const title = t('settings.appearance.title');
  return (
    <SectionCard title={title}>
      <ThemeModeControl label={title} />
      <p className="text-xs text-muted-foreground">{t('settings.appearance.note')}</p>
    </SectionCard>
  );
}

/** Settings › account: who is signed in, how to change the password, and Sign out. */
export function AccountSection() {
  const { t } = useTranslation('app');
  const queryClient = useQueryClient();
  const toast = useToast();
  return (
    <Card as="section" aria-label={t('settings.account.label')} className="flex flex-col px-5 py-2">
      <div className="flex min-h-13 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
        <span>{t('settings.account.signedIn')}</span>
        <span className="text-xs text-muted-foreground">
          <Trans
            t={t}
            i18nKey="settings.account.changePassword"
            values={{ command: RECOVERY }}
            components={{ code: <code className="font-mono text-foreground" /> }}
          />
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
                toast(t('settings.account.signOutFailed'), { error: true });
              });
          }}
        >
          {t('settings.account.signOut')}
        </Button>
      </div>
    </Card>
  );
}
