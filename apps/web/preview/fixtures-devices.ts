// The household of the artboards: a T6 litter box, a dual-hopper feeder, a
// water fountain that went quiet at 06:10, and a K3 spray relayed by the box.
// Built from the screen tests' fixture helpers so the shapes stay the contract's.
import type { components } from '@/api/schema';
import { NOW, detail, entity, summary } from '@/features/devices/devices-fixtures';
import { DAY_START } from '@/features/timeline/timeline-fixtures';

type Accessory = components['schemas']['BleAccessory'];
type AccessoryEntity = components['schemas']['BleAccessoryEntity'];
type Detail = components['schemas']['DeviceDetail'];
type Sound = components['schemas']['Sound'];

/** Epoch seconds of `h:m:s` on the fixtures' day, Asia/Saigon. */
export const at = (h: number, m: number, s = 0) => DAY_START + h * 3600 + m * 60 + s;

export const LITTER_ID = 100234567;
export const FEEDER_ID = 100198342;
export const FOUNTAIN_ID = 100155021;
export const SPRAY_ID = 100177310;

/** Face ids the litter box reports as downloaded: Miso's three, not Mochi's yet. */
const DOWNLOADED_FACES = [11, 12, 13];

const zone = { effective: 7, override: null, reported: 7, locale: '', source: 'device' } as const;

const litter = summary({
  id: LITTER_ID,
  type: 't6',
  name: 'Litter box',
  sn: '20240611T6A0001',
  mac: 'A4:C1:38:5B:20:01',
  firmware: '1.2.86',
  is_camera: true,
  supports_ai: true,
  entities: 9,
  ble: [{ id: SPRAY_ID, type: 'k3', mac: 'A4:C1:38:77:0C:03' }],
});

const feeder = summary({
  id: FEEDER_ID,
  type: 'd4sh',
  name: 'Kitchen feeder',
  sn: '20240302D4SH0042',
  firmware: '2.4.10',
  is_camera: true,
  is_feeder: true,
  mqtt_connected: false,
  last_state_report: NOW - 40,
  last_seen: NOW - 40,
  last_heartbeat: NOW - 40,
  last_mqtt: null,
});

const fountain = summary({
  id: FOUNTAIN_ID,
  type: 'w7h',
  name: 'Water fountain',
  firmware: '1.0.33',
  online: false,
  mqtt_connected: false,
  last_state_report: at(6, 10),
  last_seen: at(6, 10),
  last_mqtt: at(6, 10),
});

export const DEVICES = [litter, feeder, fountain];

/** Meals every day at 07:00, 12:00, 18:00 and 22:00, as the D4SH sends them (seconds). */
const FEED_PLAN = {
  schedule: [
    {
      re: '1,2,3,4,5,6,7',
      it: [7, 12, 18, 22].map((h, i) => ({ id: i + 1, t: h * 3600, a1: 1, a2: 1 })),
    },
  ],
};

export const DETAILS = new Map<number, Detail>([
  [
    LITTER_ID,
    detail(litter, {
      timezoneInfo: zone,
      state: { ip: '192.168.1.20', discernPic: DOWNLOADED_FACES, workState: null },
      streams: { rtsp: 'rtsp://192.168.1.20:8554/litter' },
      entities: [
        entity({ key: 'package_count', component: 'sensor', name: 'Bags left', value: 14 }),
        entity({ key: 'litter_percent', component: 'sensor', unit: '%', value: 62 }),
        entity({ key: 'waste_bin', component: 'binary_sensor', name: 'Bin full', value: null }),
        entity({
          key: 'device_status',
          component: 'sensor',
          name: 'Device Status',
          options: ['idle', 'cleaning'],
          option_values: [-1, 0],
          value: -1,
        }),
        entity({
          key: 'last_clean',
          component: 'sensor',
          device_class: 'timestamp',
          value: at(14, 5),
        }),
        entity({ key: 'n60_spray_days', component: 'sensor', unit: 'days', value: 3 }),
        entity({ key: 'n50_durability', component: 'sensor', unit: 'days', value: 19 }),
        entity({ key: 'desiccant_days', component: 'sensor', unit: 'days', value: 26 }),
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
        { key: 'clean', name: 'Clean now', destructive: false },
        { key: 'dump_litter', name: 'Empty the litter', destructive: true },
      ],
      capInfo: {
        is_camera: true,
        capabilities: { fullVideo: true, eventImage: true, highLight: false, dynamicVideo: true },
      },
      aiInfo: { supports_ai: true, ai_enabled: true },
    }),
  ],
  [
    FEEDER_ID,
    detail(feeder, {
      timezoneInfo: zone,
      schedules: [
        { target: 'feed', name: 'Meal plan', kind: 'feed', value: FEED_PLAN, dual: true },
      ],
      entities: [
        entity({ key: 'total_dispensed', component: 'sensor', unit: 'g', value: 35 }),
        entity({ key: 'amount_eaten', component: 'sensor', unit: 'g', value: 28 }),
        entity({ key: 'food_in_bowl', component: 'sensor', unit: 'g', value: 7 }),
        entity({ key: 'food_low', component: 'binary_sensor', value: 0 }),
      ],
      actions: [{ key: 'feed', name: 'Feed one portion', destructive: false }],
    }),
  ],
  [
    FOUNTAIN_ID,
    detail(fountain, {
      timezoneInfo: zone,
      entities: [
        entity({ key: 'water_level', component: 'sensor', unit: '%', value: 40 }),
        entity({ key: 'filter_days', component: 'sensor', unit: 'days', value: 9 }),
        entity({ key: 'drink_times', component: 'sensor', value: 6 }),
        entity({ key: 'water_lack', component: 'binary_sensor', value: 0 }),
        entity({
          key: 'mode',
          component: 'select',
          options: ['Normal', 'Smart'],
          option_values: [1, 2],
          value: 2,
          settable: true,
        }),
      ],
    }),
  ],
]);

/** An accessory entity: the device entity's fields, with no state path. */
function accessoryEntity(
  over: Partial<AccessoryEntity> & Pick<AccessoryEntity, 'key' | 'component'>,
): AccessoryEntity {
  return {
    name: over.key,
    value_path: null,
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

export const ACCESSORIES: Accessory[] = [
  {
    petkit_id: SPRAY_ID,
    ble_type: 'k3',
    name: 'Pura Air spray',
    parent_name: 'Litter box',
    parent_type: 't6',
    parent_online: true,
    last_seen: NOW - 2 * 86400,
    entities: [
      accessoryEntity({ key: 'battery', component: 'sensor', unit: '%', value: 71 }),
      accessoryEntity({ key: 'k3_spray', component: 'button', name: 'Spray now', settable: true }),
    ],
    mac: 'A4:C1:38:77:0C:03',
    secret: '[redacted 16 chars]',
    interval: 240,
    link_with: LITTER_ID,
    serial_number: '',
    scan_type: 0,
    scan_type_is_guessed: false,
    wire_entry: { id: SPRAY_ID, secret: '', type: 14, mac: 'A4C138770C03', interval: 240 },
    state: { battery: 71 },
  },
];

export const SOUNDS: Sound[] = [
  {
    id: 1,
    name: 'Dinner bell',
    filename: 'dinner-bell.mp3',
    size: 48_210,
    digest: 'b2f1c4',
    duration: 3,
    uploaded_at: NOW - 9 * 86400,
  },
];
