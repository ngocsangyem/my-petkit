import { useState } from 'react';
import { serverUrl } from '@/shared/api/base-path';
import { Chip } from '@/shared/ui';
import type { Pet } from '../pet-model';

/** The 24px face on a chip; an empty circle when there is no photo or it fails to load. */
function ChipFace({ url }: { url: string | undefined }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!url || failed === url) {
    return <span className="size-6 flex-none rounded-full bg-track" aria-hidden="true" />;
  }
  return (
    <img
      className="size-6 flex-none rounded-full object-cover"
      src={serverUrl(url)}
      alt=""
      width={24}
      height={24}
      onError={() => {
        setFailed(url);
      }}
    />
  );
}

interface PetChipsProps {
  pets: readonly Pet[];
  selected: number;
  onSelect: (petId: number) => void;
}

/** One chip per pet with its face; the pressed one is the pet the page shows. */
export function PetChips({ pets, selected, onSelect }: PetChipsProps) {
  return (
    <div role="group" aria-label="Pet shown" className="flex flex-wrap gap-2">
      {pets.map(p => (
        <Chip
          key={p.id}
          className="pl-1.5"
          pressed={p.id === selected}
          onPressedChange={() => {
            onSelect(p.id);
          }}
        >
          <ChipFace url={p.faces[0]?.url} />
          {p.name}
        </Chip>
      ))}
    </div>
  );
}
