import { Children, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { components } from '@/api/schema';
import { i18n } from '@/i18n';
import { SettingsRow, SettingsSection, Switch } from '@/shared/ui';
import { type DeviceDetail, type PetWithFaces, deviceKeys } from '../api';
import { setAi, setCapability, setEntity } from '../api-calls';
import { useDeviceCall } from '../hooks/use-device-call';
import type { DeviceEntity } from '../lib/entity-sections';
import { EntityControl } from './entity-control';
import { FeedbackLine } from './panel-parts';

type CapabilityFlag = keyof components['schemas']['DeviceCapabilityFlags'];

const refreshFor = (id: number) => [deviceKeys.detail(id), deviceKeys.list];

/** Entity controls (switch, number, select, time) of one device, in one settings section. */
export function EntityControlsSection({
  device,
  title,
  description,
  entities,
  children,
}: {
  device: DeviceDetail;
  title: string;
  description?: string;
  entities: readonly DeviceEntity[];
  /** Rows after the entity controls (Sounds, the camera's pan). */
  children?: ReactNode;
}) {
  const call = useDeviceCall();
  // `{a && <Row />}` children arrive as `false` when absent: count only what would render.
  if (!entities.length && Children.toArray(children).length === 0) return null;
  return (
    <SettingsSection title={title} description={description}>
      {entities.map(e => (
        <EntityControl
          key={e.key}
          entity={e}
          owner={`d:${device.id}`}
          disabled={call.busy}
          onSet={value => call.run(() => setEntity(device.id, e.key, value), refreshFor(device.id))}
        />
      ))}
      {children}
      <FeedbackLine feedback={call.feedback} />
    </SettingsSection>
  );
}

const CAP_FLAGS: readonly CapabilityFlag[] = [
  'fullVideo',
  'eventImage',
  'highLight',
  'dynamicVideo',
];

/** Media upload switches: the device stops sending that type at the source. */
export function CapabilitiesSection({ device }: { device: DeviceDetail }) {
  const { t } = useTranslation('devices');
  const call = useDeviceCall();
  if (!device.is_camera || !device.capInfo) return null;
  const caps = device.capInfo.capabilities;
  return (
    <SettingsSection title={t('capabilities.title')} description={t('capabilities.description')}>
      {CAP_FLAGS.map(flag => (
        <SettingsRow
          key={flag}
          label={t(`capabilities.${flag}`)}
          control={props => (
            <Switch
              {...props}
              checked={caps[flag]}
              disabled={call.busy}
              onCheckedChange={on =>
                void call.run(() => setCapability(device.id, flag, on), refreshFor(device.id))
              }
            />
          )}
        />
      ))}
      <FeedbackLine feedback={call.feedback} />
    </SettingsSection>
  );
}

/**
 * The device's readback of which mugshots it holds (`discernPic`), compared with
 * ours: matching ids prove it took OUR photos, foreign ones mean it is still
 * matching against PetKit's cloud, which is what proxy mode hands it.
 */
function facesVerdict(device: DeviceDetail, pets: readonly PetWithFaces[]): string | null {
  const cached = device.state?.discernPic;
  if (!Array.isArray(cached)) return null;
  if (!cached.length) {
    return i18n.t('devices:faces.none');
  }
  const ours = new Set(pets.flatMap(p => p.faces.map(f => String(f.id))));
  const foreign = cached.filter(id => !ours.has(String(id)));
  const head = i18n.t('devices:faces.head', {
    count: cached.length,
    ids: cached.map(String).join(', '),
  });
  if (!ours.size) return i18n.t('devices:faces.unknown', { head });
  if (!foreign.length) return i18n.t('devices:faces.ours', { head });
  return i18n.t('devices:faces.foreign', {
    head,
    yours: i18n.t('devices:faces.mugshots', { count: ours.size }),
  });
}

/** On-device AI: recognition on/off, what the camera watches for, and the face readback. */
export function AiSection({
  device,
  entities,
  pets,
}: {
  device: DeviceDetail;
  entities: readonly DeviceEntity[];
  pets: readonly PetWithFaces[];
}) {
  const { t } = useTranslation('devices');
  const call = useDeviceCall();
  if (!device.supports_ai) return null;
  const enabled = device.aiInfo?.ai_enabled ?? true;
  const verdict = facesVerdict(device, pets);
  return (
    <SettingsSection title={t('ai.title')} description={t('ai.description')}>
      <SettingsRow
        label={t('ai.recognisePets')}
        control={props => (
          <Switch
            {...props}
            checked={enabled}
            disabled={call.busy}
            onCheckedChange={on => void call.run(() => setAi(device.id, on), refreshFor(device.id))}
          />
        )}
      />
      {entities.map(e => (
        <EntityControl
          key={e.key}
          entity={e}
          owner={`d:${device.id}`}
          disabled={call.busy}
          onSet={value => call.run(() => setEntity(device.id, e.key, value), refreshFor(device.id))}
        />
      ))}
      {verdict && <p className="text-sm text-muted-foreground">{verdict}</p>}
      <FeedbackLine feedback={call.feedback} />
    </SettingsSection>
  );
}
