import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from 'cn';
import { serverUrl } from '@/shared/api/base-path';
import { Card, Pill, StatusMark } from '@/shared/ui';
import { countText, type Pet, type PetStatus } from '../pet-model';

/** Each pet's identity tint, by slot; the same pair the household day strip uses. */
const TINTS = [
  'bg-(--pk-pet-0-tint) text-(--pk-pet-0-ink)',
  'bg-(--pk-pet-1-tint) text-(--pk-pet-1-ink)',
] as const;

const PHOTO = 'block h-70 w-full rounded-md max-[900px]:h-56';

interface PetHeroCardProps {
  pet: Pet;
  /** The pet's identity slot, for the tint behind its initial. */
  slot: number;
  status: PetStatus;
}

/**
 * The pet as the hero: its first face photo across the card (its initial in its tint until there
 * is one, or if it fails), the name, whether the device holds its photos, and how many it has.
 */
export function PetHeroCard({ pet, slot, status }: PetHeroCardProps) {
  const { t } = useTranslation('pets');
  const first = pet.faces[0];
  const [failed, setFailed] = useState<string | null>(null);
  const photo = first && failed !== first.url ? first : null;
  return (
    <Card padding="none" className="flex flex-col gap-3 px-2 pt-2 pb-4">
      {photo ? (
        <img
          className={cn(PHOTO, 'bg-raised object-cover')}
          src={serverUrl(photo.url)}
          alt={t('faces.heroAlt', { name: pet.name })}
          onError={() => {
            setFailed(photo.url);
          }}
        />
      ) : (
        <span
          className={cn(
            PHOTO,
            'flex items-center justify-center text-[64px] font-semibold',
            TINTS.at(slot),
          )}
          aria-hidden="true"
        >
          {pet.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-xl [overflow-wrap:anywhere]">{pet.name}</h2>
          <span className="text-sm">
            <StatusMark status={status.status} label={status.label} />
          </span>
        </div>
        <Pill tone={status.loaded ? 'positive' : 'neutral'}>
          {countText('facePhoto', pet.faces.length)}
        </Pill>
      </div>
    </Card>
  );
}
