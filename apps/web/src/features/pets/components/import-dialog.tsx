import { useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { Button, Select, StackedField } from '@/shared/ui';
import { useImportPets } from '../api';
import { importSummary, type DeviceSummary } from '../pet-model';
import { PetsModal } from './pets-modal';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** The AI-capable devices; PetKit holds a recognition set per device. */
  devices: readonly DeviceSummary[];
  notify: (text: string, error?: boolean) => void;
}

/**
 * Import pets from the PetKit account. This reaches out to PetKit, signed as
 * the device, and downloads photographs, so it runs only when confirmed here
 * and never on a page load.
 */
export function ImportDialog({ open, onClose, devices, notify }: ImportDialogProps) {
  const [deviceId, setDeviceId] = useState(String(devices[0]?.id ?? ''));
  const [error, setError] = useState<string | null>(null);
  const run = useImportPets();

  const confirm = () => {
    const id = Number(deviceId);
    if (!deviceId || !Number.isFinite(id)) {
      setError('Choose a device.');
      return;
    }
    setError(null);
    run.mutate(id, {
      onSuccess: r => {
        notify(importSummary(r.results));
        onClose();
      },
      onError: e => {
        setError(errorMessage(e));
      },
    });
  };

  return (
    <PetsModal
      open={open}
      title="Import pets from your PetKit account?"
      onClose={onClose}
      busy={run.isPending}
    >
      <div className="ui-dialog__body">
        <p>
          This asks PetKit which pets the device recognises and downloads their reference photos.
          Each arrives as a new pet with PetKit's id bound to it, so events the device already
          recorded under that id get named too.
        </p>
        <p>
          Imported pets are called “PetKit pet” and a number: the name is not in the data a device
          receives, so rename them afterwards. Nothing is sent until you press Import.
        </p>
      </div>
      {devices.length > 1 ? (
        <StackedField label="Device">
          <Select
            value={deviceId}
            onChange={e => {
              setDeviceId(e.target.value);
            }}
            options={devices.map(d => ({ value: String(d.id), label: d.name || `#${d.id}` }))}
          />
        </StackedField>
      ) : (
        <p className="pets-small">Device: {devices[0]?.name || `#${deviceId}`}</p>
      )}
      {run.isPending && (
        <p className="pets-muted pets-small" role="status">
          Asking PetKit and fetching the photos…
        </p>
      )}
      {error && (
        <p className="pets-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="ui-dialog__actions">
        <Button onClick={onClose} disabled={run.isPending}>
          Cancel
        </Button>
        <Button variant="primary" onClick={confirm} disabled={run.isPending}>
          Import
        </Button>
      </div>
    </PetsModal>
  );
}
