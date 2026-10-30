// Dev-only gallery: every shared component with the design's sample data, for
// side-by-side comparison with docs/design/screenshots. Never routed in production.
import { useState } from 'react';
import {
  Button,
  buttonClassName,
  CollapsiblePanel,
  ConfirmDialog,
  DayStripLegend,
  DrumMark,
  EmptyBlock,
  ErrorBlock,
  FigureContainer,
  HouseholdDayStrip,
  InlineField,
  LogLevelText,
  Missing,
  NumberInput,
  PageHeading,
  Pill,
  RatioBar,
  RiskNotice,
  SearchField,
  SectionCard,
  SegmentedChips,
  Select,
  SettingsRow,
  SettingsSection,
  Skeleton,
  StatusMark,
  StepUpPill,
  Switch,
  Table,
  Tabs,
  TextInput,
  TimeInput,
  ValueText,
  type TableColumn,
} from './index';
import {
  fixtureConsumables,
  fixtureDevices,
  fixtureFigures,
  fixtureLanes,
  fixtureLog,
  fixtureNowMinute,
  type FixtureDeviceRow,
  type FixtureLogLine,
} from './gallery-fixtures';

const ATTENTION_INK = { warning: 'text-warning', negative: 'text-negative', plain: '' } as const;

const ROW = 'flex flex-wrap items-center gap-x-3 gap-y-2';
const TWO =
  'grid grid-cols-[minmax(0,1fr)] items-start gap-6 min-[901px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]';

const deviceColumns: TableColumn<FixtureDeviceRow>[] = [
  {
    key: 'device',
    header: 'Device',
    width: '34%',
    cell: r => (
      <span className="flex flex-col">
        <span className="font-medium">{r.name}</span>
        <span className="text-xs text-muted-foreground">
          {r.model} · {r.deviceId ? <span className="font-mono">{r.deviceId}</span> : <Missing />}
        </span>
      </span>
    ),
  },
  { key: 'status', header: 'Status', cell: r => <StatusMark status={r.status} /> },
  { key: 'now', header: 'Now', cell: r => <ValueText value={r.now} /> },
  {
    key: 'attention',
    header: 'Needs you',
    cell: r =>
      r.attention ? (
        <span className={ATTENTION_INK[r.attentionTone ?? 'plain']}>{r.attention}</span>
      ) : (
        <Missing />
      ),
  },
  { key: 'last', header: 'Last report', numeric: true, muted: true, cell: r => r.last },
];

const logColumns: TableColumn<FixtureLogLine>[] = [
  { key: 'time', header: 'Time', width: '96px', muted: true, nowrap: true, cell: l => l.time },
  { key: 'level', header: 'Level', width: '56px', cell: l => <LogLevelText level={l.level} /> },
  {
    key: 'device',
    header: 'Device',
    width: '110px',
    muted: true,
    nowrap: true,
    cell: l => l.device,
  },
  { key: 'message', header: 'Message', nowrap: true, cell: l => l.message },
];

/** Renders every shared component once, with fixture data. */
export function UiGallery() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastAnswer, setLastAnswer] = useState('No command sent yet.');
  const [tab, setTab] = useState<'sign' | 'first' | 'pair'>('sign');
  const [cat, setCat] = useState<'miso' | 'mochi'>('miso');
  const [proxy, setProxy] = useState(false);
  const [blockOta, setBlockOta] = useState(true);
  const [host, setHost] = useState('https://api.petkt.example');
  const [keepDays, setKeepDays] = useState<number | null>(365);
  const [meal, setMeal] = useState('18:00');
  const [query, setQuery] = useState('');
  const [hideHb, setHideHb] = useState(true);

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Devices"
        aside="4 devices · 2 reporting · nothing sent to PetKit's cloud today"
        finding={
          <>
            <span className="font-medium text-negative">
              Water fountain has not reported since 06:10
            </span>
            , 8 h 37 m ago. The litter box needs a new N60 deodorizer in 3 days.
          </>
        }
        actions={
          <>
            <a className={buttonClassName('secondary')} href="#log">
              Open fountain log
            </a>
            <Button variant="primary">Add a device</Button>
          </>
        }
      />

      <SectionCard
        title="Today at home"
        aside="Tue 28 Oct · 5 litter-box visits · 35 of 65 g fed"
        end={<DayStripLegend />}
      >
        <HouseholdDayStrip
          label="Today at home"
          lanes={fixtureLanes}
          nowMinute={fixtureNowMinute}
        />
      </SectionCard>

      <section className="flex flex-col gap-2" aria-label="All devices">
        <h2>All devices</h2>
        <Table
          label="All devices"
          columns={deviceColumns}
          rows={fixtureDevices}
          rowKey={r => r.id}
          minWidth={760}
          selectedKey="b"
        />
      </section>

      <div className={TWO}>
        <SectionCard title="Litter box" aside="Idle · last clean 14:05 · sealed door closed">
          <FigureContainer label="Litter box figures" cells={fixtureFigures} />
          <div className="flex flex-col gap-2.5">
            {fixtureConsumables.map(c => (
              <RatioBar
                key={c.name}
                name={c.name}
                value={c.days}
                max={c.max}
                tone={c.tone}
                label={`${c.days} days`}
                ariaLabel={`${c.name} remaining`}
              />
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <div className={ROW}>
              <Button
                onClick={() => {
                  setConfirmOpen(true);
                }}
              >
                Clean now
              </Button>
              <Button>Pack waste</Button>
              <Button>Open sealed door</Button>
              <Button disabled>Dump litter</Button>
            </div>
            <span className="text-xs text-muted-foreground">
              Each command asks before it runs. {lastAnswer}
            </span>
          </div>
        </SectionCard>
        <div className="flex flex-col gap-6">
          <SectionCard title="Kitchen feeder" end={<a href="#feeder">Edit plan</a>}>
            <RatioBar value={35} max={65} ariaLabel="Fed today" />
            <span className="text-xs text-muted-foreground">
              Fed 35 of 65 g today · polling, takes changes on its next heartbeat
            </span>
          </SectionCard>
          <SectionCard title="Water fountain" end={<Pill tone="negative">Offline</Pill>}>
            <p>No report since 06:10. Last known: water 40 %, filter 9 days left, pump on Smart.</p>
            <ErrorBlock
              message="Couldn't load the fountain's log. Last updated 06:10."
              onRetry={() => undefined}
            />
          </SectionCard>
        </div>
      </div>

      <PageHeading
        title="Patchers"
        badge={<StepUpPill />}
        finding="Root changes on the device itself · 2 of 6 patches applied"
      />
      <RiskNotice>
        Each patch runs shell commands on the box as root. Firmware files are never overwritten: a
        boot script bind-mounts patched copies, and undo removes it and reboots.
      </RiskNotice>
      <div className={ROW}>
        <Button variant="primary">Add a device</Button>
        <Button>Clean now</Button>
        <Button variant="destructive">Delete capture</Button>
        <Button variant="danger-final">Apply patch</Button>
        <Button variant="text">Retry</Button>
        <Button size="small">Copy</Button>
        <Pill tone="positive">Applied</Pill>
        <Pill tone="warning">Low</Pill>
        <Pill>Idle</Pill>
        <DrumMark size={56} title="my-petkit" />
      </div>

      <SettingsSection
        title="Cloud guards"
        description="What this server refuses to pass on from PetKit's cloud. Turning the proxy on needs step-up."
      >
        <SettingsRow
          label="Proxy to PetKit's cloud"
          badge={<StepUpPill>Step-up</StepUpPill>}
          description="Off. Only for adding a model nobody has captured yet."
          configKey="proxy_mode"
          control={p => <Switch {...p} checked={proxy} onCheckedChange={setProxy} />}
        />
        <SettingsRow
          label="Block firmware updates"
          description="Stops the cloud pushing new firmware."
          configKey="proxy_block_ota"
          control={p => <Switch {...p} checked={blockOta} onCheckedChange={setBlockOta} />}
        />
      </SettingsSection>
      <SettingsSection
        title="Upstream and capture"
        description="Where proxied requests go. Only used while the proxy is on."
      >
        <SettingsRow
          kind="field"
          label="Upstream host"
          configKey="proxy_upstream"
          control={p => (
            <TextInput
              {...p}
              mono
              alignEnd
              value={host}
              onChange={e => {
                setHost(e.target.value);
              }}
            />
          )}
        />
        <SettingsRow
          kind="field"
          label="Keep blocked attempts"
          control={p => <NumberInput {...p} mono value={keepDays} onValueChange={setKeepDays} />}
        />
        <SettingsRow
          kind="field"
          label="Evening meal"
          control={p => <TimeInput {...p} value={meal} onValueChange={setMeal} />}
        />
      </SettingsSection>

      <section id="log" className="flex flex-col gap-2" aria-label="Server log">
        <div className={ROW}>
          <SearchField
            aria-label="Search log lines"
            placeholder="grep"
            mono
            value={query}
            onValueChange={setQuery}
            className="max-w-[360px] flex-[1_1_240px]"
          />
          <InlineField label="Level">
            <Select
              options={[
                { value: 'all', label: 'All levels' },
                { value: 'warn', label: 'Warnings and errors' },
              ]}
            />
          </InlineField>
          <Switch small label="Hide heartbeats" checked={hideHb} onCheckedChange={setHideHb} />
        </div>
        <Table
          label="Server log lines"
          role="log"
          variant="log"
          columns={logColumns}
          rows={fixtureLog}
          rowKey={l => l.id}
          levelOf={l => l.level}
          minWidth={760}
        />
        <Table
          label="Empty table"
          columns={logColumns}
          rows={[]}
          rowKey={l => l.id}
          emptyText="No device logs uploaded yet."
        />
      </section>

      <div className={TWO}>
        <div className="flex flex-col gap-4">
          <Tabs
            label="Screen"
            tabs={[
              { id: 'sign', label: 'Sign in' },
              { id: 'first', label: 'First run' },
              { id: 'pair', label: 'Pair the app' },
            ]}
            selected={tab}
            onSelect={setTab}
          >
            <SegmentedChips
              label="Cat shown in colour"
              options={[
                { id: 'miso', label: 'Miso' },
                { id: 'mochi', label: 'Mochi' },
              ]}
              value={cat}
              onChange={setCat}
            />
          </Tabs>
          <EmptyBlock>No channel usage in this range.</EmptyBlock>
          <span className={ROW} aria-busy="true">
            <Skeleton width={56} height={28} />
            <Skeleton width={160} height={14} />
          </span>
        </div>
        <CollapsiblePanel
          title="Debug info"
          summary="Raw state from the last report"
          storageKey="gallery.debug.open"
        >
          <span className="font-mono">workState 0 · lightState 0</span>
        </CollapsiblePanel>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Clean the litter box now?"
        confirmLabel="Clean now"
        onConfirm={() => {
          setLastAnswer('Clean now sent.');
          setConfirmOpen(false);
        }}
        onCancel={() => {
          setConfirmOpen(false);
        }}
      >
        <p>The drum turns once and drops waste into the bin. A cat inside stops it.</p>
      </ConfirmDialog>
    </div>
  );
}
