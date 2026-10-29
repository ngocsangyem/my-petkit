// The server side of the artboards: version 2.1.0 on 192.168.1.20, cloud guards
// on and the proxy off, one paired phone, three capture files, six patches on the
// litter box (two applied) and the live log of the last few minutes.
import type { components, paths } from '@/api/schema';
import { NOW } from '@/features/devices/devices-fixtures';
import { serverInfoFixture } from '@/features/provision/provision-fixtures';
import { FEEDER_ID, FOUNTAIN_ID, LITTER_ID, at } from './fixtures-devices';

/** The JSON body a GET route answers with, straight from the generated contract. */
export type JsonOf<P extends keyof paths> = paths[P] extends {
  get: { responses: { 200: { content: { 'application/json': infer T } } } };
}
  ? T
  : never;

type HubEvent = components['schemas']['LogsHubEvent'];
type PatcherEntry = components['schemas']['PatcherEntry'];

export const SERVER_INFO: JsonOf<'/api/info'> = {
  ...serverInfoFixture('192.168.1.20'),
  version: '2.1.0',
  device_count: 3,
  ai_device_names: ['Purobot Ultra T6'],
  settings: {
    ...serverInfoFixture(null).settings,
    proxy_upstream: 'https://api.petkt.example',
    proxy_dns: '1.1.1.1',
  },
  upstreams: [{ key: 'global', url: 'https://api.petkt.example', default: true }],
  redactions: { server_address: 412, mqtt_host: 96 },
  upstream: {},
};

const cap = (max_days: number | null, max_mb: number | null = null) => ({ max_days, max_mb });

export const RETENTION: JsonOf<'/api/retention'> = {
  retention: {
    fullVideo: cap(7, 4000),
    eventImage: cap(30, 1000),
    highLight: cap(14),
    dynamicVideo: cap(14, 2000),
    cloudDouble: cap(7),
    wasteCheck: cap(30),
    healthPic: cap(30),
    events: cap(90),
    blocked: cap(30),
    deviceLog: cap(14, 200),
    rawUpload: cap(3),
    thumbnail: cap(30),
  },
};

export const BLOCKED: JsonOf<'/api/blocked'> = {
  records: [
    {
      id: 2,
      device_id: LITTER_ID,
      kind: 'run_cmd',
      transport: 'mqtt',
      endpoint: 'thing/service/run_cmd',
      payload_json: '{"cmd":"••••"}',
      upstream: 'api.petkt.example',
      field_path: 'params.cmd',
      detail_json: null,
      created_at: NOW - 2 * 86400,
    },
    {
      id: 1,
      device_id: FEEDER_ID,
      kind: 'ota',
      transport: 'http',
      endpoint: '/6/d4sh/dev_ota_check',
      payload_json: '{"url":"••••"}',
      upstream: 'api.petkt.example',
      field_path: 'result.url',
      detail_json: null,
      created_at: NOW - 4 * 86400,
    },
  ],
  counts: { run_cmd: 1, ota: 1 },
};

export const TOKENS: JsonOf<'/api/auth/tokens'> = {
  tokens: [{ id: 1, name: 'Sang’s iPhone', created_at: NOW - 16 * 86400, last_used: NOW - 300 }],
};

export const PAIRING = {
  code: '482 913',
  expires_at: NOW + 300,
  expires_in: 300,
  qr: { url: 'https://192.168.1.20:8443/', cert_sha256: 'ab:cd:ef:01', code: '482913' },
};

export const CAPTURE: JsonOf<'/api/capture'> = {
  dir: '/data/capture',
  enabled: false,
  files: [
    { name: 'requests.jsonl', size: 2_400_000, lines: 9120 },
    { name: 'mqtt.jsonl', size: 6_100_000, lines: 20_544 },
    { name: 'state_report.jsonl', size: 880_000, lines: 1254 },
  ],
};

/** The masked tail of a capture file, minute by minute from 08:12. */
export function captureTail(name: string): JsonOf<'/api/capture/{name}'> {
  const paths = ['/6/t6/dev_heartbeat', '/6/d4sh/dev_feed_get', '/6/t6/dev_state_report'];
  const records = Array.from({ length: 18 }, (_, i) => ({
    t: `08:${String(12 + i).padStart(2, '0')}:07`,
    path: paths[i % paths.length],
    dev: String(i % 3 === 1 ? FEEDER_ID : LITTER_ID),
    secret: '••••',
    file: name,
  }));
  return { records, total: 9120 };
}

function patch(
  id: PatcherEntry['id'],
  name: string,
  description: string,
  needs_bytes: number,
  applied = false,
): PatcherEntry {
  return {
    id,
    name,
    description,
    status: applied ? 'applied' : 'not applied',
    applied,
    unavailable: '',
    greyed: false,
    needs_bytes,
  };
}

export function patcherStatus(deviceId: number): JsonOf<'/api/devices/{id}/patcher'> {
  if (deviceId !== LITTER_ID) return { patchers: {}, device_ip: '', supported: false };
  const entries = [
    patch('cacert', 'CA certificate', 'Adds this server’s CA to the trust store', 4096, true),
    patch('mqtt', 'MQTT TLS bypass', 'Accepts this server’s broker certificate', 2_100_000, true),
    patch('cloud', 'Local storage', 'Lets uploads go to a LAN address', 1_800_000),
    patch('camera', 'Local camera streaming', 'Starts the local video server', 1_100_000),
    patch('talk', 'Two-way talk', 'Adds an audio sink on port 9010 (no auth)', 320_000),
    {
      ...patch('ssh', 'Persistent SSH', 'Root SSH on port 22, key only', 410_000),
      needs_pubkey: true,
    },
  ];
  return {
    patchers: Object.fromEntries(entries.map(e => [e.id, e])),
    device_ip: '192.168.1.20',
    supported: true,
  };
}

const http = (seq: number, ts: number, device: number | null, summary: string, status = 200) => ({
  seq,
  ts,
  kind: 'http',
  device_id: device,
  summary,
  detail: { status },
});

/** The hub's ring: the last few minutes before 14:47. */
export const EVENTS: HubEvent[] = [
  http(101, at(14, 40, 12), LITTER_ID, 'POST /6/t6/dev_heartbeat'),
  http(102, at(14, 41, 40), LITTER_ID, 'event write · state_report · bags 14 · litter 62%'),
  {
    seq: 103,
    ts: at(14, 42, 3),
    kind: 'live',
    device_id: null,
    summary: 'go2rtc stream start · litter · rtsp://192.168.1.20:8554/litter',
  },
  http(104, at(14, 42, 40), FEEDER_ID, 'POST /6/d4sh/dev_heartbeat'),
  {
    seq: 105,
    ts: at(14, 43, 50),
    kind: 'blocked',
    device_id: FOUNTAIN_ID,
    summary: 'command not delivered · no route to device, offline since 06:10',
  },
  {
    seq: 106,
    ts: at(14, 44, 26),
    kind: 'mqtt',
    device_id: LITTER_ID,
    summary: 'MQTT CONNECT client 100234567 · keepalive 60 s',
  },
  {
    seq: 107,
    ts: at(14, 44, 26) + 0.4,
    kind: 'mqtt',
    device_id: LITTER_ID,
    summary: 'MQTT SUBSCRIBE thing/service/start',
  },
  {
    seq: 108,
    ts: at(14, 45, 30),
    kind: 'redact',
    device_id: FOUNTAIN_ID,
    summary: 'no report since 06:10 · 8 h 35 m',
  },
  http(109, at(14, 46, 48), LITTER_ID, 'event write · state_report · idle, last clean 14:05'),
];

let liveSeq = 200;

/** One more line for the live stream, stamped now. */
export function liveEvent(): HubEvent {
  liveSeq += 1;
  return http(liveSeq, Date.now() / 1000, LITTER_ID, 'event write · state_report · idle');
}

export const DEVICE_LOGS: JsonOf<'/api/devicelogs'> = {
  dir: '/data/devicelogs',
  reason: '',
  enabled_devices: [LITTER_ID, FEEDER_ID],
  total_bytes: 520_000,
  files: [
    {
      rel: `${LITTER_ID}/20261028-0300.log`,
      name: '20261028-0300.log',
      device: LITTER_ID,
      size: 412_000,
      mtime: at(3, 0),
    },
    {
      rel: `${FEEDER_ID}/20261027-1944.log`,
      name: '20261027-1944.log',
      device: FEEDER_ID,
      size: 96_000,
      mtime: at(19, 44) - 86400,
    },
  ],
};

export function deviceLogWindow(): JsonOf<'/api/devicelogs/{path}'> {
  const lines: [number, string][] = Array.from({ length: 40 }, (_, i) => [
    i + 1,
    `[03:00:${String(i).padStart(2, '0')}] ctrl: state idle, bags 14, litter 62`,
  ]);
  return { lines, total: 40, matched: 40, offset: 0, limit: 500, size: 412_000 };
}
