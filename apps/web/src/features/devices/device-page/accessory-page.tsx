import { Trans, useTranslation } from 'react-i18next';
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
import { AccessoryToolsCard } from './accessory-tools-card';

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
  const { t } = useTranslation('devices');
  const links = useDeviceLinks();
  const reader = useDeviceCall();
  const controls = useDeviceCall();
  const unpair = useUnpair(a.link_with || null);
  const type = a.ble_type.toUpperCase();
  const runner = useCommands({
    target: type,
    route: t('accessory.route'),
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
        back={{ to: links.home, label: t('home.title') }}
        status={
          <StatusWord tone={TONE[status.status] ?? 'muted'} dot>
            {status.label}
            {last ? ` · ${relativeTime(last)}` : ''}
          </StatusWord>
        }
        finding={
          a.parent_name ? (
            <Trans
              t={t}
              i18nKey="accessory.relayedBy"
              values={{ parent: a.parent_name }}
              components={{ link: <Link to={links.device(deviceKeyOf(a.link_with))} /> }}
            />
          ) : (
            <StatusWord tone="warning">{t('accessory.noRelay')}</StatusWord>
          )
        }
      />
      <div className="grid items-start gap-5 min-[901px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card
            as="section"
            aria-label={t('atAGlance', { name: a.name })}
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
                label={t('accessory.factsLabel', { name: a.name })}
                cells={[
                  {
                    id: 'last',
                    label: t('accessory.lastReading'),
                    value: last ? relativeTime(last) : null,
                    missingText: t('accessory.neverRead'),
                  },
                  {
                    id: 'interval',
                    label: t('accessory.interval'),
                    value: a.interval,
                    unit: 's',
                  },
                  { id: 'scan', label: t('pair.scanType'), value: a.wire_entry.type },
                  {
                    id: 'serial',
                    label: t('facts.serial'),
                    value: a.serial_number || null,
                    missingText: t('accessory.notSet'),
                  },
                ]}
              />
            </div>
            <div className="px-3">
              <CommandList
                runner={runner}
                note={t('accessory.readNote')}
                extra={
                  <QuickAction
                    icon="refresh"
                    label={t('accessory.readNow')}
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
              {t('accessory.scanGuess', { type, scan: a.wire_entry.type })}
            </Panel>
          )}
          <SectionCard title={t('stateTitle')}>
            {sensors.length ? (
              <>
                <EntityTable
                  label={t('stateLabel', { name: a.name })}
                  sensors={sensors}
                  all={a.entities}
                />
                <Disclosure
                  summary={t('rawStateJson')}
                  open={isOpen(rawKey, false)}
                  onOpenChange={open => {
                    setOpen(rawKey, open);
                  }}
                >
                  <JsonBlock label={t('parsedState')} value={a.state} />
                </Disclosure>
              </>
            ) : (
              <p className="text-muted-foreground">{t('accessory.nothingYet')}</p>
            )}
          </SectionCard>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          {settable.length > 0 && (
            <SettingsSection title={t('settings')} description={t('accessory.settingsNote')}>
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
          <AccessoryToolsCard accessory={a} unpair={unpair} />
        </div>
      </div>
      {unpair.dialog}
      {runner.dialog}
    </>
  );
}
