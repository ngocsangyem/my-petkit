import type { ReactNode } from 'react';
import type { components } from '@/api/schema';
import { i18n } from '@/i18n';
import { formatDuration } from '@/shared/format/format';
import type { DayStripLane, DayStripMeal, DayStripSpan, DayStripVisit } from '@/shared/ui';
import { formatMinute } from '@/shared/ui';
import { deviceFamily, isFountainType } from './device-family';
import { type DeviceZone, localDateKey, minuteOfDay } from './device-zone';
import { portionsText, todaysMeals } from './feed-plan';
import { epochSeconds, lastReport } from './timestamps';

type Summary = components['schemas']['DeviceSummary'];
type Detail = components['schemas']['DeviceDetail'];
type Accessory = components['schemas']['BleAccessory'];
type Session = components['schemas']['TimelineSession'];
type Pet = components['schemas']['PetWithFaces'];

/** An accessory is "not reporting" after this many missed poll intervals. */
const MISSED_POLLS = 3;

export interface StripInput {
  devices: readonly Summary[];
  details: ReadonlyMap<number, Detail>;
  accessories: readonly Accessory[];
  /** Sessions of the server's today and yesterday; filtered here to each device's today. */
  sessions: readonly Session[];
  pets: readonly Pet[];
  zoneOf: (deviceId: number) => DeviceZone | null;
  /** The zone the axis and the now line are drawn in. */
  homeZone: DeviceZone;
  nowSeconds: number;
  /** Builds the decorative avatar for a pet lane. */
  avatarFor?: (pet: Pet) => ReactNode;
}

export interface StripModel {
  lanes: DayStripLane[];
  nowMinute: number;
  visitCount: number;
}

/** A session's moment and the device-local minute it lands on, if it is today there. */
function todayMinute(
  session: Session,
  zoneOf: StripInput['zoneOf'],
  nowSeconds: number,
): number | null {
  const at = session.display_ts ?? session.ts;
  if (at === null || session.device_id === null) return null;
  const zone = zoneOf(session.device_id);
  if (!zone || localDateKey(at, zone) !== localDateKey(nowSeconds, zone)) return null;
  return minuteOfDay(at, zone);
}

function visitTitle(minute: number, s: Session): string {
  const parts = [formatMinute(minute)];
  const dur = formatDuration(s.duration_sec);
  if (s.duration_sec !== null && dur) parts.push(dur);
  if (s.weight !== null && s.weight > 0) parts.push(`${(s.weight / 1000).toFixed(2)} kg`);
  return parts.join(' · ');
}

/** Reporting band up to the last report, then a red hatch while it has gone quiet. */
function fountainSpans(
  last: number | null,
  quiet: boolean,
  zone: DeviceZone,
  nowSeconds: number,
): DayStripSpan[] {
  const now = minuteOfDay(nowSeconds, zone);
  if (!quiet) {
    return [{ start: 0, end: now, state: 'reporting', title: i18n.t('devices:strip.reporting') }];
  }
  if (last === null || localDateKey(last, zone) !== localDateKey(nowSeconds, zone)) {
    return [
      { start: 0, end: now, state: 'no-report', title: i18n.t('devices:strip.noReportToday') },
    ];
  }
  const lastMinute = minuteOfDay(last, zone);
  const clock = formatMinute(lastMinute);
  const since = i18n.t('devices:problem.noReportSince', { when: clock });
  return [
    {
      start: 0,
      end: lastMinute,
      state: 'reporting',
      title: i18n.t('devices:strip.reportingUntil', { clock }),
    },
    { start: lastMinute, end: now, state: 'no-report', title: since },
  ];
}

/** Lanes for the household day strip: one per pet, then feeders, then fountains. */
export function buildStrip(input: StripInput): StripModel {
  const { sessions, pets, zoneOf, nowSeconds, homeZone } = input;
  const visits = new Map<number | null, DayStripVisit[]>();
  let visitCount = 0;
  for (const s of sessions) {
    if (s.kind !== 'visit') continue;
    const minute = todayMinute(s, zoneOf, nowSeconds);
    if (minute === null) continue;
    visitCount += 1;
    const known = pets.some(p => p.id === s.pet_id) ? s.pet_id : null;
    const list = visits.get(known) ?? [];
    list.push({ minute, title: visitTitle(minute, s) });
    visits.set(known, list);
  }

  const lanes: DayStripLane[] = pets.map((pet, i) => ({
    kind: 'pet',
    id: String(pet.id),
    name: pet.name,
    petIndex: i,
    avatar: input.avatarFor?.(pet),
    visits: visits.get(pet.id) ?? [],
  }));
  const unknown = visits.get(null);
  if (unknown?.length) {
    lanes.push({
      kind: 'pet',
      id: 'unknown',
      name: i18n.t('devices:strip.unrecognised'),
      petIndex: pets.length,
      visits: unknown,
    });
  }

  for (const d of input.devices) {
    const zone = zoneOf(d.id);
    if (!zone) continue;
    const family = deviceFamily(d.type);
    if (family === 'feeder') {
      const detail = input.details.get(d.id);
      const now = minuteOfDay(nowSeconds, zone);
      const meals: DayStripMeal[] = sessions
        .filter(s => s.device_id === d.id && s.event_kind === 'feeding')
        .flatMap(s => {
          const minute = todayMinute(s, zoneOf, nowSeconds);
          return minute === null
            ? []
            : [
                {
                  minute,
                  fed: true,
                  title: i18n.t('devices:strip.fed', { clock: formatMinute(minute) }),
                },
              ];
        });
      const planned = detail ? todaysMeals(detail, zone, nowSeconds) : [];
      const dual = detail?.schedules.find(t => t.kind === 'feed')?.dual === true;
      for (const m of planned) {
        if (m.minute <= now) continue;
        meals.push({
          minute: m.minute,
          fed: false,
          title: i18n.t('devices:strip.planned', {
            clock: formatMinute(m.minute),
            portions: portionsText(m, dual),
          }),
        });
      }
      lanes.push({ kind: 'feeder', id: `d${d.id}`, name: d.name, meals });
    } else if (family === 'fountain') {
      lanes.push({
        kind: 'fountain',
        id: `d${d.id}`,
        name: d.name,
        spans: fountainSpans(lastReport(d), !d.online, zone, nowSeconds),
      });
    }
  }

  for (const a of input.accessories) {
    if (!isFountainType(a.ble_type)) continue;
    const zone = zoneOf(a.link_with) ?? homeZone;
    const last = epochSeconds(a.last_seen);
    const stale = last === null || nowSeconds - last > a.interval * MISSED_POLLS;
    lanes.push({
      kind: 'fountain',
      id: `a${a.petkit_id}`,
      name: a.name,
      spans: fountainSpans(last, !a.parent_online || stale, zone, nowSeconds),
    });
  }

  return { lanes, nowMinute: minuteOfDay(nowSeconds, homeZone), visitCount };
}
