// Test fixtures in the shapes of the contract. Sample names and ids only; the
// screen never renders these outside tests.
import type { DeviceDetail, DeviceSummary, Pet, UnboundRef } from './pet-model';

export function deviceSummary(over: Partial<DeviceSummary> = {}): DeviceSummary {
  return {
    id: 10001,
    type: 't5',
    name: 'Litter box',
    sn: 'SN1',
    mac: 'aa:bb',
    firmware: '1.0',
    online: true,
    mqtt_connected: true,
    is_camera: true,
    is_feeder: false,
    supports_ai: true,
    pk: 'pk',
    dn: 'dn',
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
    ...over,
  };
}

export function deviceDetail(
  over: Partial<DeviceDetail> = {},
  discernPic?: unknown[],
  aiEnabled = true,
): DeviceDetail {
  return {
    // A detail carries the entities themselves where the summary has their count.
    ...deviceSummary(),
    state: discernPic ? { discernPic } : {},
    settings: {},
    config: {},
    diag: {},
    streams: {},
    schedules: [],
    entities: [],
    actions: [],
    capInfo: null,
    timezoneInfo: { effective: 7, override: null, reported: 7, locale: '', source: 'device' },
    logInfo: { ok: true, log_upload_enabled: false, reason: '' },
    aiInfo: { supports_ai: true, ai_enabled: aiEnabled },
    ...over,
  };
}

export function pet(over: Partial<Pet> = {}): Pet {
  return {
    id: 1,
    name: 'Miso',
    device_ids_json: '[10001]',
    device_pet_ids_json: '[88412]',
    face_id: null,
    photo_path: null,
    weight: null,
    created_at: 1761600000,
    faces: [
      { id: 11, url: 'api/pets/1/faces/11/photo' },
      { id: 12, url: 'api/pets/1/faces/12/photo' },
    ],
    ...over,
  };
}

export const unboundRef: UnboundRef = { pet_ref: 555, count: 3, last_ts: 1761620000 };
