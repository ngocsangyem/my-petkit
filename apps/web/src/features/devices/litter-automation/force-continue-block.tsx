import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { ApiError, errorMessage } from '@/shared/api/errors';
import { Button, ConfirmDialog, Icon, RiskNotice, StepUpPill, useToast } from '@/shared/ui';
import { deviceKeys } from '../api';
import { actionDeliveryText } from '../lib/delivery-text';
import { type LitterAutomation, sendForceContinue } from './litter-automation-api';
import {
  checklistPasses,
  FORCE_CONTINUE_CHECKLIST,
  pausedButBlocked,
  uncoveredBlockers,
} from './litter-automation-text';

type ForceContinue = LitterAutomation['forceContinue'];

/** Force continue for one box: its state, the start of the flow, and the confirm to render once. */
export interface ForceContinueController {
  /** The server offers it now: every guard passes. */
  offered: boolean;
  /** Paused, but a guard refuses: one quiet sentence says which. */
  quietBlockers: boolean;
  blockers: ForceContinue['blockers'];
  /** Something to show at all (offered, refused, refusing, or the confirm still open). */
  visible: boolean;
  busy: boolean;
  refusal: string | null;
  start: () => void;
  dialog: ReactNode;
}

/**
 * Force continue on a box paused for a cat near the entrance (R3). It exists only while the
 * server offers it, that is while every guard passes. Starting opens the confirm; without a fresh
 * step-up the API client asks for the password and replays the send, as for every R3 action. The
 * server re-checks every guard and answers a 409 with one sentence when one fails (or a 503 when
 * the command could not be sent), shown as the refusal.
 */
export function useForceContinue(
  deviceId: number,
  forceContinue: ForceContinue | undefined,
): ForceContinueController {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const supported = forceContinue?.supported ?? false;
  const offered = supported && (forceContinue?.offered ?? false);
  const blockers = forceContinue?.blockers ?? [];
  const quietBlockers = supported && !offered && pausedButBlocked(blockers);

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

  // An open confirm stays up when a refresh withdraws the offer: its button disables instead.
  const dialog = (
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
      <ul className="m-0 flex list-none flex-col rounded-md bg-raised px-4 py-1 text-foreground">
        {FORCE_CONTINUE_CHECKLIST.map(item => {
          const ok = checklistPasses(item, blockers);
          return (
            <li
              key={item.label}
              className="flex min-h-11 items-center gap-3 [&+&]:border-t [&+&]:border-rule"
            >
              <Icon
                name={ok ? 'check' : 'close'}
                size={16}
                strokeWidth={2}
                className={ok ? 'flex-none text-positive' : 'flex-none text-negative'}
              />
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
        Look at the box before you continue. If a cat steps inside, the box stops again on its own;
        this app never overrides that.
      </RiskNotice>
      <p className="text-xs text-muted-foreground">
        Asks for your password first. Refused while a cat is inside or the lid is open.
      </p>
    </ConfirmDialog>
  );

  return {
    offered,
    quietBlockers,
    blockers,
    visible: supported && (offered || quietBlockers || refusal !== null || confirming),
    busy,
    refusal,
    start: () => {
      setRefusal(null);
      setConfirming(true);
    },
    dialog,
  };
}

/** The force-continue rows of the Automation card, and the confirm. */
export function ForceContinueBlock({ controller: c }: { controller: ForceContinueController }) {
  if (!c.visible) return null;
  return (
    <section className="flex min-w-0 flex-col" aria-label="Force continue">
      {c.offered && (
        <div className="flex min-h-13 flex-wrap items-center gap-3 py-2">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex flex-wrap items-center gap-2">
              Paused <StepUpPill>Step-up</StepUpPill>
            </span>
            <span className="text-xs text-muted-foreground">
              The box stopped because it saw a cat near the entrance.
            </span>
          </span>
          <Button variant="secondary" size="small" disabled={c.busy} onClick={c.start}>
            Force continue
          </Button>
        </div>
      )}
      {c.quietBlockers && (
        <p className="py-2 text-sm text-muted-foreground">
          Paused. Force continue is not offered: {c.blockers.map(b => b.message).join(' ')}
        </p>
      )}
      {c.refusal && (
        <div
          role="alert"
          className="my-2 flex items-start gap-2.5 rounded-lg bg-raised px-3.5 py-3 text-lede"
        >
          <Icon
            name="warning"
            size={16}
            strokeWidth={2}
            className="mt-0.5 flex-none text-warning"
          />
          <p>{c.refusal}</p>
        </div>
      )}
      {c.dialog}
    </section>
  );
}
