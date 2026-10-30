import { useId } from 'react';
import { Select, Switch, TimeInput } from '@/shared/ui';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/shadcn/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/shared/ui/shadcn/input-group';
import type { AutoPackRule, AutoPackTrigger } from './litter-automation-api';
import { TRIGGER_LABELS } from './litter-automation-text';

/** The rule as edited: the cleanings field may be empty while someone types. */
export type AutoPackDraft = Omit<AutoPackRule, 'cleanings'> & { cleanings: number | null };

const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
export const MIN_CLEANINGS = 1;
export const MAX_CLEANINGS = 50;
const DEFAULT_QUIET = { start: '22:00', end: '07:00' } as const;

function cleaningsValid(n: number | null): n is number {
  return n !== null && Number.isInteger(n) && n >= MIN_CLEANINGS && n <= MAX_CLEANINGS;
}

/**
 * The full rule the API takes, or null while a shown field is out of range. Every field goes,
 * always; a threshold the chosen trigger hides keeps its saved value if its edit is unusable.
 */
export function draftToRule(draft: AutoPackDraft, saved: AutoPackRule): AutoPackRule | null {
  const cleanings =
    draft.trigger !== 'after_cleanings' && !cleaningsValid(draft.cleanings)
      ? saved.cleanings
      : draft.cleanings;
  const at = draft.trigger !== 'daily_at' && !TIME.test(draft.at) ? saved.at : draft.at;
  const { quietHours } = draft;
  if (!cleaningsValid(cleanings) || !TIME.test(at)) return null;
  if (quietHours && (!TIME.test(quietHours.start) || !TIME.test(quietHours.end))) return null;
  return { ...draft, cleanings, at };
}

interface AutoPackRuleFieldsProps {
  draft: AutoPackDraft;
  onChange: (patch: Partial<AutoPackDraft>) => void;
  disabled: boolean;
}

/** When the rule packs: the trigger, its threshold (none for a full bin) and optional quiet hours. */
export function AutoPackRuleFields({ draft, onChange, disabled }: AutoPackRuleFieldsProps) {
  const triggerId = useId();
  const thresholdId = useId();
  const thresholdHintId = useId();
  const quietId = useId();
  const fromId = useId();
  const toId = useId();
  const cleaningsInvalid = !cleaningsValid(draft.cleanings);

  return (
    <FieldGroup className="gap-4">
      <Field className="gap-1.5">
        <FieldLabel htmlFor={triggerId}>Pack</FieldLabel>
        <Select
          id={triggerId}
          className="w-full max-w-80"
          disabled={disabled}
          value={draft.trigger}
          options={(Object.keys(TRIGGER_LABELS) as AutoPackTrigger[]).map(value => ({
            value,
            label: TRIGGER_LABELS[value],
          }))}
          onChange={e => {
            onChange({ trigger: e.target.value as AutoPackTrigger });
          }}
        />
      </Field>

      {draft.trigger === 'after_cleanings' && (
        <Field className="gap-1.5" data-invalid={cleaningsInvalid || undefined}>
          <FieldLabel htmlFor={thresholdId}>After</FieldLabel>
          <InputGroup className="max-w-44">
            <InputGroupInput
              id={thresholdId}
              type="number"
              inputMode="numeric"
              min={MIN_CLEANINGS}
              max={MAX_CLEANINGS}
              step={1}
              className="text-right tabular-nums"
              disabled={disabled}
              aria-describedby={thresholdHintId}
              aria-invalid={cleaningsInvalid || undefined}
              value={draft.cleanings ?? ''}
              onChange={e => {
                const raw = e.target.value.trim();
                onChange({ cleanings: raw === '' ? null : Number(raw) });
              }}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>cleanings</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription id={thresholdHintId}>
            {MIN_CLEANINGS} to {MAX_CLEANINGS}, counted from the last pack or from turning the rule
            on.
          </FieldDescription>
        </Field>
      )}

      {draft.trigger === 'daily_at' && (
        <Field className="gap-1.5">
          <FieldLabel htmlFor={thresholdId}>At</FieldLabel>
          <TimeInput
            id={thresholdId}
            disabled={disabled}
            aria-describedby={thresholdHintId}
            value={draft.at}
            onValueChange={at => {
              onChange({ at });
            }}
          />
          <FieldDescription id={thresholdHintId}>
            In the device&apos;s own time zone.
          </FieldDescription>
        </Field>
      )}

      <Field className="gap-1.5">
        <div className="flex items-center gap-2.5">
          <Switch
            id={quietId}
            disabled={disabled}
            checked={draft.quietHours !== null}
            onCheckedChange={on => {
              onChange({ quietHours: on ? { ...DEFAULT_QUIET } : null });
            }}
          />
          <FieldLabel htmlFor={quietId}>Quiet hours</FieldLabel>
        </div>
        {draft.quietHours && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor={fromId} className="text-muted-foreground">
              From
            </label>
            <TimeInput
              id={fromId}
              disabled={disabled}
              value={draft.quietHours.start}
              onValueChange={start => {
                if (draft.quietHours) onChange({ quietHours: { ...draft.quietHours, start } });
              }}
            />
            <label htmlFor={toId} className="text-muted-foreground">
              to
            </label>
            <TimeInput
              id={toId}
              disabled={disabled}
              value={draft.quietHours.end}
              onValueChange={end => {
                if (draft.quietHours) onChange({ quietHours: { ...draft.quietHours, end } });
              }}
            />
          </div>
        )}
        <FieldDescription>
          No automatic pack inside this window. An end before the start runs past midnight.
        </FieldDescription>
      </Field>
    </FieldGroup>
  );
}
