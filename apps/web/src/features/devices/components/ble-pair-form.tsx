import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@/api/schema';
import { Button, Panel, SegmentedChips, StackedField, TextInput } from '@/shared/ui';
import { Collapsible } from '@/shared/ui/shadcn/collapsible';
import { deviceKeys } from '../api';
import { pairBle } from '../api-calls';
import { useDeviceCall } from '../hooks/use-device-call';
import { DisclosureFrame, FeedbackLine } from './panel-parts';

type BleType = components['schemas']['BleAccessoryPairRequest']['ble_type'];

const TYPES: readonly { id: BleType; label: string; full: string }[] = [
  { id: 'k3', label: 'Pura Air K3', full: 'Pura Air spray (K3)' },
  { id: 'w5', label: 'EverSweet W5', full: 'EverSweet 3 Pro / Solo (W5)' },
  { id: 'w4', label: 'EverSweet W4', full: 'EverSweet (W4)' },
  { id: 'ctw2', label: 'CTW2', full: 'EverSweet Solo 2 (CTW2)' },
  { id: 'ctw3', label: 'CTW3', full: 'EverSweet Max Cordless (CTW3)' },
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
export function BlePairForm({ parentId, onPaired }: { parentId: number; onPaired?: () => void }) {
  const { t } = useTranslation('devices');
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
      call.say({ text: t('pair.enterMac'), tone: 'error' });
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
        if (!ok) return;
        setForm(EMPTY);
        onPaired?.();
      });
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted-foreground">{t('pair.type')}</span>
        <SegmentedChips
          small
          label={t('pair.typeLabel')}
          options={TYPES}
          value={form.type}
          onChange={type => {
            setForm({ ...form, type });
          }}
        />
        <span className="text-xs text-muted-foreground">
          {TYPES.find(t => t.id === form.type)?.full}
        </span>
      </div>
      <StackedField label={t('pair.mac')}>
        <TextInput mono placeholder="AA:BB:CC:DD:EE:FF" {...field('mac')} />
      </StackedField>
      <StackedField label={t('pair.secret')} hint={t('pair.secretHint')}>
        <TextInput mono placeholder={t('pair.secretPlaceholder')} {...field('secret')} />
      </StackedField>
      <StackedField label={t('pair.name')}>
        <TextInput placeholder={t('pair.namePlaceholder')} {...field('sn')} />
      </StackedField>
      <Panel>
        <Collapsible>
          <DisclosureFrame plain summary={t('pair.advanced')}>
            <StackedField label={t('pair.identifier')} hint={t('pair.identifierHint')}>
              <TextInput
                mono
                inputMode="numeric"
                placeholder={t('pair.identifierPlaceholder')}
                {...field('id')}
              />
            </StackedField>
            <StackedField label={t('pair.interval')} hint={t('pair.intervalHint')}>
              <TextInput inputMode="numeric" {...field('interval')} />
            </StackedField>
            <StackedField label={t('pair.scanType')} hint={t('pair.scanTypeHint')}>
              <TextInput
                inputMode="numeric"
                placeholder={t('pair.scanTypePlaceholder')}
                {...field('scan')}
              />
            </StackedField>
          </DisclosureFrame>
        </Collapsible>
      </Panel>
      <div className="mt-auto flex flex-col gap-2">
        <Button variant="primary" size="large" onClick={submit} disabled={call.busy}>
          {t('pair.submit')}
        </Button>
        <FeedbackLine feedback={call.feedback} />
      </div>
    </div>
  );
}
