import { useId, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Switch } from '@/shared/ui';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/shadcn/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/shared/ui/shadcn/input-group';
import { useUpdatePetWeight } from '../api';
import { parseIdList, type DeviceSummary, type Pet } from '../pet-model';
import {
  DEFAULT_TOLERANCE_G,
  deviceLoadText,
  matchGuardSentence,
  parseKgText,
  parseToleranceText,
  petSaveError,
  weightDraft,
  weightUpdateBody,
  weightUpdatedText,
  type WeightDraft,
} from '../pet-weight-model';
import { PetsModal } from './pets-modal';

const NUMBER = 'text-right tabular-nums';

interface PetWeightDialogProps {
  pet: Pet;
  devices: readonly DeviceSummary[];
  /** How many pets each device recognises. */
  load: ReadonlyMap<number, number>;
  onClose: () => void;
  notify: (text: string, error?: boolean) => void;
}

/** A pet's registered weight, whether visits may be matched to it by weight, and how loosely. */
export function PetWeightDialog({ pet, devices, load, onClose, notify }: PetWeightDialogProps) {
  const { t } = useTranslation(['pets', 'common']);
  const [draft, setDraft] = useState<WeightDraft>(() => weightDraft(pet));
  const [error, setError] = useState<string | null>(null);
  const save = useUpdatePetWeight();
  const busy = save.isPending;
  const weightId = useId();
  const weightHintId = useId();
  const matchId = useId();
  const matchHintId = useId();
  const toleranceId = useId();
  const toleranceHintId = useId();
  const weight = parseKgText(draft.weightKg);
  const tolerance = parseToleranceText(draft.toleranceG);
  const guardTolerance = tolerance.ok ? tolerance.value : pet.weight_tolerance_g;
  const updated = weightUpdatedText(pet.weight_updated_at);
  const assigned = parseIdList(pet.device_ids_json);
  const edit = (patch: Partial<WeightDraft>) => {
    setDraft(d => ({ ...d, ...patch }));
  };

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const body = weightUpdateBody(pet, draft);
    if (body === null) return;
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    setError(null);
    save.mutate(
      { id: pet.id, body },
      {
        onSuccess: () => {
          notify(t('profile.savedWeight', { name: pet.name }));
          onClose();
        },
        onError: e => {
          setError(petSaveError(e));
        },
      },
    );
  };

  return (
    <PetsModal
      open
      title={t('weight.dialogTitle', { name: pet.name })}
      onClose={onClose}
      busy={busy}
    >
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
        <Field className="gap-1.5" data-invalid={!weight.ok || undefined}>
          <FieldLabel htmlFor={weightId}>{t('profile.registeredWeight')}</FieldLabel>
          <div className="flex flex-wrap items-center gap-3">
            <InputGroup className="max-w-40">
              <InputGroupInput
                id={weightId}
                inputMode="decimal"
                className={NUMBER}
                aria-describedby={weightHintId}
                aria-invalid={!weight.ok || undefined}
                disabled={busy}
                value={draft.weightKg}
                onChange={e => {
                  edit({ weightKg: e.target.value });
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>kg</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            {updated && <span className="text-sm text-muted-foreground">{updated}</span>}
          </div>
          {!weight.ok && <FieldError>{weight.error}</FieldError>}
          <FieldDescription id={weightHintId}>{t('weight.hint')}</FieldDescription>
        </Field>

        <section className="flex flex-col gap-4" aria-labelledby={`${matchId}-h`}>
          <h3 id={`${matchId}-h`} className="text-lg font-semibold">
            {t('weight.recognition')}
          </h3>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <label htmlFor={matchId} className="font-medium">
                {t('profile.matchByWeight')}
              </label>
              <span id={matchHintId} className="text-sm text-muted-foreground tabular-nums">
                {matchGuardSentence(guardTolerance)}
              </span>
            </div>
            <Switch
              id={matchId}
              aria-describedby={matchHintId}
              checked={draft.match}
              disabled={busy}
              onCheckedChange={match => {
                edit({ match });
              }}
            />
          </div>
          <Field className="gap-1.5" data-invalid={!tolerance.ok || undefined}>
            <FieldLabel htmlFor={toleranceId}>{t('profile.tolerance')}</FieldLabel>
            <InputGroup className="max-w-40">
              <InputGroupAddon>
                <InputGroupText>±</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id={toleranceId}
                inputMode="numeric"
                className={NUMBER}
                placeholder={String(DEFAULT_TOLERANCE_G)}
                aria-describedby={toleranceHintId}
                aria-invalid={!tolerance.ok || undefined}
                disabled={busy}
                value={draft.toleranceG}
                onChange={e => {
                  edit({ toleranceG: e.target.value });
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>g</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            {!tolerance.ok && <FieldError>{tolerance.error}</FieldError>}
            <FieldDescription id={toleranceHintId}>
              {t('weight.toleranceHint', { grams: DEFAULT_TOLERANCE_G })}
            </FieldDescription>
          </Field>
        </section>

        {assigned.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {assigned.map(id => (
              <li key={id} className="flex justify-between gap-3">
                <span>{devices.find(d => d.id === id)?.name || `#${id}`}</span>
                <span className="text-muted-foreground tabular-nums">
                  {deviceLoadText(load.get(id) ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="text-sm text-negative" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>
            {t('common:cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !weight.ok || !tolerance.ok}>
            {t('common:save')}
          </Button>
        </div>
      </form>
    </PetsModal>
  );
}
