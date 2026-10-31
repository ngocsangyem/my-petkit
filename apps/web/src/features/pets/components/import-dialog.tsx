import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['pets', 'common']);
  const [deviceId, setDeviceId] = useState(String(devices[0]?.id ?? ''));
  const [error, setError] = useState<string | null>(null);
  const run = useImportPets();

  const confirm = () => {
    const id = Number(deviceId);
    if (!deviceId || !Number.isFinite(id)) {
      setError(t('import.chooseDevice'));
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
    <PetsModal open={open} title={t('import.title')} onClose={onClose} busy={run.isPending}>
      <div className="flex flex-col gap-2 text-muted-foreground">
        <p>{t('import.body')}</p>
        <p>{t('import.naming')}</p>
      </div>
      {devices.length > 1 ? (
        <StackedField label={t('import.device')}>
          <Select
            value={deviceId}
            onChange={e => {
              setDeviceId(e.target.value);
            }}
            options={devices.map(d => ({ value: String(d.id), label: d.name || `#${d.id}` }))}
          />
        </StackedField>
      ) : (
        <p className="text-sm">
          {t('import.deviceLine', { name: devices[0]?.name || `#${deviceId}` })}
        </p>
      )}
      {run.isPending && (
        <p className="text-sm text-muted-foreground" role="status">
          {t('import.asking')}
        </p>
      )}
      {error && (
        <p className="text-sm text-negative" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onClose} disabled={run.isPending}>
          {t('common:cancel')}
        </Button>
        <Button variant="primary" onClick={confirm} disabled={run.isPending}>
          {t('import.submit')}
        </Button>
      </div>
    </PetsModal>
  );
}
