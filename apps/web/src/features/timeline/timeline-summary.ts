import { clockTime, type TimelineDay, type TimelineSession } from './timeline-model';

function times(n: number): string {
  return n === 1 ? 'once' : n === 2 ? 'twice' : `${String(n)} times`;
}

/**
 * The page's one finding line: who used the litter box how often, and when last. "Miso used the
 * litter box 3 times and Mochi twice. The last visit was 13:58."
 */
export function visitSummary(day: TimelineDay | undefined, isToday: boolean): string | null {
  if (!day) return null;
  const visits = day.sessions.filter(s => s.kind === 'visit');
  if (!visits.length) {
    return isToday ? 'No litter-box visits yet today.' : 'No litter-box visits on this day.';
  }
  const byPet = new Map<string, number>();
  let unknown = 0;
  for (const v of visits) {
    if (v.pet_name) byPet.set(v.pet_name, (byPet.get(v.pet_name) ?? 0) + 1);
    else unknown += 1;
  }
  const parts = [...byPet].map(([name, n], i) =>
    i === 0 ? `${name} used the litter box ${times(n)}` : `${name} ${times(n)}`,
  );
  if (unknown) {
    parts.push(
      parts.length
        ? `an unrecognised cat ${times(unknown)}`
        : `The litter box was used ${times(unknown)}`,
    );
  }
  const head =
    parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${String(parts.at(-1))}` : parts[0];
  const last = latest(visits);
  const at = last ? clockTime(last.display_ts ?? last.ts) : null;
  return at ? `${String(head)}. The last visit was ${at}.` : `${String(head)}.`;
}

function latest(sessions: TimelineSession[]): TimelineSession | undefined {
  return sessions.reduce<TimelineSession | undefined>((best, s) => {
    const t = s.display_ts ?? s.ts ?? 0;
    return !best || t > (best.display_ts ?? best.ts ?? 0) ? s : best;
  }, undefined);
}
