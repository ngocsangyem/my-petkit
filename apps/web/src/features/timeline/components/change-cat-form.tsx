import { useId, useState, type ReactNode, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Panel, PetAvatar, Switch } from '@/shared/ui';
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

/** A choice row of the raised panel, its radio first; rows are split by a 1px rule. */
const ROW =
  'flex min-h-13 cursor-pointer items-center gap-3 border-t border-rule py-2 first:border-t-0';

function ChoiceRow({ value, children }: { value: string; children: ReactNode }) {
  const labelId = useId();
  return (
    <label className={ROW}>
      <RadioGroupItem value={value} aria-labelledby={labelId} className="size-4.5" />
      <span id={labelId} className="flex min-w-0 flex-1 items-center gap-3">
        {children}
      </span>
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

/**
 * Who used the box: the household's cats nearest weight first and "just passing" in one raised
 * panel, then the options that apply to the chosen cat, the actions and what saving changes.
 */
export function ChangeCatForm({
  session: s,
  pets,
  busy,
  error,
  onSave,
  onCancel,
}: ChangeCatFormProps) {
  const { t } = useTranslation(['timeline', 'common']);
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
      <p className="-mt-2 text-md text-lede">{changeCatContext(s)}</p>
      <Panel padding="none" className="px-4 py-1">
        <RadioGroup
          aria-label={t('changeCat.cat')}
          className="gap-0"
          value={choice}
          onValueChange={value => {
            setChoice(String(value));
          }}
          disabled={busy}
        >
          {candidates.map(c => (
            <ChoiceRow key={c.pet.id} value={String(c.pet.id)}>
              <PetAvatar photoUrl={c.pet.faces[0]?.url} size={36} />
              <span className="flex min-w-0 flex-col">
                <span className="font-medium [overflow-wrap:anywhere]">{c.pet.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {[
                    c.registered ?? t('changeCat.noRegistered'),
                    c.closest ? t('changeCat.closest') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            </ChoiceRow>
          ))}
          <ChoiceRow value={PASSING}>
            <PetAvatar photoUrl={null} size={36} />
            {t('changeCat.passing')}
          </ChoiceRow>
        </RadioGroup>
      </Panel>

      {picked && hasVisitWeight(s) && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <label htmlFor={weightId}>{t('changeCat.useWeight', { name: picked.name })}</label>
            <span id={weightHintId} className="text-xs text-muted-foreground tabular-nums">
              {t('changeCat.useWeightHint', { weight: visitWeight })}
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
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox
            className="mt-0.5 size-4.5"
            aria-labelledby={refId}
            aria-describedby={refHintId}
            checked={applyToRef}
            onCheckedChange={setApplyToRef}
            disabled={busy}
          />
          <span className="flex min-w-0 flex-col">
            <span id={refId} className="text-sm">
              {t('changeCat.applyRef')}
            </span>
            <span id={refHintId} className="text-xs text-muted-foreground">
              {t('changeCat.applyRefHint', { name: picked.name })}
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
        <Button onClick={onCancel} disabled={busy}>
          {t('common:cancel')}
        </Button>
        <Button type="submit" variant="primary" disabled={busy || choice === ''}>
          {t('common:save')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('changeCat.note')}</p>
    </form>
  );
}
