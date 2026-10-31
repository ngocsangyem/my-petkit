import { i18n } from '@/i18n';
import { clockTime, type TimelineDay, type TimelineSession } from './timeline-model';

function times(n: number): string {
  if (n === 1) return i18n.t('timeline:summary.once');
  if (n === 2) return i18n.t('timeline:summary.twice');
  return i18n.t('timeline:summary.times', { n });
}

/**
 * The page's one finding line: who used the litter box how often, and when last. "Miso used the
 * litter box 3 times and Mochi twice. The last visit was 13:58."
 */
export function visitSummary(day: TimelineDay | undefined, isToday: boolean): string | null {
  if (!day) return null;
  const visits = day.sessions.filter(s => s.kind === 'visit');
  if (!visits.length) {
    return i18n.t(isToday ? 'timeline:summary.noneToday' : 'timeline:summary.noneDay');
  }
  const byPet = new Map<string, number>();
  let unknown = 0;
  for (const v of visits) {
    if (v.pet_name) byPet.set(v.pet_name, (byPet.get(v.pet_name) ?? 0) + 1);
    else unknown += 1;
  }
  const parts = [...byPet].map(([name, n], i) =>
    i18n.t(i === 0 ? 'timeline:summary.first' : 'timeline:summary.next', { name, times: times(n) }),
  );
  if (unknown) {
    const key = parts.length ? 'timeline:summary.unknownAfter' : 'timeline:summary.unknownOnly';
    parts.push(i18n.t(key, { times: times(unknown) }));
  }
  const head =
    parts.length > 1
      ? i18n.t('timeline:summary.join', {
          rest: parts.slice(0, -1).join(', '),
          last: String(parts.at(-1)),
        })
      : String(parts[0]);
  const last = latest(visits);
  const at = last ? clockTime(last.display_ts ?? last.ts) : null;
  return at
    ? i18n.t('timeline:summary.sentenceLast', { head, at })
    : i18n.t('timeline:summary.sentence', { head });
}

function latest(sessions: TimelineSession[]): TimelineSession | undefined {
  return sessions.reduce<TimelineSession | undefined>((best, s) => {
    const t = s.display_ts ?? s.ts ?? 0;
    return !best || t > (best.display_ts ?? best.ts ?? 0) ? s : best;
  }, undefined);
}
