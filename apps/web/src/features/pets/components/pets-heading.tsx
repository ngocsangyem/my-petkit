import { Button, PageHeading } from '@/shared/ui';
import { listNames, petStatus, plural, type DeviceDetail, type Pet } from '../pet-model';

interface PetsHeadingProps {
  pets: readonly Pet[] | null;
  aiDetails: readonly DeviceDetail[];
  unboundCount: number;
  /** Shows "Import from PetKit account" (there is an AI-capable device). */
  canImport: boolean;
  /** Shows "Add a pet" (at least one device is recognising). */
  canAdd: boolean;
  onImport: () => void;
  onAdd: () => void;
}

/** The one finding line: who is recognised, who is waiting, and what has no pet yet. */
export function findingLine(
  pets: readonly Pet[],
  aiDetails: readonly DeviceDetail[],
  unboundCount: number,
): string {
  const statuses = pets.map(p => ({ name: p.name, s: petStatus(p, aiDetails) }));
  const loaded = statuses.filter(x => x.s.loaded).map(x => x.name);
  const waiting = statuses.filter(x => x.s.waiting).map(x => x.name);
  const parts: string[] = [];
  if (loaded.length) {
    parts.push(`${listNames(loaded)} ${loaded.length === 1 ? 'is' : 'are'} recognised.`);
  }
  if (waiting.length) {
    parts.push(
      `${listNames(waiting)} ${waiting.length === 1 ? 'is' : 'are'} still waiting for the device to fetch the photos.`,
    );
  }
  if (unboundCount) {
    parts.push(
      `${plural(unboundCount, 'reported identity', 'reported identities')} ${unboundCount === 1 ? 'has' : 'have'} no pet yet.`,
    );
  }
  return parts.join(' ');
}

export function PetsHeading({
  pets,
  aiDetails,
  unboundCount,
  canImport,
  canAdd,
  onImport,
  onAdd,
}: PetsHeadingProps) {
  const finding = pets ? findingLine(pets, aiDetails, unboundCount) : '';
  return (
    <PageHeading
      title="Pets"
      aside={
        pets
          ? `${plural(pets.length, 'pet')} · face matching runs on the camera itself; this server only hands it the photos`
          : undefined
      }
      finding={finding || undefined}
      actions={
        canImport || canAdd ? (
          <>
            {canImport && <Button onClick={onImport}>Import from PetKit account</Button>}
            {canAdd && (
              <Button variant="primary" onClick={onAdd}>
                Add a pet
              </Button>
            )}
          </>
        ) : undefined
      }
    />
  );
}
