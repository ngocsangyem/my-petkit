import { serverUrl } from '@/shared/api/base-path';
import { Icon } from '@/shared/ui';
import { MAX_FACES, type Pet } from '../pet-model';

interface FaceStripProps {
  pet: Pet;
  onAdd: () => void;
  onRemove: (faceId: number) => void;
  /** Disables the remove buttons while a removal is in flight. */
  busy: boolean;
}

/** The pet's face photos at 40px, each removable, plus an add tile until the device's cap. */
export function FaceStrip({ pet, onAdd, onRemove, busy }: FaceStripProps) {
  const full = pet.faces.length >= MAX_FACES;
  return (
    <ul
      className="m-0 flex list-none flex-wrap gap-2 p-0"
      aria-label={`Face photos of ${pet.name}`}
    >
      {pet.faces.map((face, i) => (
        <li key={face.id} className="relative size-10">
          {/* The API answers a path relative to the server's mount point. */}
          <img
            className="block size-10 rounded-md object-cover"
            src={serverUrl(face.url)}
            alt={`Face photo ${i + 1} of ${pet.name}`}
            width={40}
            height={40}
            loading="lazy"
          />
          <button
            type="button"
            className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border border-control bg-background p-0 text-foreground hover:bg-raised"
            aria-label={`Remove face photo ${i + 1} of ${pet.name}`}
            disabled={busy}
            onClick={() => {
              onRemove(face.id);
            }}
          >
            <Icon name="close" size={12} />
          </button>
        </li>
      ))}
      {!full && (
        <li>
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-md border border-control bg-background p-0 text-muted-foreground hover:bg-raised"
            aria-label={`Add a face photo for ${pet.name}`}
            onClick={onAdd}
          >
            <Icon name="plus" />
          </button>
        </li>
      )}
    </ul>
  );
}
