import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { SectionCard, Table } from '@/shared/ui';
import type { DeviceDetail } from '../api';
import { DeviceFacts } from '../components/device-facts';
import { EntityTable } from '../components/entity-table';
import { BlockHeading, Disclosure, JsonBlock } from '../components/panel-parts';
import { RawCommand, ScheduleRawJson } from '../components/raw-sections';
import type { OpenState, SetOpen } from '../hooks/use-open-state';
import { type DeviceEntity, groupDeviceEntities } from '../lib/entity-sections';

/** Entities this screen has no block for: a gap in ENTITY_SECTION, shown rather than hidden. */
function Unrouted({ entities }: { entities: readonly DeviceEntity[] }) {
  return (
    <section className="flex min-w-0 flex-col gap-2.5" aria-label="Not shown above">
      <BlockHeading title="Not shown above" />
      <p className="text-sm text-muted-foreground">
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

/**
 * "Entities and raw command": what the device reports, its identity and traffic, the raw
 * payloads, and the raw command box. For debugging, so it opens only on request.
 */
export function RawCard({
  device: d,
  isOpen,
  setOpen,
}: {
  device: DeviceDetail;
  isOpen: OpenState;
  setOpen: SetOpen;
}) {
  const groups = groupDeviceEntities(d.entities, d.supports_ai);
  const texts = d.entities.filter(e => e.component === 'text');
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
    <SectionCard title="Entities and raw command" aside="What this device is reporting now">
      {groups.sensors.length > 0 && (
        <section className="flex min-w-0 flex-col gap-2.5" aria-label="State">
          <EntityTable label={`${d.name} state`} sensors={groups.sensors} all={d.entities} />
          {section(
            'rawstate',
            'Raw parsed state JSON',
            <JsonBlock label="Parsed state" value={d.state} />,
          )}
        </section>
      )}
      <DeviceFacts device={d} />
      {groups.unrouted.length > 0 && <Unrouted entities={groups.unrouted} />}
      {texts.length > 0 &&
        section(
          'schedjson',
          'Schedules as raw JSON',
          <ScheduleRawJson device={d} entities={texts} />,
        )}
      {section(
        'diag',
        'Diagnostics and raw payloads',
        <div className="flex min-w-0 flex-col gap-2.5">
          <span className="text-sm font-medium">Last HTTP state report</span>
          <JsonBlock
            label="Last HTTP state report"
            value={d.diag.last_state_report ?? { note: 'none yet' }}
          />
          <span className="text-sm font-medium">Last MQTT property post</span>
          <JsonBlock
            label="Last MQTT property post"
            value={d.diag.last_property ?? { note: 'none yet' }}
          />
          <span className="text-sm font-medium">MQTT connection</span>
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
      <p className="text-sm text-muted-foreground">
        Firmware changes for this device are on the <Link to="/patchers">Patchers</Link> screen.
      </p>
    </SectionCard>
  );
}
