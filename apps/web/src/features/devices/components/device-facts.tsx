import { useTranslation } from 'react-i18next';
import { relativeTime } from '@/shared/format/format';
import { Missing } from '@/shared/ui';
import type { DeviceDetail } from '../api';
import { epochSeconds } from '../lib/timestamps';
import { Fact } from './panel-parts';

function Text({ value, mono }: { value: string; mono?: boolean }) {
  if (!value) return <Missing />;
  return mono ? <code className="font-mono text-sm wrap-anywhere">{value}</code> : <>{value}</>;
}

/** Identity and traffic of one device: serial, MAC, firmware, counters, MQTT names. */
export function DeviceFacts({ device: d }: { device: DeviceDetail }) {
  const { t } = useTranslation('devices');
  const ago = (v: DeviceDetail['last_heartbeat']) => relativeTime(epochSeconds(v));
  return (
    <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-x-6 gap-y-3">
      <Fact label={t('facts.serial')}>
        <Text value={d.sn} mono />
      </Fact>
      <Fact label={t('facts.mac')}>
        <Text value={d.mac} mono />
      </Fact>
      <Fact label={t('facts.firmware')}>
        <Text value={d.firmware} mono />
      </Fact>
      <Fact label={t('facts.lastHeartbeat')}>{ago(d.last_heartbeat)}</Fact>
      <Fact label={t('facts.lastState')}>{ago(d.last_state_report)}</Fact>
      <Fact label={t('facts.lastMqtt')}>{ago(d.last_mqtt)}</Fact>
      <Fact label={t('facts.queued')}>{d.queue}</Fact>
      <Fact label={t('facts.messages')}>
        {d.http_count} / {d.mqtt_count}
      </Fact>
      <Fact label={t('facts.productKey')}>
        <Text value={d.pk} mono />
      </Fact>
      <Fact label={t('facts.deviceName')}>
        <Text value={d.dn} mono />
      </Fact>
    </dl>
  );
}
