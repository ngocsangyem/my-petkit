import { useId, useState } from 'react';
import { Link } from 'react-router';
import { relativeTime } from '@/shared/format/format';
import { Button, Card, ConfirmDialog, Icon } from '@/shared/ui';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/shared/ui/shadcn/sheet';
import { type BleAccessory, type DeviceDetail, deviceKeys } from '../api';
import { importBle, unpairBle } from '../api-calls';
import { useDeviceCall } from '../hooks/use-device-call';
import { accessoryKeyOf, useDeviceLinks } from '../lib/device-view';
import { epochSeconds } from '../lib/timestamps';
import { BlePairForm } from './ble-pair-form';
import { DeviceArt } from './device-art';
import { FeedbackLine } from './panel-parts';

/** Unpair with a confirm; shared by the parent's list and the accessory's own page. */
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

/** The right sheet that pairs an accessory to this device, or imports what PetKit knows. */
function PairSheet({
  device,
  open,
  onOpenChange,
}: {
  device: DeviceDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const importer = useDeviceCall();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto min-[901px]:max-w-[480px]">
        <SheetTitle>Pair an accessory</SheetTitle>
        <SheetDescription className="-mt-2 text-md text-lede">
          It talks to the server through the{' '}
          <b className="font-semibold">{device.name.toLowerCase()}</b>, which must stay on and
          nearby.
        </SheetDescription>
        <div className="flex flex-col gap-1">
          <Button
            disabled={importer.busy}
            onClick={() =>
              void importer.run(
                () => importBle(device.id),
                [deviceKeys.ble, deviceKeys.list, deviceKeys.detail(device.id)],
              )
            }
          >
            <Icon name="cloud" size={16} />
            {importer.busy ? 'Asking PetKit…' : 'Import from PetKit'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Asks PetKit once, signed as the {device.name.toLowerCase()}, which accessories it owns,
            and copies each one’s Bluetooth address and pairing secret across. Nothing is sent to
            PetKit until you press it.
          </p>
          <FeedbackLine feedback={importer.feedback} />
        </div>
        <BlePairForm
          parentId={device.id}
          onPaired={() => {
            onOpenChange(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

/**
 * Bluetooth accessories this device relays for. A Pura Air spray or an EverSweet fountain has no
 * network of its own; this device speaks to it over Bluetooth. Each row opens the accessory's own
 * page; pairing and importing happen in the right sheet.
 */
export function BleSection({
  device,
  accessories,
}: {
  device: DeviceDetail;
  accessories: readonly BleAccessory[];
}) {
  const headingId = useId();
  const links = useDeviceLinks();
  const unpair = useUnpair(device.id);
  const [pairing, setPairing] = useState(false);
  return (
    <Card as="section" aria-labelledby={headingId} className="flex flex-col gap-1 pt-4 pb-2">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 id={headingId}>Bluetooth accessories</h2>
        <Button
          variant="text"
          onClick={() => {
            setPairing(true);
          }}
        >
          Pair
        </Button>
      </div>
      <ul className="m-0 flex list-none flex-col p-0" aria-label="Paired accessories">
        {device.ble.length === 0 && (
          <li className="flex min-h-13 items-center text-muted-foreground">Nothing paired.</li>
        )}
        {device.ble.map(b => {
          const full = accessories.find(a => a.petkit_id === b.id);
          const last = epochSeconds(full?.last_seen);
          return (
            <li
              key={b.id}
              className="flex min-h-13 flex-wrap items-center gap-3 py-1.5 [&+&]:border-t [&+&]:border-rule"
            >
              <DeviceArt type={b.type} entities={full?.entities ?? []} size={40} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span>{full?.name ?? b.type.toUpperCase()}</span>
                <span className="text-xs text-muted-foreground">
                  {b.type.toUpperCase()} · relayed by this device ·{' '}
                  <span className="font-mono">{b.mac}</span>
                </span>
              </span>
              <span className="text-sm text-muted-foreground">
                {last ? relativeTime(last) : 'No report yet'}
              </span>
              {full && (
                <Link
                  to={links.device(accessoryKeyOf(b.id))}
                  className="text-sm font-medium"
                  aria-label={`Open ${full.name}`}
                >
                  Open
                </Link>
              )}
              <Button
                variant="ghost"
                size="small"
                disabled={unpair.call.busy}
                onClick={() => {
                  unpair.ask({ id: b.id, name: b.type.toUpperCase() });
                }}
              >
                Unpair
              </Button>
            </li>
          );
        })}
      </ul>
      <FeedbackLine feedback={unpair.call.feedback} />
      {unpair.dialog}
      <PairSheet device={device} open={pairing} onOpenChange={setPairing} />
    </Card>
  );
}
