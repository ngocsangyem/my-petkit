import { useState } from 'react';
import { Button, ConfirmDialog, Table } from '@/shared/ui';
import { type DeviceDetail, deviceKeys } from '../api';
import { importBle, unpairBle } from '../api-calls';
import { useDeviceCall } from '../hooks/use-device-call';
import type { OpenState, SetOpen } from '../hooks/use-open-state';
import { BlePairForm } from './ble-pair-form';
import { BlockHeading, Disclosure, FeedbackLine } from './panel-parts';

type Child = DeviceDetail['ble'][number];

/** Unpair with a confirm; shared by the parent's list and the accessory's own panel. */
export function useUnpair(parentId: number | null) {
  const call = useDeviceCall();
  const [asking, setAsking] = useState<{ id: number; name: string } | null>(null);
  const refresh = [
    deviceKeys.ble,
    deviceKeys.list,
    ...(parentId ? [deviceKeys.detail(parentId)] : []),
  ];
  const dialog = (
    <ConfirmDialog
      open={asking !== null}
      title={`Unpair the ${asking?.name ?? 'accessory'}?`}
      confirmLabel="Unpair"
      busy={call.busy}
      onCancel={() => {
        setAsking(null);
      }}
      onConfirm={() => {
        const target = asking;
        if (!target) return;
        void call
          .run(() => unpairBle(target.id), refresh)
          .then(() => {
            setAsking(null);
          });
      }}
    >
      <p>
        The relay stops reading it. Its Home Assistant entities stay until you delete the device
        there.
      </p>
    </ConfirmDialog>
  );
  return { call, ask: setAsking, dialog };
}

/**
 * Bluetooth accessories this device relays for. A Pura Air spray or an EverSweet
 * fountain has no network of its own; this device speaks to it over Bluetooth.
 */
export function BleSection({
  device,
  isOpen,
  setOpen,
}: {
  device: DeviceDetail;
  isOpen: OpenState;
  setOpen: SetOpen;
}) {
  const unpair = useUnpair(device.id);
  const importer = useDeviceCall();
  const pairKey = `d${device.id}:blepair`;
  return (
    <section className="flex min-w-0 flex-col gap-2.5" aria-label="Bluetooth accessories">
      <BlockHeading title="Bluetooth accessories" aside="Relayed by this device" />
      <Table<Child>
        label="Paired accessories"
        variant="compact"
        rows={device.ble}
        rowKey={b => String(b.id)}
        emptyText="Nothing paired."
        columns={[
          { key: 'type', header: 'Accessory', cell: b => b.type.toUpperCase() },
          { key: 'id', header: 'Id', cell: b => b.id, mono: true, muted: true },
          { key: 'mac', header: 'Bluetooth address', cell: b => b.mac, mono: true },
          {
            key: 'unpair',
            header: 'Action',
            hiddenHeader: true,
            alignEnd: true,
            cell: b => (
              <Button
                variant="destructive"
                size="small"
                disabled={unpair.call.busy}
                onClick={() => {
                  unpair.ask({ id: b.id, name: b.type.toUpperCase() });
                }}
              >
                Unpair
              </Button>
            ),
          },
        ]}
      />
      <FeedbackLine feedback={unpair.call.feedback} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={importer.busy}
          onClick={() =>
            void importer.run(
              () => importBle(device.id),
              [deviceKeys.ble, deviceKeys.list, deviceKeys.detail(device.id)],
            )
          }
        >
          {importer.busy ? 'Asking PetKit…' : 'Import from PetKit'}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Asks PetKit which accessories this device owns and copies each one’s Bluetooth address and
        pairing secret across. Nothing is sent to PetKit until you press it.
      </p>
      <FeedbackLine feedback={importer.feedback} />
      <Disclosure
        summary="Pair an accessory"
        open={isOpen(pairKey, false)}
        onOpenChange={open => {
          setOpen(pairKey, open);
        }}
      >
        <BlePairForm parentId={device.id} />
      </Disclosure>
      {unpair.dialog}
    </section>
  );
}
