import { useTranslation } from 'react-i18next';
import { Card } from '@/shared/ui';
import type { BleAccessory } from '../api';
import type { useUnpair } from '../components/ble-section';
import { FeedbackLine } from '../components/panel-parts';

/** The foot of an accessory page: its Bluetooth address and id, and unpairing it. */
export function AccessoryToolsCard({
  accessory: a,
  unpair,
}: {
  accessory: BleAccessory;
  unpair: ReturnType<typeof useUnpair>;
}) {
  const { t } = useTranslation('devices');
  return (
    <Card as="section" aria-label={t('accessory.tools')} className="flex flex-col py-2">
      <div className="flex min-h-13 items-center gap-3">
        <span className="flex-1">{t('accessory.mac')}</span>
        <span className="font-mono text-sm text-muted-foreground">{a.mac}</span>
      </div>
      <div className="flex min-h-13 items-center gap-3 border-t border-rule">
        <span className="flex-1">{t('accessory.id')}</span>
        <span className="font-mono text-sm text-muted-foreground">{a.petkit_id}</span>
      </div>
      <button
        type="button"
        className="flex min-h-13 w-full items-center border-0 border-t border-rule bg-transparent p-0 text-left text-negative disabled:opacity-50"
        disabled={unpair.call.busy}
        onClick={() => {
          unpair.ask({ id: a.petkit_id, name: a.ble_type.toUpperCase() });
        }}
      >
        {t('accessory.unpair')}
      </button>
      <FeedbackLine feedback={unpair.call.feedback} />
    </Card>
  );
}
