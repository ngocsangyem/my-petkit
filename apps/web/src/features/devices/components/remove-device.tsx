import { useState } from 'react';
import { Button, ConfirmDialog } from '@/shared/ui';
import { type DeviceDetail, deviceKeys } from '../api';
import { deleteDevice } from '../api-calls';
import { useDeviceCall } from '../hooks/use-device-call';
import { FeedbackLine } from './panel-parts';

/** Deletes the device from the registry, after a question. Events and media are kept. */
export function RemoveDevice({ device }: { device: DeviceDetail }) {
  const call = useDeviceCall();
  const [asking, setAsking] = useState(false);
  const label = `${device.type.toUpperCase()} ${device.sn || String(device.id)}`;
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <p className="text-sm text-muted-foreground">
        Permanently deletes this device from the registry and removes its Home Assistant entities.
        Events and media are kept. A device that is still running signs up again on its own.
      </p>
      <div>
        <Button
          variant="destructive"
          disabled={call.busy}
          onClick={() => {
            setAsking(true);
          }}
        >
          Delete device
        </Button>
      </div>
      <FeedbackLine feedback={call.feedback} />
      <ConfirmDialog
        open={asking}
        title={`Delete ${label}?`}
        confirmLabel="Delete device"
        busy={call.busy}
        onCancel={() => {
          setAsking(false);
        }}
        onConfirm={() => {
          void call
            .run(
              () => deleteDevice(device.id),
              [deviceKeys.list, deviceKeys.ble, deviceKeys.details],
            )
            .then(() => {
              setAsking(false);
            });
        }}
      >
        <p>
          This removes the device from the registry and all its Home Assistant entities. Events and
          media are kept.
        </p>
      </ConfirmDialog>
    </div>
  );
}
