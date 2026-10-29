import { useId, useState, type SyntheticEvent } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { Button, Select, StackedField, TextInput } from '@/shared/ui';
import { useCreatePet } from '../api';
import type { DeviceSummary } from '../pet-model';
import { PetsModal } from './pets-modal';

interface AddPetDialogProps {
  open: boolean;
  onClose: () => void;
  /** The AI-capable devices a new pet can be assigned to. */
  devices: readonly DeviceSummary[];
  notify: (text: string, error?: boolean) => void;
}

/** Name a new pet and assign it to one recognising device. */
export function AddPetDialog({ open, onClose, devices, notify }: AddPetDialogProps) {
  const [name, setName] = useState('');
  const [deviceId, setDeviceId] = useState(String(devices[0]?.id ?? ''));
  const [error, setError] = useState<string | null>(null);
  const create = useCreatePet();
  // The name field is the first focusable element, so the sheet opens on it.
  const nameId = useId();

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the pet a name.');
      document.getElementById(nameId)?.focus();
      return;
    }
    const id = Number(deviceId);
    create.mutate(
      { name: trimmed, device_ids: deviceId && Number.isFinite(id) ? [id] : [] },
      {
        onSuccess: () => {
          notify(`Added ${trimmed}`);
          setName('');
          setError(null);
          onClose();
        },
        onError: e => {
          setError(errorMessage(e));
        },
      },
    );
  };

  return (
    <PetsModal open={open} title="Add a pet" onClose={onClose} busy={create.isPending}>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <p className="text-muted-foreground">
          Then give it a few face photos. Until then the device records visits without saying who
          made them.
        </p>
        <StackedField label="Name">
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
          <StackedField label="Recognised by">
            <Select
              value={deviceId}
              onChange={e => {
                setDeviceId(e.target.value);
              }}
              options={devices.map(d => ({ value: String(d.id), label: d.name || `#${d.id}` }))}
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
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            Add pet
          </Button>
        </div>
      </form>
    </PetsModal>
  );
}
