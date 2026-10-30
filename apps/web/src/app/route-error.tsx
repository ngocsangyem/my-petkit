import { useRouteError } from 'react-router';
import { Button, ErrorBlock, PageHeading } from '@/shared/ui';
import { errorMessage } from '@/shared/api/errors';

// After an add-on upgrade the previous build's screen chunks are gone, so a tab
// still running the old build fails to load any screen it had not opened yet.
const STALE_CHUNK =
  /dynamically imported module|Importing a module script failed|error loading dynamically/i;

/** What a screen shows instead of crashing the tab when it cannot load or render. */
export function RouteError() {
  const error = useRouteError();
  const message = errorMessage(error);
  if (STALE_CHUNK.test(message)) {
    return (
      <PageHeading
        title="This page is out of date"
        finding="The server has a newer version of the app. Reload to open this screen."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload
          </Button>
        }
      />
    );
  }
  return (
    <ErrorBlock
      message={message}
      onRetry={() => {
        window.location.reload();
      }}
      retryLabel="Reload"
    />
  );
}
