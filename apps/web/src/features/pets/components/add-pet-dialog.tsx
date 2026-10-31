import { useId, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Select, StackedField, TextInput } from '@/shared/ui';
import { useCreatePet } from '../api';
import type { DeviceSummary } from '../pet-model';
import { deviceLoadText, isDeviceFull, petSaveError } from '../pet-weight-model';
import { PetsModal } from './pets-modal';

interface AddPetDialogProps {
  open: boolean;
  onClose: () => void;
  /** The AI-capable devices a new pet can be assigned to. */
  devices: readonly DeviceSummary[];
  /** How many pets each device recognises; a full box cannot take another. */
  load: ReadonlyMap<number, number>;
  notify: (text: string, error?: boolean) => void;
}

/** Name a new pet and assign it to one recognising device. */
export function AddPetDialog({ open, onClose, devices, load, notify }: AddPetDialogProps) {
  const { t } = useTranslation(['pets', 'common']);
  const [name, setName] = useState('');
  const [deviceId, setDeviceId] = useState(() => {
    const room = devices.find(d => !isDeviceFull(load, d.id)) ?? devices[0];
    return String(room?.id ?? '');
  });
  const [error, setError] = useState<string | null>(null);
  const create = useCreatePet();
  // The name field is the first focusable element, so the sheet opens on it.
  const nameId = useId();

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('add.needName'));
      document.getElementById(nameId)?.focus();
      return;
    }
    const id = Number(deviceId);
    create.mutate(
      { name: trimmed, device_ids: deviceId && Number.isFinite(id) ? [id] : [] },
      {
        onSuccess: () => {
          notify(t('add.added', { name: trimmed }));
          setName('');
          setError(null);
          onClose();
        },
        onError: e => {
          setError(petSaveError(e));
        },
      },
    );
  };

  return (
    <PetsModal open={open} title={t('add.title')} onClose={onClose} busy={create.isPending}>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <p className="text-muted-foreground">{t('add.intro')}</p>
        <StackedField label={t('add.name')}>
          <TextInput
            id={nameId}
            value={name}
            maxLength={64}
            aria-invalid={error !== null && !name.trim()}
            onChange={e => {
              setName(e.target.value);
            }}
          />
        </StackedField>
        {devices.length > 0 && (
          <StackedField label={t('add.recognisedBy')}>
            <Select
              value={deviceId}
              onChange={e => {
                setDeviceId(e.target.value);
              }}
              options={devices.map(d => ({
                value: String(d.id),
                label: `${d.name || `#${d.id}`} · ${deviceLoadText(load.get(d.id) ?? 0)}`,
                disabled: isDeviceFull(load, d.id),
              }))}
            />
          </StackedField>
        )}
        {error && (
          <p className="text-sm text-negative" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onClose} disabled={create.isPending}>
            {t('common:cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {t('add.submit')}
          </Button>
        </div>
      </form>
    </PetsModal>
  );
}
