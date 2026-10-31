import { Link } from 'react-router';
import { serverUrl } from '@/shared/api/base-path';
import { Card, Icon } from '@/shared/ui';
import type { PetWithFaces, TimelineSession } from '../api';
import { type DeviceZone, localClock, localDateKey } from '../lib/device-zone';

/** Today's litter-box visits of one pet in the home zone, and the time of the last. */
export function petDay(
  pet: PetWithFaces,
  sessions: readonly TimelineSession[],
  zone: DeviceZone | null,
  nowSeconds: number,
): { visits: number; last: string | null } | null {
  if (!zone) return null;
  const today = localDateKey(nowSeconds, zone);
  let visits = 0;
  let last: number | null = null;
  for (const s of sessions) {
    const at = s.display_ts ?? s.ts;
    if (s.kind !== 'visit' || s.pet_id !== pet.id || at === null) continue;
    if (localDateKey(at, zone) !== today) continue;
    visits += 1;
    if (last === null || at > last) last = at;
  }
  return { visits, last: last === null ? null : localClock(last, zone) };
}

function weightText(grams: number | null | undefined): string | null {
  return typeof grams === 'number' && grams > 0 ? `${(grams / 1000).toFixed(2)} kg` : null;
}

interface PetCardProps {
  pet: PetWithFaces;
  day: { visits: number; last: string | null } | null;
}

/** A cat on Home: its photo, name and weight, and today's visits; opens Pets. */
export function PetCard({ pet, day }: PetCardProps) {
  const face = pet.faces[0];
  const weight = weightText(pet.weight_g);
  const visits = day
    ? `${day.visits} ${day.visits === 1 ? 'visit' : 'visits'}${day.last ? ` · last ${day.last}` : ''}`
    : null;
  return (
    <Card as="li" padding="none" className="list-none">
      <Link
        to="/pets"
        className="flex h-full flex-col gap-2.5 rounded-xl px-2 pt-2 pb-3.5 text-foreground no-underline hover:text-foreground"
      >
        {face ? (
          <img
            src={serverUrl(face.url)}
            alt={pet.name}
            className="block h-[150px] w-full rounded-md bg-raised object-cover"
          />
        ) : (
          <span className="flex h-[150px] w-full items-center justify-center rounded-md bg-raised text-muted-foreground">
            <Icon name="pets" size={32} />
          </span>
        )}
        <span className="flex flex-col px-2">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-semibold">{pet.name}</span>
            {weight && <span className="text-sm">{weight}</span>}
          </span>
          <span className="text-sm text-muted-foreground">{visits ?? '—'}</span>
        </span>
      </Link>
    </Card>
  );
}
