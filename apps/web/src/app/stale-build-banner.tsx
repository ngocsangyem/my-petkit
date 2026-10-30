import { useServerInfo } from '@/auth/use-server-info';
import { Button } from '@/shared/ui';

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
    <div
      className="flex items-center justify-between gap-3 rounded-lg bg-pill-warning px-3.5 py-2.5 text-sm text-pill-warning-ink"
      role="status"
    >
      <span>This page is out of date: the server has a newer version.</span>
      <Button
        variant="secondary"
        size="small"
        onClick={() => {
          window.location.reload();
        }}
      >
        Reload
      </Button>
    </div>
  );
}
