import { useTranslation } from 'react-i18next';
import { useRouteError } from 'react-router';
import { Button, ErrorBlock, PageHeading } from '@/shared/ui';
import { errorMessage } from '@/shared/api/errors';

// After an add-on upgrade the previous build's screen chunks are gone, so a tab
// still running the old build fails to load any screen it had not opened yet.
const STALE_CHUNK =
  /dynamically imported module|Importing a module script failed|error loading dynamically/i;

/** What a screen shows instead of crashing the tab when it cannot load or render. */
export function RouteError() {
  const { t } = useTranslation(['app', 'common']);
  const error = useRouteError();
  const message = errorMessage(error);
  if (STALE_CHUNK.test(message)) {
    return (
      <PageHeading
        title={t('outdated.title')}
        finding={t('outdated.routeBody')}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              window.location.reload();
            }}
          >
            {t('common:reload')}
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
      retryLabel={t('common:reload')}
    />
  );
}
