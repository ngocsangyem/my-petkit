import { useState } from 'react';
import { ConfirmDialog } from '@/shared/ui';
import { type DeviceDetail, deviceKeys } from '../api';
import { deleteDevice } from '../api-calls';
import { useDeviceCall } from '../hooks/use-device-call';
import { FeedbackLine } from './panel-parts';

/**
 * The "Remove device" row: deletes the device from the registry after a question. Events and
 * media are kept. `onRemoved` leaves the page of a device that no longer exists.
 */
export function RemoveDevice({
  device,
  onRemoved,
}: {
  device: DeviceDetail;
  onRemoved?: () => void;
}) {
  const call = useDeviceCall();
  const [asking, setAsking] = useState(false);
  const label = `${device.type.toUpperCase()} ${device.sn || String(device.id)}`;
  return (
    <div className="flex min-w-0 flex-col border-t border-rule">
      <button
        type="button"
        className="flex min-h-13 w-full items-center border-0 bg-transparent p-0 text-left text-negative disabled:opacity-50"
        disabled={call.busy}
        onClick={() => {
          setAsking(true);
        }}
      >
        Remove device
      </button>
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
            .then(ok => {
              setAsking(false);
              if (ok) onRemoved?.();
            });
        }}
      >
        <p>
          This permanently deletes the device from the registry and removes all its Home Assistant
          entities. Events and media are kept. A device that is still running signs up again on its
          own.
        </p>
      </ConfirmDialog>
    </div>
  );
}
