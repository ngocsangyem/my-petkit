import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button, buttonClassName, Icon, PageHeader, Panel } from '@/shared/ui';
import { type BleAccessory, type DeviceDetail, type PetWithFaces, deviceKeys } from '../api';
import { sendAction } from '../api-calls';
import { BleSection } from '../components/ble-section';
import { type Command, useCommands } from '../components/command-list';
import {
  AiSection,
  CapabilitiesSection,
  EntityControlsSection,
} from '../components/control-sections';
import { LogUploadSection, TimezoneSection } from '../components/device-config-sections';
import { ConsumablesCard } from '../components/model-block';
import { SoundsRow } from '../components/sounds-row';
import type { OpenState, SetOpen } from '../hooks/use-open-state';
import { deviceFamily, familyNoun } from '../lib/device-family';
import { hasSchedulesView, useDeviceLinks } from '../lib/device-view';
import { deviceZone, localClock } from '../lib/device-zone';
import { groupDeviceEntities } from '../lib/entity-sections';
import { lastReport } from '../lib/timestamps';
import { useForceContinue } from '../litter-automation/force-continue-block';
import { useLitterAutomation } from '../litter-automation/litter-automation-api';
import { AutomationCard } from './automation-card';
import { CameraPanRow, isPanCommand } from './camera-pan-row';
import { DeviceLinksCard } from './device-links-card';
import { deviceFinding, deviceStatusWord } from './device-headline';
import { FeederFiguresCard, FeederHeroCard } from './feeder-hero-card';
import { FeederTodayCard } from './feeder-today-card';
import { HeroCard } from './hero-card';
import { LiveLinkCard } from './live-link-card';
import { RawCard } from './raw-card';

interface DevicePageProps {
  device: DeviceDetail;
  accessories: readonly BleAccessory[];
  pets: readonly PetWithFaces[];
  visitsToday: number | null;
  isOpen: OpenState;
  setOpen: SetOpen;
  nowSeconds: number;
}

/**
 * One device: the header with its status and finding, then the drawing, figures and commands,
 * live view, consumables and accessories on the left, and what it does on its own, its settings
 * and its tools on the right. Every model gets this page; a feeder swaps the figures for Feed now.
 */
export function DevicePage(props: DevicePageProps) {
  const { device: d, accessories, pets, visitsToday, isOpen, setOpen, nowSeconds } = props;
  const { t } = useTranslation('devices');
  const links = useDeviceLinks();
  const family = deviceFamily(d.type);
  const zone = deviceZone(d.timezoneInfo);
  const noun = familyNoun(family).toLowerCase();
  const runner = useCommands({
    target: noun,
    route: d.mqtt_connected ? t('page.routeMqtt') : t('page.routeHeartbeat'),
    refresh: [deviceKeys.detail(d.id), deviceKeys.list],
  });
  const all: Command[] = d.actions.map(a => ({
    key: a.key,
    name: a.name,
    destructive: a.destructive,
    run: () => sendAction(d.id, a.key),
  }));
  const pan = all.filter(isPanCommand);
  const commands = all.filter(c => !isPanCommand(c));
  const automation = useLitterAutomation(d.id, family === 'litter');
  const force = useForceContinue(d.id, automation.data?.forceContinue);
  const paused = force.offered || force.quietBlockers;
  const groups = groupDeviceEntities(d.entities, d.supports_ai);
  const times = d.entities.filter(e => e.component === 'time');
  const rawKey = `d${d.id}:raw`;
  const rawOpen = isOpen(rawKey, false);
  const last = lastReport(d);
  const offline = !d.online && last !== null;
  const firstRoutine = commands.find(c => !c.destructive);
  const hasCamera = d.is_camera || groups.media.length > 0;

  const actions = (
    <>
      {offline && (
        <Link className={buttonClassName('secondary')} to="/log">
          <Icon name="log" size={16} />
          {t('page.openLog')}
        </Link>
      )}
      {family === 'feeder' && hasSchedulesView(d) && (
        <Link className={buttonClassName('secondary')} to={links.device(`d${d.id}`, 'schedules')}>
          <Icon name="calendar" size={16} />
          {t('page.schedule')}
        </Link>
      )}
      {hasCamera && (
        <Link className={buttonClassName('secondary')} to={links.device(`d${d.id}`, 'live')}>
          <Icon name="video" size={16} />
          {t('liveView')}
        </Link>
      )}
      {force.offered ? (
        <Button variant="primary" disabled={force.busy} onClick={force.start}>
          <Icon name="clean" size={16} />
          {t('page.continueCleaning')}
        </Button>
      ) : (
        family === 'litter' &&
        firstRoutine && (
          <Button
            variant="primary"
            disabled={runner.busy}
            onClick={() => {
              runner.ask(firstRoutine);
            }}
          >
            <Icon name="clean" size={16} />
            {firstRoutine.name}
          </Button>
        )
      )}
    </>
  );

  const unrecognised = !d.actions.length && !groups.controls.length && !groups.sensors.length;

  return (
    <>
      <PageHeader
        title={d.name}
        back={{ to: links.home, label: t('home.title') }}
        status={deviceStatusWord(d, zone, nowSeconds)}
        finding={deviceFinding(d, zone, nowSeconds, paused)}
        actions={actions}
      />
      <div className="grid items-start gap-5 min-[901px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {family === 'feeder' ? (
            <FeederHeroCard device={d} commands={commands} runner={runner} />
          ) : (
            <HeroCard
              device={d}
              visitsToday={visitsToday}
              commands={commands}
              runner={runner}
              figuresNote={
                !d.online && last !== null && zone
                  ? t('page.valuesFrom', { clock: localClock(last, zone) })
                  : undefined
              }
              commandsNote={offline ? t('page.commandsOffline', { noun }) : undefined}
            />
          )}
          {unrecognised && (
            <Panel className="text-sm text-muted-foreground">
              {t('page.unrecognised', { type: d.type.toUpperCase() })}
            </Panel>
          )}
          {family === 'feeder' && (
            <FeederTodayCard device={d} zone={zone} nowSeconds={nowSeconds} />
          )}
          {hasCamera && <LiveLinkCard deviceKey={`d${d.id}`} caption={t('page.liveCaption')} />}
          <ConsumablesCard device={d} />
          <BleSection device={d} accessories={accessories} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          {family === 'feeder' && <FeederFiguresCard device={d} />}
          <AutomationCard device={d} litter={family === 'litter'} force={force} />
          <EntityControlsSection device={d} title={t('settings')} entities={groups.controls}>
            {d.is_camera && d.is_feeder && <SoundsRow deviceId={d.id} deviceNoun={noun} />}
            {pan.length > 0 && <CameraPanRow commands={pan} runner={runner} />}
          </EntityControlsSection>
          <AiSection device={d} entities={groups.aiControls} pets={pets} />
          <CapabilitiesSection device={d} />
          <EntityControlsSection
            device={d}
            title={t('page.timesOfDay')}
            description={t('page.timesOfDayHint')}
            entities={times}
          />
          <TimezoneSection device={d} />
          <LogUploadSection device={d} />
          <DeviceLinksCard
            device={d}
            rawOpen={rawOpen}
            onRawOpenChange={open => {
              setOpen(rawKey, open);
            }}
          />
        </div>
      </div>
      {rawOpen && <RawCard device={d} isOpen={isOpen} setOpen={setOpen} />}
      {runner.dialog}
    </>
  );
}
