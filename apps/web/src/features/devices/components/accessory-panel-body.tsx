import { relativeTime } from '@/shared/format/format';
import { Button, Missing, SettingsSection } from '@/shared/ui';
import { type BleAccessory, deviceKeys } from '../api';
import { pollBle, setBleEntity } from '../api-calls';
import { useDeviceCall } from '../hooks/use-device-call';
import type { OpenState, SetOpen } from '../hooks/use-open-state';
import { epochSeconds } from '../lib/timestamps';
import { useUnpair } from './ble-section';
import { CommandList } from './command-list';
import { EntityControl } from './entity-control';
import { EntityTable } from './entity-table';
import { BlockHeading, Disclosure, Fact, FeedbackLine, JsonBlock } from './panel-parts';

const REFRESH = [deviceKeys.ble, deviceKeys.list];

/**
 * A BLE accessory as its own device. It gets its entities and controls, not the
 * parent's machinery (counters, queue, patchers): it has no network of its own,
 * so every one of those would be a zero pretending to be a reading. Everything
 * reaches it through the parent, which must be on MQTT.
 */
export function AccessoryPanelBody({
  accessory: a,
  isOpen,
  setOpen,
}: {
  accessory: BleAccessory;
  isOpen: OpenState;
  setOpen: SetOpen;
}) {
  const reader = useDeviceCall();
  const controls = useDeviceCall();
  const unpair = useUnpair(a.link_with || null);
  const sensors = a.entities.filter(
    e => e.component === 'sensor' || e.component === 'binary_sensor',
  );
  const settable = a.entities.filter(e => ['switch', 'number', 'select'].includes(e.component));
  const buttons = a.entities.filter(e => e.component === 'button');
  const type = a.ble_type.toUpperCase();
  const rawKey = `a${a.petkit_id}:rawstate`;
  const last = epochSeconds(a.last_seen);

  return (
    <>
      <dl className="devices-facts">
        <Fact label="Bluetooth address">
          <code className="devices-mono">{a.mac}</code>
        </Fact>
        <Fact label="Relayed by">
          {a.parent_name ? `${a.parent_name} #${a.link_with}` : <Missing />}
        </Fact>
        <Fact label="Serial">{a.serial_number || <Missing />}</Fact>
        <Fact label="Last reading">{last ? relativeTime(last) : 'never'}</Fact>
        <Fact label="Poll interval">{a.interval} s</Fact>
        <Fact label="Scan type">
          <code className="devices-mono">{a.wire_entry.type}</code>
        </Fact>
      </dl>

      {a.scan_type_is_guessed && (
        <p className="devices-note devices-raised">
          The scan type for this model is a guess. Nobody has captured what a real {type} pairing
          carries, so {a.wire_entry.type} is borrowed from its product line. If this accessory never
          reports, unpair it and pair again with a different scan type under Advanced, and please
          say which value worked.
        </p>
      )}

      <section className="devices-stack" aria-label="Commands">
        <BlockHeading title="Commands" />
        <CommandList
          target={type}
          route="It travels over Bluetooth through its parent, which must be on MQTT."
          refresh={REFRESH}
          extra={
            <Button
              disabled={reader.busy}
              onClick={() => void reader.run(() => pollBle(a.petkit_id), REFRESH)}
            >
              Read now
            </Button>
          }
          commands={buttons.map(e => ({
            key: e.key,
            name: e.name,
            destructive: false,
            run: () => setBleEntity(a.petkit_id, e.key, ''),
          }))}
        />
        <p className="devices-note">
          Read now asks the relay to open a Bluetooth session; otherwise that happens on a timer up
          to the poll interval away.
        </p>
        <FeedbackLine feedback={reader.feedback} />
      </section>

      {settable.length > 0 && (
        <SettingsSection
          title="Controls"
          description="Settings travel as one block, so a change needs a reading first; before the accessory has reported, a write is refused rather than guessed at."
        >
          {settable.map(e => (
            <EntityControl
              key={e.key}
              entity={e}
              owner={`a:${a.petkit_id}`}
              disabled={controls.busy}
              onSet={value => controls.run(() => setBleEntity(a.petkit_id, e.key, value), REFRESH)}
            />
          ))}
          <FeedbackLine feedback={controls.feedback} />
        </SettingsSection>
      )}

      <section className="devices-stack" aria-label="State">
        <BlockHeading title="State" />
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
          <p className="devices-note">
            Nothing reported yet. An accessory only speaks when its parent is asked to open a
            Bluetooth session to it.
          </p>
        )}
      </section>

      <div>
        <Button
          variant="destructive"
          disabled={unpair.call.busy}
          onClick={() => {
            unpair.ask({ id: a.petkit_id, name: type });
          }}
        >
          Unpair accessory
        </Button>
      </div>
      <FeedbackLine feedback={unpair.call.feedback} />
      {unpair.dialog}
    </>
  );
}
