import { Chip, PetAvatar } from '@/shared/ui';
import type { Pet } from '../pet-model';

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
          <PetAvatar photoUrl={p.faces[0]?.url} size={24} />
          {p.name}
        </Chip>
      ))}
    </div>
  );
}
