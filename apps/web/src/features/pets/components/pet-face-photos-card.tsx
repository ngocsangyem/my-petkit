import { serverUrl } from '@/shared/api/base-path';
import { Button, Icon, SectionCard } from '@/shared/ui';
import { MAX_FACES, type Pet } from '../pet-model';

interface PetFacePhotosCardProps {
  pet: Pet;
  onAdd: () => void;
  onRemove: (faceId: number) => void;
  /** Disables the remove buttons while a removal is in flight. */
  busy: boolean;
}

const SQUARE = 'aspect-square rounded-md';

/**
 * The pet's face photos as six squares: each photo removable, an add tile until the device's cap,
 * and empty raised squares for the slots still free.
 */
export function PetFacePhotosCard({ pet, onAdd, onRemove, busy }: PetFacePhotosCardProps) {
  const full = pet.faces.length >= MAX_FACES;
  const free = Math.max(0, MAX_FACES - pet.faces.length - (full ? 0 : 1));
  return (
    <SectionCard
      title="Face photos"
      aside={`${String(pet.faces.length)} of ${String(MAX_FACES)}`}
      end={
        <Button size="small" onClick={onAdd} disabled={full}>
          {full ? 'Photos full' : 'Upload photo'}
        </Button>
      }
    >
      <ul
        className="m-0 grid list-none grid-cols-6 gap-2 p-0 max-[480px]:grid-cols-3"
        aria-label={`Face photos of ${pet.name}`}
      >
        {pet.faces.map((face, i) => (
          <li key={face.id} className="relative">
            {/* The API answers a path relative to the server's mount point. */}
            <img
              className={`block w-full bg-raised object-cover ${SQUARE}`}
              src={serverUrl(face.url)}
              alt={`Face photo ${String(i + 1)} of ${pet.name}`}
              width={96}
              height={96}
              loading="lazy"
            />
            <button
              type="button"
              className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full border-0 bg-background p-0 text-foreground hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
              aria-label={`Remove face photo ${String(i + 1)} of ${pet.name}`}
              disabled={busy}
              onClick={() => {
                onRemove(face.id);
              }}
            >
              <Icon name="close" size={12} strokeWidth={2} />
            </button>
          </li>
        ))}
        {!full && (
          <li>
            <button
              type="button"
              className={`flex w-full flex-col items-center justify-center gap-1 border-0 bg-raised p-0 text-xs font-medium text-foreground hover:bg-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${SQUARE}`}
              aria-label={`Add a face photo for ${pet.name}`}
              onClick={onAdd}
            >
              <Icon name="plus" size={20} />
              Add
            </button>
          </li>
        )}
        {Array.from({ length: free }, (_, i) => (
          <li key={`free-${String(i)}`} className={`bg-raised ${SQUARE}`} aria-hidden="true" />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Face matching runs on the camera itself; this server only hands it the photos, cropped to
        224 × 224.
      </p>
    </SectionCard>
  );
}
