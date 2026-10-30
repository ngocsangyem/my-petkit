import { useId, useState, type ReactNode, type SyntheticEvent } from 'react';
import { Button, Switch } from '@/shared/ui';
import { Checkbox } from '@/shared/ui/shadcn/checkbox';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/shadcn/radio-group';
import type { TimelinePet, VisitPetRequest } from '../api';
import { formatWeight, type TimelineSession } from '../timeline-model';
import {
  changeCatContext,
  hasVisitWeight,
  initialChoice,
  PASSING,
  rankCandidates,
  visitPetBody,
} from '../visit-pet-model';
import { PetAvatar } from './pet-avatar';

/** A choice row: the chosen one gets the accent edge, the one selected state the design allows. */
const ROW =
  'flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-border bg-raised px-3.5 py-2 has-data-checked:border-data';

function ChoiceRow({ value, children }: { value: string; children: ReactNode }) {
  const labelId = useId();
  return (
    <label className={ROW}>
      <span id={labelId} className="flex min-w-0 flex-1 items-center gap-3">
        {children}
      </span>
      <RadioGroupItem value={value} aria-labelledby={labelId} />
    </label>
  );
}

export interface ChangeCatFormProps {
  session: TimelineSession;
  pets: readonly TimelinePet[];
  busy: boolean;
  /** The server's refusal of the last save, shown inside the sheet. */
  error: string | null;
  onSave: (body: VisitPetRequest) => void;
  onCancel: () => void;
}

/** Who used the box: the household's cats nearest weight first, "just passing", and the options. */
export function ChangeCatForm({
  session: s,
  pets,
  busy,
  error,
  onSave,
  onCancel,
}: ChangeCatFormProps) {
  const [choice, setChoice] = useState(() => initialChoice(s));
  const [useWeight, setUseWeight] = useState(false);
  const [applyToRef, setApplyToRef] = useState(false);
  const weightId = useId();
  const weightHintId = useId();
  const refId = useId();
  const refHintId = useId();
  const candidates = rankCandidates(pets, s.weight);
  const picked = pets.find(p => String(p.id) === choice) ?? null;
  const visitWeight = formatWeight(s.weight);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (choice === '') return;
    onSave(visitPetBody(s, choice, useWeight, applyToRef));
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <p className="text-muted-foreground">{changeCatContext(s)}</p>
      <RadioGroup
        aria-label="Cat"
        value={choice}
        onValueChange={value => {
          setChoice(String(value));
        }}
        disabled={busy}
      >
        {candidates.map(c => (
          <ChoiceRow key={c.pet.id} value={String(c.pet.id)}>
            <PetAvatar photoUrl={c.pet.faces[0]?.url} />
            <span className="flex min-w-0 flex-col">
              <span className="font-medium [overflow-wrap:anywhere]">{c.pet.name}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {[c.registered ?? 'No registered weight', c.closest ? 'closest weight' : null]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          </ChoiceRow>
        ))}
        <ChoiceRow value={PASSING}>No cat, just passing</ChoiceRow>
      </RadioGroup>

      {picked && hasVisitWeight(s) && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <label htmlFor={weightId} className="font-medium">
              Use this for {picked.name}&apos;s weight
            </label>
            <span id={weightHintId} className="text-sm text-muted-foreground tabular-nums">
              Updates the registered weight to {visitWeight}.
            </span>
          </div>
          <Switch
            id={weightId}
            aria-describedby={weightHintId}
            checked={useWeight}
            onCheckedChange={setUseWeight}
            disabled={busy}
          />
        </div>
      )}

      {picked && s.unbound_pet_ref !== null && (
        <label className="flex cursor-pointer items-start gap-2.5">
          <Checkbox
            className="mt-0.5"
            aria-labelledby={refId}
            aria-describedby={refHintId}
            checked={applyToRef}
            onCheckedChange={setApplyToRef}
            disabled={busy}
          />
          <span className="flex min-w-0 flex-col">
            <span id={refId}>Also use for later visits with this identity</span>
            <span id={refHintId} className="text-sm text-muted-foreground">
              The box reported an identity no cat holds yet; it will name {picked.name} from now on.
            </span>
          </span>
        </label>
      )}

      {error && (
        <p className="text-sm text-negative" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="large" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="large" disabled={busy || choice === ''}>
          Save
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Changes this record only. Nothing is sent to the litter box.
      </p>
    </form>
  );
}
