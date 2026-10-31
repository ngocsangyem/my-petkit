import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '@/shared/api/errors';
import { Button, IconButton, SectionCard, Switch } from '@/shared/ui';
import { useUpdatePetWeight } from '../api';
import { parseIdList, type DeviceDetail, type DeviceSummary, type Pet } from '../pet-model';
import {
  DEFAULT_TOLERANCE_G,
  deviceLoadText,
  gramsToKgText,
  matchGuardSentence,
  weightUpdatedWhen,
} from '../pet-weight-model';
import { PetNameEditor } from './pet-name-editor';

/** One row: words on the left (with a muted line under them), the value and its control right. */
function Row({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-13 items-center gap-3 border-t border-rule py-2 first:border-t-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="[overflow-wrap:anywhere]">{label}</span>
        {hint && <span className="text-xs text-muted-foreground tabular-nums">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

interface PetProfileCardProps {
  pet: Pet;
  devices: readonly DeviceSummary[];
  aiDetails: readonly DeviceDetail[];
  /** How many pets each device recognises, for the per-box limit. */
  load: ReadonlyMap<number, number>;
  editingName: boolean;
  renaming: boolean;
  onRename: () => void;
  onNameDone: (name: string | null) => void;
  /** Opens the weight dialog: registered weight, matching and tolerance. */
  onEditWeight: () => void;
  onDelete: () => void;
  notify: (text: string, error?: boolean) => void;
}

/**
 * "Profile and recognition": the name, the registered weight, matching by weight with its real
 * guard (twice this cat's tolerance), the tolerance, the boxes it is on with their 15-cat
 * capacity, the identities bound to it, and removing it.
 */
export function PetProfileCard({
  pet,
  devices,
  aiDetails,
  load,
  editingName,
  renaming,
  onRename,
  onNameDone,
  onEditWeight,
  onDelete,
  notify,
}: PetProfileCardProps) {
  const { t } = useTranslation('pets');
  const save = useUpdatePetWeight();
  const deviceIds = parseIdList(pet.device_ids_json);
  const aliases = parseIdList(pet.device_pet_ids_json);
  const updated = weightUpdatedWhen(pet.weight_updated_at);
  const matching = pet.weight_match !== 0;

  return (
    <SectionCard title={t('profile.title')}>
      <div className="flex flex-col">
        <Row label={t('profile.name')}>
          {editingName ? (
            <PetNameEditor name={pet.name} onDone={onNameDone} />
          ) : (
            <span className="[overflow-wrap:anywhere]">{pet.name}</span>
          )}
          <IconButton
            icon="edit"
            variant="ghost"
            aria-label={t('profile.rename')}
            disabled={editingName || renaming}
            onClick={onRename}
          />
        </Row>
        <Row
          label={t('profile.registeredWeight')}
          hint={updated ? t('profile.updated', { when: updated }) : t('profile.notSet')}
        >
          <span className="tabular-nums">
            {pet.weight_g === null ? '—' : `${gramsToKgText(pet.weight_g)} kg`}
          </span>
          <IconButton
            icon="edit"
            variant="ghost"
            aria-label={t('profile.editWeight')}
            onClick={onEditWeight}
          />
        </Row>
        <Row
          label={
            <label htmlFor={`pet-${String(pet.id)}-match`}>{t('profile.matchByWeight')}</label>
          }
          hint={matchGuardSentence(pet.weight_tolerance_g)}
        >
          <Switch
            id={`pet-${String(pet.id)}-match`}
            checked={matching}
            disabled={save.isPending}
            onCheckedChange={on => {
              save.mutate(
                { id: pet.id, body: { weight_match: on } },
                {
                  onSuccess: () => {
                    notify(t('profile.savedWeight', { name: pet.name }));
                  },
                  onError: e => {
                    notify(errorMessage(e), true);
                  },
                },
              );
            }}
          />
        </Row>
        <Row
          label={t('profile.tolerance')}
          hint={pet.weight_tolerance_g === null ? t('profile.defaultTolerance') : undefined}
        >
          <span className="text-muted-foreground tabular-nums">
            ± {pet.weight_tolerance_g ?? DEFAULT_TOLERANCE_G} g
          </span>
          <IconButton
            icon="edit"
            variant="ghost"
            aria-label={t('profile.editTolerance')}
            onClick={onEditWeight}
          />
        </Row>
        {deviceIds.length === 0 ? (
          <Row label={t('profile.devices')} hint={t('profile.noDevices')} />
        ) : (
          deviceIds.map(id => {
            const name = devices.find(d => d.id === id)?.name || `#${String(id)}`;
            const detail = aiDetails.find(d => d.id === id);
            // An assignment to a box that is not recognising is real but idle; without the
            // mark a pet on two devices looks equally active on both.
            const off = detail ? detail.aiInfo?.ai_enabled === false : false;
            return (
              <Row
                key={id}
                label={off ? t('profile.recognitionOff', { name }) : name}
                hint={deviceLoadText(load.get(id) ?? 0)}
              />
            );
          })
        )}
        <Row
          label={t('profile.boundIdentities')}
          hint={
            aliases.length ? t('profile.alias', { ids: aliases.join(', ') }) : t('profile.noAlias')
          }
        />
        <div className="border-t border-rule pt-2">
          <Button variant="destructive" className="-ml-4" onClick={onDelete}>
            {t('profile.delete', { name: pet.name })}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
