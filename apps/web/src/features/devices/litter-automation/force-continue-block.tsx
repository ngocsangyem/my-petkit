import { useQueryClient } from '@tanstack/react-query';
import { CheckIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { ApiError, errorMessage } from '@/shared/api/errors';
import { Button, ConfirmDialog, Icon, RiskNotice, StepUpPill, useToast } from '@/shared/ui';
import { Alert, AlertDescription } from '@/shared/ui/shadcn/alert';
import { deviceKeys } from '../api';
import { actionDeliveryText } from '../lib/delivery-text';
import { BlockHeading } from '../components/panel-parts';
import { type LitterAutomation, sendForceContinue } from './litter-automation-api';
import {
  checklistPasses,
  FORCE_CONTINUE_CHECKLIST,
  pausedButBlocked,
  uncoveredBlockers,
} from './litter-automation-text';

interface ForceContinueBlockProps {
  deviceId: number;
  forceContinue: LitterAutomation['forceContinue'];
}

/**
 * Force continue on a box paused for a cat near the entrance (R3). The button
 * exists only while the server offers it, that is while every guard passes. A
 * click opens the confirm; without a fresh step-up the API client asks for the
 * password and replays the send, as for every R3 action. The server re-checks
 * every guard and answers a 409 with one sentence when one fails (or a 503
 * when the command could not be sent), shown here in an alert.
 */
export function ForceContinueBlock({ deviceId, forceContinue }: ForceContinueBlockProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const { offered, blockers } = forceContinue;
  const quietBlockers = !offered && pausedButBlocked(blockers);

  // An open confirm stays up when a refresh withdraws the offer: its button disables instead.
  if (!forceContinue.supported) return null;
  if (!offered && !quietBlockers && !refusal && !confirming) return null;

  const start = () => {
    setRefusal(null);
    setConfirming(true);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const result = await sendForceContinue(deviceId);
      toast(`Continue cleaning · ${actionDeliveryText(result.delivered)}`);
    } catch (error) {
      // A cancelled password prompt is the person's own choice, not a refusal to show.
      const cancelled = error instanceof ApiError && error.code === 'step_up_required';
      if (!cancelled) setRefusal(errorMessage(error));
    } finally {
      setBusy(false);
      setConfirming(false);
      await queryClient.invalidateQueries({ queryKey: deviceKeys.detail(deviceId) });
    }
  };

  return (
    <section className="flex min-w-0 flex-col gap-2.5" aria-label="Force continue">
      {offered && (
        <>
          <BlockHeading
            title="Paused"
            aside="The box stopped because it saw a cat near the entrance."
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" disabled={busy} onClick={start}>
              Force continue
            </Button>
            <StepUpPill>Step-up</StepUpPill>
          </div>
        </>
      )}
      {quietBlockers && (
        <p className="text-sm text-muted-foreground">
          Paused. Force continue is not offered: {blockers.map(b => b.message).join(' ')}
        </p>
      )}
      {refusal && (
        <Alert>
          <Icon name="warning" size={16} strokeWidth={2} className="text-warning" />
          <AlertDescription className="text-foreground">{refusal}</AlertDescription>
        </Alert>
      )}
      <ConfirmDialog
        open={confirming}
        title="Continue cleaning now?"
        confirmLabel="Continue cleaning"
        cancelLabel="Not now"
        confirmVariant="danger-final"
        busy={busy}
        confirmDisabled={!offered}
        onConfirm={() => void confirm()}
        onCancel={() => {
          setConfirming(false);
        }}
      >
        <p>The drum turns again. The box paused because it saw a cat near the entrance.</p>
        <ul className="m-0 flex list-none flex-col gap-1.5 rounded-lg bg-raised p-3 text-foreground">
          {FORCE_CONTINUE_CHECKLIST.map(item => {
            const ok = checklistPasses(item, blockers);
            return (
              <li key={item.label} className="flex items-center gap-2">
                {ok ? (
                  <CheckIcon className="size-4 flex-none text-positive" aria-hidden="true" />
                ) : (
                  <XIcon className="size-4 flex-none text-negative" aria-hidden="true" />
                )}
                <span>{item.label}</span>
                <span className="sr-only">{ok ? '(checked)' : '(not met)'}</span>
              </li>
            );
          })}
        </ul>
        {uncoveredBlockers(blockers).map(b => (
          <p key={b.reason} className="text-negative">
            {b.message}
          </p>
        ))}
        <RiskNotice>
          Look at the box before you continue. If a cat steps inside, the box stops again on its
          own; this app never overrides that.
        </RiskNotice>
      </ConfirmDialog>
    </section>
  );
}
