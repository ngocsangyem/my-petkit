import { useState } from 'react';
import type { components } from '@/api/schema';
import { Button, Select, StackedField, TextInput } from '@/shared/ui';
import { deviceKeys } from '../api';
import { pairBle } from '../api-calls';
import { useDeviceCall } from '../hooks/use-device-call';
import { Collapsible } from '@/shared/ui/shadcn/collapsible';
import { DisclosureFrame, FeedbackLine } from './panel-parts';

type BleType = components['schemas']['BleAccessoryPairRequest']['ble_type'];

const TYPES: readonly { value: BleType; label: string }[] = [
  { value: 'w5', label: 'EverSweet 3 Pro / Solo (W5)' },
  { value: 'w4', label: 'EverSweet (W4)' },
  { value: 'ctw2', label: 'EverSweet Solo 2 (CTW2)' },
  { value: 'ctw3', label: 'EverSweet Max Cordless (CTW3)' },
  { value: 'k3', label: 'Pura Air spray (K3)' },
];

const EMPTY = {
  type: 'w5' as BleType,
  mac: '',
  secret: '',
  sn: '',
  id: '',
  interval: '240',
  scan: '',
};

/** A whole number from a text field, or `fallback` when blank or not a number. */
function intOr(raw: string, fallback: number): number {
  const n = Number(raw.trim());
  return raw.trim() !== '' && Number.isInteger(n) ? n : fallback;
}

/**
 * Pairing an accessory by hand. The device never goes looking: it asks us for a
 * list of Bluetooth addresses and scans for exactly those, so with PetKit's app
 * gone the address and the pairing secret have to be entered here. Neither can
 * be worked out; they come off the accessory or out of PetKit's app.
 */
export function BlePairForm({ parentId }: { parentId: number }) {
  const call = useDeviceCall();
  const [form, setForm] = useState(EMPTY);
  const field = (key: keyof typeof EMPTY) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => {
      setForm({ ...form, [key]: e.target.value });
    },
    disabled: call.busy,
  });

  const submit = () => {
    if (!form.mac.trim()) {
      call.say({ text: 'Enter the Bluetooth address', tone: 'error' });
      return;
    }
    void call
      .run(
        () =>
          pairBle({
            ble_type: form.type,
            petkit_id: intOr(form.id, 0),
            mac: form.mac.trim(),
            secret: form.secret.trim(),
            interval: intOr(form.interval, 240),
            serial_number: form.sn.trim(),
            scan_type: intOr(form.scan, 0),
            link_with: parentId,
          }),
        [deviceKeys.ble, deviceKeys.list, deviceKeys.detail(parentId)],
      )
      .then(ok => {
        if (ok) setForm(EMPTY);
      });
  };

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-4 gap-y-3">
        <StackedField label="Accessory">
          <Select
            options={TYPES}
            value={form.type}
            disabled={call.busy}
            onChange={e => {
              const next = TYPES.find(t => t.value === e.target.value);
              if (next) setForm({ ...form, type: next.value });
            }}
          />
        </StackedField>
        <StackedField label="Bluetooth address (MAC)">
          <TextInput mono placeholder="AA:BB:CC:DD:EE:FF" {...field('mac')} />
        </StackedField>
        <StackedField
          label="Pairing secret"
          hint="Eight bytes kept by the accessory until a factory reset. One set up in PetKit's app needs that secret; a factory-fresh one accepts eight zero bytes."
        >
          <TextInput mono placeholder="from the accessory" {...field('secret')} />
        </StackedField>
        <StackedField label="Name it (optional)">
          <TextInput placeholder="serial or a label" {...field('sn')} />
        </StackedField>
      </div>
      <Collapsible>
        <DisclosureFrame summary="Advanced">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-4 gap-y-3">
            <StackedField
              label="Identifier"
              hint="Becomes its Home Assistant device id. Leave blank unless you want the id PetKit's app gave it."
            >
              <TextInput mono inputMode="numeric" placeholder="chosen for you" {...field('id')} />
            </StackedField>
            <StackedField
              label="Poll interval (s)"
              hint="How often the relay opens a Bluetooth session to read it."
            >
              <TextInput inputMode="numeric" {...field('interval')} />
            </StackedField>
            <StackedField
              label="Scan type"
              hint="14 is the only value read off a real pairing (a W5). If an accessory never reports, try another number here."
            >
              <TextInput inputMode="numeric" placeholder="default" {...field('scan')} />
            </StackedField>
          </div>
        </DisclosureFrame>
      </Collapsible>
      <div>
        <Button onClick={submit} disabled={call.busy}>
          Pair accessory
        </Button>
      </div>
      <FeedbackLine feedback={call.feedback} />
    </div>
  );
}
