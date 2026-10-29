// Sample data from the design artboards, for the dev gallery and tests only.
// Screens render real API data; nothing here may be imported by a feature.
import type { FigureCell } from './figure-container';
import type { DayStripLane } from './household-day-strip';
import type { DeviceStatus } from './status-mark';
import type { LogLevel } from './table';

const at = (h: number, m: number) => h * 60 + m;

export const fixtureNowMinute = at(14, 47);

export const fixtureLanes: DayStripLane[] = [
  {
    kind: 'pet',
    id: 'miso',
    name: 'Miso',
    petIndex: 0,
    visits: [
      { minute: at(1, 12), title: '01:12 · 2 min 10 s · 5.41 kg' },
      { minute: at(8, 31), title: '08:31 · 2 min 40 s · 5.42 kg' },
      { minute: at(13, 58), title: '13:58 · 1 min 55 s · 5.43 kg' },
    ],
  },
  {
    kind: 'pet',
    id: 'mochi',
    name: 'Mochi',
    petIndex: 1,
    visits: [
      { minute: at(3, 47), title: '03:47 · 1 min 32 s · 3.87 kg' },
      { minute: at(11, 5), title: '11:05 · 1 min 50 s · 3.86 kg' },
    ],
  },
  {
    kind: 'feeder',
    id: 'feeder',
    name: 'Kitchen feeder',
    meals: [
      { minute: at(7, 0), fed: true, title: '07:00 · fed 20 g' },
      { minute: at(12, 0), fed: true, title: '12:00 · fed 15 g' },
      { minute: at(18, 0), fed: false, title: '18:00 · 20 g planned' },
      { minute: at(22, 0), fed: false, title: '22:00 · 10 g planned' },
    ],
  },
  {
    kind: 'fountain',
    id: 'fountain',
    name: 'Water fountain',
    spans: [
      { start: 0, end: at(6, 10), state: 'reporting', title: 'Reporting 00:00–06:10' },
      { start: at(6, 10), end: at(14, 47), state: 'no-report', title: 'No report 06:10–14:47' },
    ],
  },
];

export interface FixtureDeviceRow {
  id: string;
  name: string;
  model: string;
  deviceId: string | null;
  status: DeviceStatus;
  now: string | null;
  attention: string | null;
  attentionTone: 'warning' | 'negative' | null;
  last: string;
}

export const fixtureDevices: FixtureDeviceRow[] = [
  {
    id: 'a',
    name: 'Litter box',
    model: 'Purobot Ultra T6',
    deviceId: '100234567',
    status: 'online',
    now: 'Idle, cleaned 14:05',
    attention: 'N60 deodorizer in 3 days',
    attentionTone: 'warning',
    last: '12 s ago',
  },
  {
    id: 'b',
    name: 'Kitchen feeder',
    model: 'YumShare Dual-Hopper D4SH',
    deviceId: '100198342',
    status: 'polling',
    now: 'Next meal 18:00',
    attention: null,
    attentionTone: null,
    last: '40 s ago',
  },
  {
    id: 'c',
    name: 'Water fountain',
    model: 'EverSweet Ultra AI W7H',
    deviceId: '100155021',
    status: 'offline',
    now: 'Last: water 40 %',
    attention: 'No report since 06:10',
    attentionTone: 'negative',
    last: '8 h 37 m ago',
  },
  {
    id: 'd',
    name: 'Pura Air spray',
    model: 'K3 · relayed by the litter box',
    deviceId: null,
    status: 'unknown',
    now: null,
    attention: null,
    attentionTone: null,
    last: '2 d ago',
  },
];

export const fixtureFigures: FigureCell[] = [
  { label: 'Bags left', value: 14 },
  { label: 'Litter level', value: 62, unit: '%' },
  { label: 'Visits today', value: 5 },
  { label: 'Bin', value: null, missingText: 'Not reported' },
];

export const fixtureConsumables = [
  { name: 'N60 deodorizer', days: 3, max: 30, tone: 'warning' as const },
  { name: 'N50 deodorant', days: 19, max: 30, tone: 'accent' as const },
  { name: 'Desiccant', days: 26, max: 30, tone: 'accent' as const },
];

export interface FixtureLogLine {
  id: string;
  time: string;
  level: LogLevel;
  device: string;
  message: string;
}

export const fixtureLog: FixtureLogLine[] = [
  {
    id: '1',
    time: '14:41:40',
    level: 'info',
    device: '100234567',
    message: 'event write · state_report · bags 14 · litter 62%',
  },
  {
    id: '2',
    time: '14:42:03',
    level: 'info',
    device: 'server',
    message: 'go2rtc stream start · litter · rtsp://192.168.1.20:8554/litter',
  },
  {
    id: '3',
    time: '14:43:50',
    level: 'error',
    device: '100155021',
    message: 'command not delivered · no route to device, offline since 06:10',
  },
  {
    id: '4',
    time: '14:44:26',
    level: 'info',
    device: '100234567',
    message: 'MQTT CONNECT client 100234567 · keepalive 60 s',
  },
  {
    id: '5',
    time: '14:45:30',
    level: 'warn',
    device: '100155021',
    message: 'no report since 06:10 · 8 h 35 m',
  },
];
