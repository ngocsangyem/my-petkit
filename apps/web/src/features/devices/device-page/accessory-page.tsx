import { Link } from 'react-router';
import { relativeTime } from '@/shared/format/format';
import {
  Card,
  PageHeader,
  Panel,
  QuickAction,
  SectionCard,
  SettingsSection,
  StatusWord,
  type StatusTone,
} from '@/shared/ui';
import { type BleAccessory, deviceKeys } from '../api';
import { pollBle, setBleEntity } from '../api-calls';
import { useUnpair } from '../components/ble-section';
import { CommandList, useCommands } from '../components/command-list';
import { DeviceArt } from '../components/device-art';
import { EntityControl } from '../components/entity-control';
import { EntityTable } from '../components/entity-table';
import { FigureSplit } from '../components/figure-split';
import { Disclosure, FeedbackLine, JsonBlock } from '../components/panel-parts';
import { useDeviceCall } from '../hooks/use-device-call';
import type { OpenState, SetOpen } from '../hooks/use-open-state';
import { accessoryStatus } from '../lib/device-status';
import { deviceKeyOf, useDeviceLinks } from '../lib/device-view';
import { epochSeconds } from '../lib/timestamps';

const REFRESH = [deviceKeys.ble, deviceKeys.list];

const TONE: Record<string, StatusTone> = { online: 'positive', offline: 'negative' };

/**
 * A Bluetooth accessory as its own page. It gets its entities and controls, not the parent's
 * machinery (counters, queue, patchers): it has no network of its own, so every one of those
 * would be a zero pretending to be a reading. Everything reaches it through the parent, which
 * must be on MQTT.
 */
export function AccessoryPage({
  accessory: a,
  isOpen,
  setOpen,
}: {
  accessory: BleAccessory;
  isOpen: OpenState;
  setOpen: SetOpen;
}) {
  const links = useDeviceLinks();
  const reader = useDeviceCall();
  const controls = useDeviceCall();
  const unpair = useUnpair(a.link_with || null);
  const type = a.ble_type.toUpperCase();
  const runner = useCommands({
    target: type,
    route: 'It travels over Bluetooth through its parent, which must be on MQTT.',
    refresh: REFRESH,
  });
  const sensors = a.entities.filter(
    e => e.component === 'sensor' || e.component === 'binary_sensor',
  );
  const settable = a.entities.filter(e => ['switch', 'number', 'select'].includes(e.component));
  const buttons = a.entities.filter(e => e.component === 'button');
  const rawKey = `a${a.petkit_id}:rawstate`;
  const last = epochSeconds(a.last_seen);
  const status = accessoryStatus(a);

  return (
    <>
      <PageHeader
        title={a.name}
        back={{ to: links.home, label: 'Home' }}
        status={
          <StatusWord tone={TONE[status.status] ?? 'muted'} dot>
            {status.label}
            {last ? ` · ${relativeTime(last)}` : ''}
          </StatusWord>
        }
        finding={
          a.parent_name ? (
            <>
              Relayed by the{' '}
              <Link to={links.device(deviceKeyOf(a.link_with))}>{a.parent_name}</Link> over
              Bluetooth.
            </>
          ) : (
            <StatusWord tone="warning">No device relays for it.</StatusWord>
          )
        }
      />
      <div className="grid items-start gap-5 min-[901px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card
            as="section"
            aria-label={`${a.name} at a glance`}
            padding="none"
            className="flex flex-col gap-4 px-2 pt-2 pb-5"
          >
            <div className="grid gap-2 min-[901px]:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <Panel
                padding="none"
                className="flex min-h-56 flex-col items-center justify-center gap-1.5 rounded-lg px-3 pt-4.5 pb-3.5"
              >
                <DeviceArt type={a.ble_type} entities={a.entities} size={160} />
                <span className="text-xs text-muted-foreground">{type} · Bluetooth</span>
              </Panel>
              <FigureSplit
                label={`${a.name} facts`}
                cells={[
                  {
                    id: 'last',
                    label: 'Last reading',
                    value: last ? relativeTime(last) : null,
                    missingText: 'Never',
                  },
                  { id: 'interval', label: 'Poll interval', value: a.interval, unit: 's' },
                  { id: 'scan', label: 'Scan type', value: a.wire_entry.type },
                  {
                    id: 'serial',
                    label: 'Serial',
                    value: a.serial_number || null,
                    missingText: 'Not set',
                  },
                ]}
              />
            </div>
            <div className="px-3">
              <CommandList
                runner={runner}
                note="Read now asks the relay to open a Bluetooth session; otherwise that happens on a timer up to the poll interval away. Each command asks before it runs."
                extra={
                  <QuickAction
                    icon="refresh"
                    label="Read now"
                    disabled={reader.busy}
                    onClick={() => void reader.run(() => pollBle(a.petkit_id), REFRESH)}
                  />
                }
                commands={buttons.map(e => ({
                  key: e.key,
                  name: e.name,
                  destructive: false,
                  run: () => setBleEntity(a.petkit_id, e.key, ''),
                }))}
              />
              <FeedbackLine feedback={reader.feedback} />
            </div>
          </Card>
          {a.scan_type_is_guessed && (
            <Panel className="text-sm text-muted-foreground">
              The scan type for this model is a guess. Nobody has captured what a real {type}{' '}
              pairing carries, so {a.wire_entry.type} is borrowed from its product line. If this
              accessory never reports, unpair it and pair again with a different scan type under
              Advanced, and please say which value worked.
            </Panel>
          )}
          <SectionCard title="State">
            {sensors.length ? (
              <>
                <EntityTable label={`${a.name} state`} sensors={sensors} all={a.entities} />
                <Disclosure
                  summary="Raw parsed state JSON"
                  open={isOpen(rawKey, false)}
                  onOpenChange={open => {
                    setOpen(rawKey, open);
                  }}
                >
                  <JsonBlock label="Parsed state" value={a.state} />
                </Disclosure>
              </>
            ) : (
              <p className="text-muted-foreground">
                Nothing reported yet. An accessory only speaks when its parent is asked to open a
                Bluetooth session to it.
              </p>
            )}
          </SectionCard>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          {settable.length > 0 && (
            <SettingsSection
              title="Settings"
              description="Settings travel as one block, so a change needs a reading first; before the accessory has reported, a write is refused rather than guessed at."
            >
              {settable.map(e => (
                <EntityControl
                  key={e.key}
                  entity={e}
                  owner={`a:${a.petkit_id}`}
                  disabled={controls.busy}
                  onSet={value =>
                    controls.run(() => setBleEntity(a.petkit_id, e.key, value), REFRESH)
                  }
                />
              ))}
              <FeedbackLine feedback={controls.feedback} />
            </SettingsSection>
          )}
          <Card as="section" aria-label="Accessory tools" className="flex flex-col py-2">
            <div className="flex min-h-13 items-center gap-3">
              <span className="flex-1">Bluetooth address</span>
              <span className="font-mono text-sm text-muted-foreground">{a.mac}</span>
            </div>
            <div className="flex min-h-13 items-center gap-3 border-t border-rule">
              <span className="flex-1">Accessory ID</span>
              <span className="font-mono text-sm text-muted-foreground">{a.petkit_id}</span>
            </div>
            <button
              type="button"
              className="flex min-h-13 w-full items-center border-0 border-t border-rule bg-transparent p-0 text-left text-negative disabled:opacity-50"
              disabled={unpair.call.busy}
              onClick={() => {
                unpair.ask({ id: a.petkit_id, name: type });
              }}
            >
              Unpair accessory
            </button>
            <FeedbackLine feedback={unpair.call.feedback} />
          </Card>
        </div>
      </div>
      {unpair.dialog}
      {runner.dialog}
    </>
  );
}
