import { useServerInfo } from '@/auth/use-server-info';
import { Button, NoticeCard } from '@/shared/ui';

/** The entry script this page was loaded from, e.g. `index-Ab12cd.js`. */
function ownEntry(): string | null {
  const name = new URL(import.meta.url).pathname.split('/').pop() ?? '';
  return /^index-[\w-]+\.js$/.test(name) ? name : null;
}

/**
 * "This page is out of date": the server would now serve a different build than
 * the one this tab is running. Only a production build knows its own entry.
 */
export function StaleBuildBanner() {
  const info = useServerInfo();
  const mine = ownEntry();
  const current = info.data?.web_entry ?? null;
  if (!mine || !current || mine === current) return null;
  return (
    <NoticeCard
      title="This page is out of date"
      action={
        <Button
          variant="primary"
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload
        </Button>
      }
    >
      The server has a newer version. Reload to get the matching dashboard.
    </NoticeCard>
  );
}
