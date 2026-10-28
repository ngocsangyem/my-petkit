// Test fixtures in the shapes of the contract (packages/contracts/openapi.yaml).
// The design's sample data lives here only; the screen renders API data.
import type { components } from '@/api/schema';

type Summary = components['schemas']['DeviceSummary'];
type Detail = components['schemas']['DeviceDetail'];
type Entity = components['schemas']['DeviceEntity'];
type Accessory = components['schemas']['BleAccessory'];

/** 2026-10-28 14:47:00 in UTC+7, as epoch seconds. */
export const NOW = Date.UTC(2026, 9, 28, 7, 47, 0) / 1000;

export function entity(over: Partial<Entity> & Pick<Entity, 'key' | 'component'>): Entity {
  return {
    name: over.key,
    value_path: `state.${over.key}`,
    unit: null,
    device_class: null,
    icon: null,
    options: null,
    option_values: null,
    settable: false,
    entity_category: null,
    min: null,
    max: null,
    step: null,
    value: null,
    ...over,
  };
}

export function summary(over: Partial<Summary> & Pick<Summary, 'id' | 'type' | 'name'>): Summary {
  return {
    sn: '',
    mac: '',
    firmware: '',
    online: true,
    mqtt_connected: true,
    is_camera: false,
    is_feeder: false,
    supports_ai: false,
    pk: 'pk',
    dn: 'dn',
    last_heartbeat: 0,
    last_state_report: NOW - 12,
    last_seen: NOW - 12,
    last_mqtt: NOW - 12,
    mqtt_subscriptions: [],
    mqtt_delivery: null,
    queue: 0,
    http_count: 1,
    mqtt_count: 2,
    entities: 0,
    ble: [],
    ...over,
  };
}

export function detail(s: Summary, over: Partial<Detail> = {}): Detail {
  return {
    ...s,
    state: {},
    settings: {},
    config: {},
    diag: {},
    streams: {},
    schedules: [],
    entities: [],
    actions: [],
    capInfo: null,
    timezoneInfo: { effective: 7, override: null, reported: null, locale: '', source: 'device' },
    logInfo: { ok: true, log_upload_enabled: false, reason: '' },
    aiInfo: null,
    ...over,
  };
}

export const litterSummary = summary({
  id: 100234567,
  type: 't6',
  name: 'Purobot Ultra T6',
  sn: 'SN-T6',
  is_camera: true,
  supports_ai: true,
  entities: 6,
  ble: [{ id: 900001, type: 'k3', mac: 'AA:BB:CC:DD:EE:FF' }],
});

export const litterDetail = detail(litterSummary, {
  streams: { rtsp: 'rtsp://192.168.1.20:8554/litter', flv: 'http://192.168.1.30/live.flv' },
  entities: [
    entity({ key: 'package_count', component: 'sensor', value: 14 }),
    entity({ key: 'litter_percent', component: 'sensor', unit: '%', value: 62 }),
    entity({ key: 'n60_spray_days', component: 'sensor', unit: 'days', value: 3 }),
    entity({
      key: 'device_status',
      component: 'sensor',
      name: 'Device Status',
      options: ['idle', 'cleaning'],
      option_values: [-1, 0],
      value: -1,
    }),
    entity({
      key: 'cleaning_delay',
      component: 'number',
      name: 'Clean Delay',
      min: 1,
      max: 60,
      step: 1,
      unit: 'min',
      value: 5,
      settable: true,
    }),
    entity({ key: 'camera', component: 'camera', value_path: '' }),
  ],
  actions: [
    { key: 'dump_litter', name: 'Dump Litter', destructive: true },
    { key: 'clean', name: 'Clean Now', destructive: false },
  ],
  capInfo: {
    is_camera: true,
    capabilities: { fullVideo: true, eventImage: true, highLight: false, dynamicVideo: true },
  },
  aiInfo: { supports_ai: true, ai_enabled: true },
});

export const feederSummary = summary({
  id: 100198342,
  type: 'd4sh',
  name: 'YumShare Dual-Hopper',
  is_camera: true,
  is_feeder: true,
  mqtt_connected: false,
});

export const feederDetail = detail(feederSummary, {
  timezoneInfo: { effective: 2, override: 2, reported: 7, locale: '', source: 'override' },
});

export const accessory: Accessory = {
  petkit_id: 900002,
  ble_type: 'ctw3',
  name: 'EverSweet Max Cordless',
  parent_name: 'Purobot Ultra T6',
  parent_type: 't6',
  parent_online: true,
  last_seen: NOW - 60,
  entities: [
    {
      component: 'button',
      key: 'ctw3_reset_filter',
      name: 'Reset Filter',
      value_path: null,
      unit: null,
      device_class: null,
      icon: null,
      options: null,
      option_values: null,
      settable: true,
      entity_category: null,
      min: null,
      max: null,
      step: null,
      value: null,
    },
  ],
  mac: '11:22:33:44:55:66',
  secret: '[redacted 16 chars]',
  interval: 240,
  link_with: litterSummary.id,
  serial_number: '',
  scan_type: 0,
  scan_type_is_guessed: true,
  wire_entry: { id: 900002, secret: '', type: 14, mac: '112233445566', interval: 240 },
  state: {},
};

export function timeline(date: string, sessions: components['schemas']['TimelineSession'][] = []) {
  return {
    date,
    tz_offset: 25200,
    counts: {
      all: 0,
      pet: 0,
      toileting: 0,
      drinking: 0,
      feeding: 0,
      cleaning: 0,
      health_alert: 0,
      fault: 0,
    },
    sessions,
  };
}
