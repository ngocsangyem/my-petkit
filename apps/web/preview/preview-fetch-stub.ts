// The preview's API: a `fetch` that answers every route the screens call from
// the fixtures, without a server. Reads answer from the fixtures; writes answer
// a plausible success and change nothing, so a click never breaks the page.
import { NOW } from '@/features/devices/devices-fixtures';
import {
  ACCESSORIES,
  DETAILS,
  DEVICES,
  SOUNDS,
  litterAutomationFor,
  liveInfo,
} from './fixtures-devices';
import {
  BLOCKED,
  CAPTURE,
  DEVICE_LOGS,
  EVENTS,
  PAIRING,
  RETENTION,
  SERVER_INFO,
  TOKENS,
  captureTail,
  deviceLogWindow,
  patcherStatus,
} from './fixtures-server';
import { PETS, UNBOUND, eventDetail, timelineDay } from './fixtures-timeline-pets';

interface Hit {
  params: Record<string, string>;
  query: URLSearchParams;
}
type Answer = unknown;
type Handler = (hit: Hit) => Answer;

/** `{name}` matches one segment; `{path*}` the rest of the path. */
function compile(pattern: string): RegExp {
  const source = pattern.replace(/\{(\w+)\*\}/g, '(?<$1>.+)').replace(/\{(\w+)\}/g, '(?<$1>[^/]+)');
  return new RegExp(`^${source}$`);
}

const id = (hit: Hit) => Number(hit.params.id);
const NOT_FOUND = Symbol('not found');

const GETS: [string, Handler][] = [
  ['/api/info', () => SERVER_INFO],
  ['/api/devices', () => DEVICES],
  ['/api/devices/{id}', hit => DETAILS.get(id(hit)) ?? NOT_FOUND],
  ['/api/devices/{id}/patcher', hit => patcherStatus(id(hit))],
  ['/api/devices/{id}/sounds', () => ({ sounds: SOUNDS })],
  ['/api/devices/{id}/deferred-feed', () => ({ deferred: [] })],
  ['/api/devices/{id}/live', hit => liveInfo(id(hit))],
  ['/api/devices/{id}/litter-automation', hit => litterAutomationFor(id(hit))],
  ['/api/ble', () => ({ accessories: ACCESSORIES })],
  ['/api/pets', () => ({ pets: PETS })],
  ['/api/pets/unbound', () => ({ unbound: UNBOUND })],
  [
    '/api/pets/{id}',
    hit => {
      const pet = PETS.find(p => p.id === id(hit));
      return pet ? { pet } : NOT_FOUND;
    },
  ],
  ['/api/timeline', hit => timelineDay(hit.query)],
  ['/api/timeline/{id}', hit => eventDetail(id(hit)) ?? NOT_FOUND],
  ['/api/events', () => EVENTS],
  ['/api/devicelogs', () => DEVICE_LOGS],
  [
    '/api/devicelogs/{path*}',
    hit =>
      hit.query.get('download') ? 'ctrl: state idle, bags 14, litter 62\n' : deviceLogWindow(),
  ],
  ['/api/capture', () => CAPTURE],
  ['/api/capture/{name}', hit => captureTail(decodeURIComponent(hit.params.name ?? ''))],
  ['/api/capture/{name}/download', () => '{"t":"08:12:07","path":"/6/t6/dev_heartbeat"}\n'],
  ['/api/retention', () => RETENTION],
  ['/api/blocked', () => BLOCKED],
  ['/api/auth/tokens', () => TOKENS],
];

/** Writes whose callers read more than `ok` from the answer. */
const WRITES: [string, Handler][] = [
  ['POST /api/auth/pairing', () => ({ ...PAIRING, expires_at: Date.now() / 1000 + 300 })],
  [
    'POST /api/devices/{id}/command',
    () => ({ ok: true, delivered: 'mqtt', suffix: '', envelope: null }),
  ],
  ['POST /api/devices/{id}/patcher', () => ({ ok: true })],
  [
    'POST /api/devices/{id}/force-continue',
    () => ({ ok: true, delivered: 'mqtt', suffix: '', envelope: null }),
  ],
  ['PUT /api/devices/{id}/auto-pack', hit => litterAutomationFor(id(hit)).autoPack],
  ['POST /api/devices/{id}/ai', () => ({ ok: true, ai_enabled: true })],
  [
    'POST /api/devices/{id}/deferred-feed',
    () => ({
      ok: true,
      feed: { id: 'preview', a1: 1, a2: 1, fire_at: NOW + 3600 },
    }),
  ],
  ['POST /api/retention', () => RETENTION],
  ['POST /api/ble', () => ({ accessories: ACCESSORIES })],
  ['DELETE /api/ble/{id}', () => ({ ok: true, accessories: ACCESSORIES, note: '' })],
  ['POST /api/ble/import', () => ({ imported: 0, results: [], accessories: ACCESSORIES })],
  ['POST /api/pets/import', () => ({ imported: 0, results: [] })],
  [
    'PUT /api/timeline/{id}/pet',
    () => ({ updated: 1, pet_id: null, pet_source: 'manual', passing: false, pet: null }),
  ],
  ['POST /api/devices/{id}/sounds', () => ({ ok: true, sound: SOUNDS[0] })],
];

const compiledGets = GETS.map(([pattern, handler]) => [compile(pattern), handler] as const);
const compiledWrites = WRITES.map(([key, handler]) => {
  const [method = '', pattern = ''] = key.split(' ');
  return [method, compile(pattern), handler] as const;
});

function json(body: unknown, status = 200): Response {
  if (typeof body === 'string') {
    return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function notFound(method: string, path: string): Response {
  console.warn(`[preview] no fixture for ${method} ${path}`);
  return json({ error: { code: 'not_found', message: 'Not in the preview fixtures.' } }, 404);
}

/** Answer one request from the fixtures. */
export function answer(method: string, url: URL): Response {
  // Everything up to `/api/` is the mount point, whatever it is.
  const path = url.pathname.replace(/^.*?(\/api\/)/, '/api/');
  if (method === 'GET') {
    for (const [pattern, handler] of compiledGets) {
      const m = pattern.exec(path);
      if (!m) continue;
      const body = handler({ params: { ...m.groups }, query: url.searchParams });
      return body === NOT_FOUND ? notFound(method, path) : json(body);
    }
    return notFound(method, path);
  }
  for (const [verb, pattern, handler] of compiledWrites) {
    const m = verb === method ? pattern.exec(path) : null;
    if (m) return json(handler({ params: { ...m.groups }, query: url.searchParams }));
  }
  // Every other write (save, delete, rename, sign out, step-up) just succeeds.
  return json({ ok: true });
}

/** Replace `fetch` for `/api/` URLs; anything else (assets) goes to the network. */
export function installFetchStub(): void {
  const network = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url, window.location.href);
    if (!url.pathname.includes('/api/')) return network(input, init);
    // A beat of latency, so loading states show the way they do against a server.
    await new Promise(resolve => setTimeout(resolve, 30));
    return answer(request.method, url);
  };
}
