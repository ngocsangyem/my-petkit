import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Table } from '@/shared/ui';
import { type DeviceDetail, type PetWithFaces, deviceKeys } from '../api';
import { sendAction } from '../api-calls';
import type { OpenState, SetOpen } from '../hooks/use-open-state';
import { FAMILY_NOUN, deviceFamily } from '../lib/device-family';
import { type DeviceEntity, groupDeviceEntities } from '../lib/entity-sections';
import { DeviceSchedules } from '../schedules';
import { BleSection } from './ble-section';
import { CommandList } from './command-list';
import { AiSection, CapabilitiesSection, EntityControlsSection } from './control-sections';
import { DeviceFacts } from './device-facts';
import { LogUploadSection, TimezoneSection } from './device-config-sections';
import { EntityTable } from './entity-table';
import { ModelBlock } from './model-block';
import { BlockHeading, Disclosure, JsonBlock } from './panel-parts';
import { RawCommand, ScheduleRawJson } from './raw-sections';
import { RemoveDevice } from './remove-device';
import { SoundsSection } from './sounds-section';
import { StreamUrls } from './stream-urls';

interface DevicePanelBodyProps {
  device: DeviceDetail;
  pets: readonly PetWithFaces[];
  visitsToday: number | null;
  isOpen: OpenState;
  setOpen: SetOpen;
}

/** Everything about one device, top to bottom: figures, commands, schedules, settings, state. */
export function DevicePanelBody({
  device: d,
  pets,
  visitsToday,
  isOpen,
  setOpen,
}: DevicePanelBodyProps) {
  const groups = groupDeviceEntities(d.entities, d.supports_ai);
  const times = d.entities.filter(e => e.component === 'time');
  const texts = d.entities.filter(e => e.component === 'text');
  const noun = FAMILY_NOUN[deviceFamily(d.type)].toLowerCase();
  const hasIp = typeof d.state?.ip === 'string' && d.state.ip !== '';
  const lastClip = typeof d.state?.lastClipPath === 'string' ? d.state.lastClipPath : null;

  const section = (key: string, summary: string, body: ReactNode) => (
    <Disclosure
      summary={summary}
      open={isOpen(`d${d.id}:${key}`, false)}
      onOpenChange={open => {
        setOpen(`d${d.id}:${key}`, open);
      }}
    >
      {body}
    </Disclosure>
  );

  return (
    <>
      <ModelBlock device={d} visitsToday={visitsToday} />

      {!d.actions.length && !groups.controls.length && !groups.sensors.length && (
        <p className="devices-note">
          This device type ({d.type.toUpperCase()}) is not recognised, so no Home Assistant entities
          are defined for it. It still connects, appears here and its traffic is logged; raw
          commands are under Advanced below.
        </p>
      )}

      {d.actions.length > 0 && (
        <section className="devices-stack" aria-label="Commands">
          <BlockHeading title="Commands" />
          <CommandList
            target={noun}
            route={
              d.mqtt_connected
                ? 'It has a live MQTT session, so it runs now.'
                : 'It is not on MQTT, so it waits for its next HTTP heartbeat, about 10 seconds.'
            }
            refresh={[deviceKeys.detail(d.id), deviceKeys.list]}
            commands={d.actions.map(a => ({
              key: a.key,
              name: a.name,
              destructive: a.destructive,
              run: () => sendAction(d.id, a.key),
            }))}
          />
        </section>
      )}

      {groups.media.length > 0 && (
        <section className="devices-stack" aria-label="Camera">
          <BlockHeading
            title="Camera"
            aside={<Link to="/timeline">Clips are on the Timeline</Link>}
          />
          <StreamUrls streams={d.streams} hasIp={hasIp} />
          {lastClip && (
            <p className="devices-note">
              Last clip <code className="devices-mono">{lastClip}</code>
            </p>
          )}
          <p className="devices-note">Entities: {groups.media.map(e => e.key).join(', ')}</p>
        </section>
      )}

      <DeviceSchedules device={d} />
      <EntityControlsSection
        device={d}
        title="Times of day"
        description="A single time each, in the device's own day."
        entities={times}
      />
      {texts.length > 0 &&
        section(
          'schedjson',
          'Schedules as raw JSON',
          <ScheduleRawJson device={d} entities={texts} />,
        )}

      <div className="devices-settings">
        <EntityControlsSection device={d} title="Controls" entities={groups.controls} />
        <AiSection device={d} entities={groups.aiControls} pets={pets} />
        <CapabilitiesSection device={d} />
        <TimezoneSection device={d} />
        <LogUploadSection device={d} />
      </div>

      {groups.sensors.length > 0 && (
        <section className="devices-stack" aria-label="State">
          <BlockHeading title="State" aside="What this device is reporting now" />
          <EntityTable label={`${d.name} state`} sensors={groups.sensors} all={d.entities} />
          {section(
            'rawstate',
            'Raw parsed state JSON',
            <JsonBlock label="Parsed state" value={d.state} />,
          )}
        </section>
      )}

      <DeviceFacts device={d} />
      <BleSection device={d} isOpen={isOpen} setOpen={setOpen} />
      {d.is_camera &&
        d.is_feeder &&
        section('sounds', 'Custom sounds', <SoundsSection deviceId={d.id} />)}
      {groups.unrouted.length > 0 && <Unrouted entities={groups.unrouted} />}

      {section(
        'diag',
        'Diagnostics and raw payloads',
        <div className="devices-stack">
          <span className="devices-label">Last HTTP state report</span>
          <JsonBlock
            label="Last HTTP state report"
            value={d.diag.last_state_report ?? { note: 'none yet' }}
          />
          <span className="devices-label">Last MQTT property post</span>
          <JsonBlock
            label="Last MQTT property post"
            value={d.diag.last_property ?? { note: 'none yet' }}
          />
          <span className="devices-label">MQTT connection</span>
          <JsonBlock
            label="MQTT connection"
            value={
              d.diag.last_connect ?? {
                note: 'no MQTT connect seen; the device is on HTTP heartbeat',
              }
            }
          />
        </div>,
      )}
      {section('raw', 'Advanced: send a raw command', <RawCommand deviceId={d.id} />)}
      <p className="devices-note">
        Firmware changes for this device are on the <Link to="/patchers">Patchers</Link> screen.
      </p>
      {section('danger', 'Remove device', <RemoveDevice device={d} />)}
    </>
  );
}

/** Entities this screen has no block for: a gap in ENTITY_SECTION, shown rather than hidden. */
function Unrouted({ entities }: { entities: readonly DeviceEntity[] }) {
  return (
    <section className="devices-stack" aria-label="Not shown above">
      <BlockHeading title="Not shown above" />
      <p className="devices-note">
        These entities are published to Home Assistant but this screen has no block for them. Please
        report it.
      </p>
      <Table<DeviceEntity>
        label="Entities with no block"
        variant="compact"
        rows={entities}
        rowKey={e => e.key}
        columns={[
          { key: 'name', header: 'Entity', cell: e => e.name },
          { key: 'component', header: 'Component', cell: e => e.component, muted: true },
          { key: 'key', header: 'Key', cell: e => e.key, mono: true },
        ]}
      />
    </section>
  );
}
