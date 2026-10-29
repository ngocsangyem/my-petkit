// Miso and Mochi, and their day: five litter-box visits with the auto clean that
// followed each, three pet sightings, and two meals the feeder dispensed.
import type { components } from '@/api/schema';
import { DAY, session, slots } from '@/features/timeline/timeline-fixtures';
import { FEEDER_ID, LITTER_ID, at } from './fixtures-devices';
import { faceUrl, stillPath } from './placeholder-media';

type Pet = components['schemas']['PetWithFaces'];
type Session = components['schemas']['TimelineSession'];
type TimelineDay = components['schemas']['TimelineDay'];
type Unbound = components['schemas']['PetUnboundRef'];
type EventDetail = components['schemas']['TimelineEventDetail'];

export { DAY };

export const PETS: Pet[] = [
  {
    id: 1,
    name: 'Miso',
    device_ids_json: JSON.stringify([LITTER_ID]),
    device_pet_ids_json: '[88412]',
    face_id: null,
    photo_path: null,
    weight: 5420,
    created_at: at(0, 0) - 40 * 86400,
    faces: [11, 12, 13].map(id => ({ id, url: faceUrl(1, id) })),
  },
  {
    id: 2,
    name: 'Mochi',
    device_ids_json: JSON.stringify([LITTER_ID]),
    device_pet_ids_json: null,
    face_id: null,
    photo_path: null,
    weight: 3860,
    created_at: at(0, 0) - 12 * 86400,
    faces: [{ id: 21, url: faceUrl(2, 21) }],
  },
];

export const UNBOUND: Unbound[] = [
  { pet_ref: 7_301_552, count: 3, last_ts: at(11, 5) },
  { pet_ref: 88_413, count: 0, last_ts: null },
];

interface VisitSpec {
  id: number;
  pet: Pet;
  h: number;
  m: number;
  seconds: number;
  grams: number;
  media?: Partial<components['schemas']['TimelineMediaSlots']>;
}

function visit({ id, pet, h, m, seconds, grams, media }: VisitSpec): Session {
  const start = at(h, m);
  return session({
    id,
    related_event: `ep-${id}`,
    device_id: LITTER_ID,
    device_name: 'Litter box',
    ts: start + seconds,
    display_ts: start,
    pet_id: pet.id,
    pet_name: pet.name,
    pet_photo_url: pet.faces[0]?.url ?? null,
    duration_sec: seconds,
    weight: grams,
    bits: [],
    sub_events: [
      {
        id: id + 1,
        event_type: '5',
        ts: start + seconds + 5 * 60,
        label: 'Auto clean, 5 min after exit',
        detail: false,
      },
    ],
    media: slots(media),
  });
}

function sighting(id: number, pet: Pet, h: number, m: number): Session {
  return session({
    kind: 'event',
    id,
    related_event: `ep-${id}`,
    device_id: LITTER_ID,
    device_name: 'Litter box',
    ts: at(h, m),
    display_ts: at(h, m),
    pet_id: pet.id,
    pet_name: pet.name,
    pet_photo_url: pet.faces[0]?.url ?? null,
    event_type: '20',
    event_kind: 'pet',
    label: `${pet.name} came by`,
    duration_sec: null,
    weight: null,
    bits: [],
    sub_events: [],
    media: slots(),
  });
}

function meal(id: number, h: number): Session {
  return session({
    kind: 'event',
    id,
    related_event: null,
    device_id: FEEDER_ID,
    device_name: 'Kitchen feeder',
    ts: at(h, 0, 4),
    display_ts: at(h, 0),
    pet_id: null,
    pet_name: null,
    pet_photo_url: null,
    event_type: '3',
    event_kind: 'feeding',
    label: 'Meal dispensed, 2 portions',
    duration_sec: null,
    weight: null,
    bits: ['10 g + 10 g'],
    sub_events: [],
    media: slots(),
  });
}

const [miso, mochi] = PETS as [Pet, Pet];

/** Newest first, the order the server answers in. */
export const SESSIONS: Session[] = [
  visit({
    id: 960,
    pet: miso,
    h: 13,
    m: 58,
    seconds: 115,
    grams: 5430,
    media: {
      video_pending: true,
      snapshot_url: stillPath('miso-1358'),
      waste: [stillPath('waste-1358')],
    },
  }),
  meal(950, 12),
  sighting(940, mochi, 11, 40),
  visit({ id: 930, pet: mochi, h: 11, m: 5, seconds: 110, grams: 3860 }),
  sighting(920, miso, 9, 12),
  visit({ id: 910, pet: miso, h: 8, m: 31, seconds: 160, grams: 5420 }),
  meal(900, 7),
  sighting(890, mochi, 5, 2),
  visit({ id: 880, pet: mochi, h: 3, m: 47, seconds: 92, grams: 3870 }),
  visit({ id: 870, pet: miso, h: 1, m: 15, seconds: 104, grams: 5410 }),
];

/** A day of the timeline, narrowed the way the server narrows it. */
export function timelineDay(params: URLSearchParams): TimelineDay {
  const date = params.get('date') || DAY;
  const device = params.get('device');
  const pet = params.get('pet');
  const filter = params.get('filter') ?? 'all';
  const scoped = (date === DAY ? SESSIONS : []).filter(
    s => (!device || String(s.device_id) === device) && (!pet || String(s.pet_id) === pet),
  );
  const visits = scoped.filter(s => s.event_kind === 'toilet_visit').length;
  const counts = {
    all: scoped.length,
    pet: scoped.filter(s => s.event_kind === 'pet').length,
    toileting: visits,
    drinking: 0,
    feeding: scoped.filter(s => s.event_kind === 'feeding').length,
    cleaning: scoped.reduce((n, s) => n + s.sub_events.length, 0),
    health_alert: 0,
    fault: 0,
  };
  const byFilter = new Map<string, (s: Session) => boolean>([
    ['all', () => true],
    ['pet', s => s.event_kind === 'pet'],
    ['toileting', s => s.event_kind === 'toilet_visit'],
    ['feeding', s => s.event_kind === 'feeding'],
    ['cleaning', s => s.sub_events.length > 0],
  ]);
  const keep = byFilter.get(filter) ?? (() => false);
  return { date, tz_offset: 7 * 3600, counts, sessions: scoped.filter(keep) };
}

/** Debug info for one event: what the store would hold for it. */
export function eventDetail(id: number): EventDetail | null {
  const s = SESSIONS.find(x => x.id === id);
  if (!s) return null;
  return {
    event: {
      id,
      event_uid: `uid-${id}`,
      event_type: s.event_type,
      event_kind: s.event_kind,
      label: s.label,
      ts: s.ts,
      created_at: s.ts,
      source: 'mqtt',
      device_id: s.device_id,
      device_type: s.device_id === FEEDER_ID ? 'd4sh' : 't6',
      pet_id: s.pet_id,
      pet_ref: s.pet_id === 1 ? 88412 : null,
      pet_name: s.pet_name,
      pet_photo_url: s.pet_photo_url,
      score: null,
      related_event: s.related_event,
      parent_event: null,
    },
    code: null,
    decoded: [],
    content: { duration: s.duration_sec, weight: s.weight },
    state: {},
  };
}
