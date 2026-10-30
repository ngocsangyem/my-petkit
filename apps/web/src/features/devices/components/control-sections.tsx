import type { ReactNode } from 'react';
import type { components } from '@/api/schema';
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
  if (!entities.length && !children) return null;
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

const CAP_LABELS: Readonly<Record<CapabilityFlag, string>> = {
  fullVideo: 'Recordings',
  eventImage: 'Snapshots',
  highLight: 'Highlights',
  dynamicVideo: 'Motion clips',
};

/** Media upload switches: the device stops sending that type at the source. */
export function CapabilitiesSection({ device }: { device: DeviceDetail }) {
  const call = useDeviceCall();
  if (!device.is_camera || !device.capInfo) return null;
  const caps = device.capInfo.capabilities;
  return (
    <SettingsSection
      title="Media capabilities"
      description="Turns an upload off at the source: nothing to prune and no bandwidth spent. Takes effect on the device's next upload-credential poll."
    >
      {(Object.keys(CAP_LABELS) as CapabilityFlag[]).map(flag => (
        <SettingsRow
          key={flag}
          label={CAP_LABELS[flag]}
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
    return 'No mugshots cached on the device yet. It re-reads them at boot and about once an hour; a reboot forces it.';
  }
  const ours = new Set(pets.flatMap(p => p.faces.map(f => String(f.id))));
  const foreign = cached.filter(id => !ours.has(String(id)));
  const head = `Cached on the device: ${cached.length} ${cached.length === 1 ? 'mugshot' : 'mugshots'} (${cached.map(String).join(', ')})`;
  if (!ours.size) return `${head}.`;
  if (!foreign.length) return `${head}: yours, so the device is matching against your mugshots.`;
  return `${head}: not yours. It is still using photos from PetKit's cloud, which proxy mode hands it. Turn proxy off and reboot the device to switch it to your ${ours.size} ${ours.size === 1 ? 'mugshot' : 'mugshots'}.`;
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
  const call = useDeviceCall();
  if (!device.supports_ai) return null;
  const enabled = device.aiInfo?.ai_enabled ?? true;
  const verdict = facesVerdict(device, pets);
  return (
    <SettingsSection
      title="On-device AI"
      description="What this device's camera watches and listens for."
    >
      <SettingsRow
        label="Recognise pets"
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
