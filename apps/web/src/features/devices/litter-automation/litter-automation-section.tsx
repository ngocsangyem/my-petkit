import { errorMessage } from '@/shared/api/errors';
import { ErrorBlock } from '@/shared/ui';
import { AutoPackCard } from './auto-pack-card';
import { ForceContinueBlock } from './force-continue-block';
import { useLitterAutomation } from './litter-automation-api';

/**
 * Force continue and auto-pack for one litter box. Quiet by design: a model
 * that supports neither renders nothing, and so does the read while it loads.
 */
export function LitterAutomationSection({ deviceId }: { deviceId: number }) {
  const query = useLitterAutomation(deviceId);

  if (query.isError) {
    return (
      <ErrorBlock
        message={`Force continue and auto-pack could not be read. ${errorMessage(query.error)}`}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  if (!query.data) return null;
  const { forceContinue, autoPack } = query.data;

  return (
    <>
      <ForceContinueBlock deviceId={deviceId} forceContinue={forceContinue} />
      {autoPack.supported && autoPack.rule && autoPack.status && (
        <AutoPackCard deviceId={deviceId} rule={autoPack.rule} status={autoPack.status} />
      )}
    </>
  );
}
