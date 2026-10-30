// Test fixtures in the shapes of packages/contracts (TimelineDay, DeviceSummary, PetWithFaces).
// Names and numbers are sample data from the design, used only in tests.
import type { TimelineDevice, TimelinePet } from './api';
import type { MediaSlots, TimelineDay, TimelineSession } from './timeline-model';

export const DAY = '2026-10-28';
/** 2026-10-28 00:00 in Asia/Saigon (UTC+7). */
export const DAY_START = Date.UTC(2026, 9, 28) / 1000 - 7 * 3600;

export function slots(over: Partial<MediaSlots> = {}): MediaSlots {
  return {
    highlight_url: null,
    playback_url: null,
    preview_url: null,
    poster_url: null,
    waste: [],
    health: [],
    snapshot_url: null,
    video_pending: false,
    ...over,
  };
}

export function session(over: Partial<TimelineSession> = {}): TimelineSession {
  return {
    pet_source: 'device',
    passing: false,
    unbound_pet_ref: null,
    kind: 'visit',
    id: 501,
    related_event: 'ep-1',
    device_id: 10000001,
    device_name: 'Purobot Max Pro 2',
    ts: DAY_START + 13 * 3600 + 58 * 60 + 120,
    display_ts: DAY_START + 13 * 3600 + 58 * 60,
    pet_id: 1,
    event_type: '10',
    pet_name: 'Miso',
    pet_photo_url: 'api/pets/1/faces/3/photo',
    label: null,
    event_kind: 'toilet_visit',
    duration_sec: 115,
    weight: 5430,
    bits: ['waste 42 g'],
    sub_events: [
      {
        id: 502,
        event_type: '5',
        ts: DAY_START + 14 * 3600 + 5 * 60,
        label: 'Auto clean',
        detail: false,
      },
      {
        id: 503,
        event_type: '17',
        ts: DAY_START + 14 * 3600 + 6 * 60,
        label: 'Light on',
        detail: true,
      },
    ],
    media: slots({
      waste: ['T5 #SN-1/Waste/a.jpg', 'T5 #SN-1/Waste/b.jpg'],
      snapshot_url: 'T5 #SN-1/Snapshots/s.jpg',
      video_pending: true,
    }),
    ...over,
  };
}

export const SESSIONS: TimelineSession[] = [
  session(),
  session({
    id: 401,
    pet_id: 2,
    pet_name: 'Mochi',
    pet_source: 'weight',
    pet_photo_url: null,
    display_ts: DAY_START + 11 * 3600 + 5 * 60,
    ts: DAY_START + 11 * 3600 + 7 * 60,
    duration_sec: 110,
    weight: 3860,
    bits: [],
    sub_events: [],
    media: slots({ highlight_url: 'T5 #SN-1/Clips/c.mp4', preview_url: 'T5/Timelapse/t.m3u8' }),
  }),
  session({
    kind: 'event',
    id: 301,
    pet_id: null,
    pet_source: null,
    pet_name: null,
    pet_photo_url: null,
    event_kind: 'feeding',
    label: 'Meal dispensed',
    display_ts: DAY_START + 7 * 3600,
    ts: DAY_START + 7 * 3600,
    duration_sec: null,
    weight: null,
    bits: [],
    sub_events: [],
    device_id: 20000002,
    device_name: 'Fresh Element Solo',
    media: slots(),
  }),
];

export function day(over: Partial<TimelineDay> = {}): TimelineDay {
  return {
    date: DAY,
    tz_offset: 7 * 3600,
    counts: {
      all: 3,
      pet: 0,
      toileting: 2,
      drinking: 0,
      feeding: 1,
      cleaning: 0,
      health_alert: 0,
      fault: 0,
      passing: 0,
    },
    sessions: SESSIONS,
    ...over,
  };
}

function device(id: number, name: string, isFeeder: boolean): TimelineDevice {
  return {
    id,
    type: isFeeder ? 'd4' : 't5',
    name,
    sn: '',
    mac: '',
    firmware: '1.0',
    online: true,
    mqtt_connected: false,
    is_camera: !isFeeder,
    is_feeder: isFeeder,
    supports_ai: false,
    pk: '',
    dn: '',
    last_heartbeat: null,
    last_state_report: null,
    last_seen: null,
    last_mqtt: null,
    mqtt_subscriptions: [],
    mqtt_delivery: null,
    queue: 0,
    http_count: 0,
    mqtt_count: 0,
    entities: 0,
    ble: [],
  };
}

export const DEVICES: TimelineDevice[] = [
  device(10000001, 'Litter box', false),
  device(20000002, 'Kitchen feeder', true),
];

export function pet(
  id: number,
  name: string,
  faces: { id: number; url: string }[],
  weightG: number | null = null,
): TimelinePet {
  return {
    id,
    name,
    device_ids_json: null,
    device_pet_ids_json: null,
    face_id: null,
    photo_path: null,
    weight: null,
    weight_g: weightG,
    weight_updated_at: null,
    weight_tolerance_g: null,
    weight_match: 1,
    created_at: 0,
    faces,
  };
}

export const PETS: TimelinePet[] = [
  pet(1, 'Miso', [{ id: 3, url: 'api/pets/1/faces/3/photo' }], 5430),
  pet(2, 'Mochi', [], 3860),
];
