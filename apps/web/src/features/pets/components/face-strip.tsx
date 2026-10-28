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
    <ul className="pets-faces" aria-label={`Face photos of ${pet.name}`}>
      {pet.faces.map((face, i) => (
        <li key={face.id} className="pets-face">
          {/* The API answers a path relative to the server's mount point. */}
          <img
            src={serverUrl(face.url)}
            alt={`Face photo ${i + 1} of ${pet.name}`}
            width={40}
            height={40}
            loading="lazy"
          />
          <button
            type="button"
            className="pets-face__remove"
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
            className="pets-face-add"
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
