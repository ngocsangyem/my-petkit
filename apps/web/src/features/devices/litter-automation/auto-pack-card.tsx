import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { Button, ConfirmDialog, Icon, Panel, Pill, Switch, useToast } from '@/shared/ui';
import { Alert, AlertDescription } from '@/shared/ui/shadcn/alert';
import { type AutoPackDraft, AutoPackRuleFields, draftToRule } from './auto-pack-rule-fields';
import {
  type AutoPackRule,
  type AutoPackStatus,
  type LitterAutomation,
  litterAutomationKey,
  saveAutoPackRule,
} from './litter-automation-api';
import { autoPackStatusLine, ruleSummary } from './litter-automation-text';

const ADVICE =
  'PetKit’s own advice for automatic packing: have someone nearby when the box packs, and take the bag out promptly.';

interface AutoPackCardProps {
  deviceId: number;
  rule: AutoPackRule;
  status: AutoPackStatus;
}

/**
 * The T6's auto-pack rule (R1). Field edits stay local until Save, so a refresh
 * from the hub never replaces what someone is typing. The switch saves at once;
 * turning the rule on asks first and says what the box will do.
 */
export function AutoPackCard({ deviceId, rule: saved, status }: AutoPackCardProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const titleId = useId();
  const enabledId = useId();
  const [draft, setDraft] = useState<AutoPackDraft | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown: AutoPackDraft = draft ?? saved;
  const valid = draftToRule(shown, saved);

  const save = async (rule: AutoPackRule, done: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await saveAutoPackRule(deviceId, rule);
      queryClient.setQueryData<LitterAutomation>(
        litterAutomationKey(deviceId),
        old =>
          old && {
            ...old,
            autoPack: { supported: true, rule: result.rule, status: result.status },
          },
      );
      setDraft(null);
      toast(done);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
      setAsking(false);
    }
  };

  return (
    <div
      role="region"
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-4 border-t border-rule pt-3 pb-3 first:border-t-0 first:pt-0"
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={titleId} className="text-base font-normal">
              Auto-pack
            </h3>
            <Pill>Experimental</Pill>
          </div>
          <p className="text-xs text-muted-foreground">
            The box packs and seals the waste bag on its own when the rule says so. The server turns
            the rule off after a pack error or two unanswered packs, and never turns it on.
          </p>
        </div>
        <label htmlFor={enabledId} className="sr-only">
          Pack automatically
        </label>
        <Switch
          id={enabledId}
          checked={saved.enabled}
          disabled={busy || !valid}
          onCheckedChange={on => {
            if (on) setAsking(true);
            else if (valid) void save({ ...valid, enabled: false }, 'Auto-pack turned off');
          }}
        />
      </div>

      <AutoPackRuleFields
        draft={shown}
        disabled={busy}
        onChange={patch => {
          setDraft({ ...shown, ...patch });
        }}
      />

      <Panel className="flex items-start gap-2.5 text-lede">
        <Icon name="warning" size={16} strokeWidth={2} className="mt-0.5 flex-none text-warning" />
        <p>{ADVICE}</p>
      </Panel>

      <p role="status" className="min-h-[18px] text-sm text-muted-foreground">
        {autoPackStatusLine(saved, status)}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={busy || draft === null || !valid}
          onClick={() => {
            if (valid) void save(valid, 'Auto-pack rule saved');
          }}
        >
          Save rule
        </Button>
        {draft !== null && (
          <Button
            variant="text"
            disabled={busy}
            onClick={() => {
              setDraft(null);
              setError(null);
            }}
          >
            Discard changes
          </Button>
        )}
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>Not saved: {error}</AlertDescription>
        </Alert>
      )}

      <ConfirmDialog
        open={asking}
        title="Turn on auto-pack?"
        confirmLabel="Turn on"
        busy={busy}
        confirmDisabled={!valid}
        onConfirm={() => {
          if (valid) void save({ ...valid, enabled: true }, 'Auto-pack turned on');
        }}
        onCancel={() => {
          setAsking(false);
        }}
      >
        {valid && <p>{ruleSummary(valid)}</p>}
        <p>{ADVICE}</p>
        <p>Cleanings are counted from the moment it is turned on.</p>
      </ConfirmDialog>
    </div>
  );
}
