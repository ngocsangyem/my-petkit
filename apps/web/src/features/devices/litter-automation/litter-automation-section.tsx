import { errorMessage } from '@/shared/api/errors';
import { ErrorBlock } from '@/shared/ui';
import { AutoPackCard } from './auto-pack-card';
import {
  ForceContinueBlock,
  type ForceContinueController,
  useForceContinue,
} from './force-continue-block';
import { useLitterAutomation } from './litter-automation-api';

interface LitterAutomationSectionProps {
  deviceId: number;
  /**
   * The page's force-continue controller, when the page header also starts it; otherwise the
   * section keeps its own.
   */
  force?: ForceContinueController;
}

/**
 * Force continue and auto-pack for one litter box, as rows of the Automation card. Quiet by
 * design: a model that supports neither renders nothing, and so does the read while it loads.
 */
export function LitterAutomationSection({ deviceId, force }: LitterAutomationSectionProps) {
  const query = useLitterAutomation(deviceId);
  const own = useForceContinue(deviceId, query.data?.forceContinue);

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
  const { autoPack } = query.data;

  return (
    <>
      <ForceContinueBlock controller={force ?? own} />
      {autoPack.supported && autoPack.rule && autoPack.status && (
        <AutoPackCard deviceId={deviceId} rule={autoPack.rule} status={autoPack.status} />
      )}
    </>
  );
}
