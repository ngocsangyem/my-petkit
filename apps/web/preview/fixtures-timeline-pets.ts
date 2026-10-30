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
    weight: null,
    weight_g: 5430,
    weight_updated_at: at(13, 58),
    weight_tolerance_g: null,
    weight_match: 1,
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
    weight: null,
    weight_g: 3860,
    weight_updated_at: at(11, 5),
    weight_tolerance_g: 250,
    weight_match: 1,
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
  /** Who decided the pet and anything else that differs from a recognised visit. */
  over?: Partial<Session>;
}

function visit({ id, pet, h, m, seconds, grams, media, over }: VisitSpec): Session {
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
    ...over,
  });
}

/** Too light for any registered cat: only the "Light visits" chip shows these. */
function lightVisit(id: number, h: number, m: number, grams: number): Session {
  return visit({
    id,
    pet: PETS[0] as Pet,
    h,
    m,
    seconds: 20,
    grams,
    over: {
      pet_id: null,
      pet_name: null,
      pet_photo_url: null,
      pet_source: null,
      passing: true,
      sub_events: [],
    },
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
    id: 970,
    pet: miso,
    h: 14,
    m: 31,
    seconds: 122,
    grams: 5400,
    over: {
      pet_id: null,
      pet_name: null,
      pet_photo_url: null,
      pet_source: null,
      unbound_pet_ref: 7_301_552,
      sub_events: [],
    },
  }),
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
  lightVisit(935, 12, 20, 1840),
  visit({
    id: 930,
    pet: mochi,
    h: 11,
    m: 5,
    seconds: 110,
    grams: 3860,
    over: { pet_source: 'weight' },
  }),
  lightVisit(915, 9, 40, 2210),
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
  const light = scoped.filter(s => s.passing);
  const shown = scoped.filter(s => !s.passing);
  const visits = shown.filter(s => s.event_kind === 'toilet_visit').length;
  const counts = {
    all: shown.length,
    pet: shown.filter(s => s.event_kind === 'pet').length,
    toileting: visits,
    drinking: 0,
    feeding: shown.filter(s => s.event_kind === 'feeding').length,
    cleaning: shown.reduce((n, s) => n + s.sub_events.length, 0),
    health_alert: 0,
    fault: 0,
    passing: light.length,
  };
  const byFilter = new Map<string, (s: Session) => boolean>([
    ['all', () => true],
    ['pet', s => s.event_kind === 'pet'],
    ['toileting', s => s.event_kind === 'toilet_visit'],
    ['feeding', s => s.event_kind === 'feeding'],
    ['cleaning', s => s.sub_events.length > 0],
  ]);
  const keep = byFilter.get(filter) ?? (() => false);
  const sessions = filter === 'passing' ? light : shown.filter(keep);
  return { date, tz_offset: 7 * 3600, counts, sessions };
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
