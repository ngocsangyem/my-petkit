import { useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { ConfirmDialog, ErrorBlock, petSlot } from '@/shared/ui';
import { useDeleteFace, useDeletePet, usePetHistory, useRenamePet } from '../api';
import { petStatus, type DeviceDetail, type DeviceSummary, type Pet } from '../pet-model';
import { PetFacePhotosCard } from './pet-face-photos-card';
import { PetHeroCard } from './pet-hero-card';
import { PetProfileCard } from './pet-profile-card';
import { PetVisitsCard } from './pet-visits-card';
import { PetWeightChartCard } from './pet-weight-chart-card';
import { PetWeightDialog } from './pet-weight-dialog';

interface PetProfileProps {
  pet: Pet;
  /** Position in the list; picks the pet's identity tint. */
  index: number;
  devices: readonly DeviceSummary[];
  aiDetails: readonly DeviceDetail[];
  /** How many pets each device recognises, for the per-box limit. */
  load: ReadonlyMap<number, number>;
  onAddPhoto: () => void;
  notify: (text: string, error?: boolean) => void;
}

/**
 * One pet: its photo and profile on the left; its weight, visits and face photos on the right.
 * Owns the pet's edits and the confirmations before anything is removed.
 */
export function PetProfile({
  pet,
  index,
  devices,
  aiDetails,
  load,
  onAddPhoto,
  notify,
}: PetProfileProps) {
  const [editing, setEditing] = useState(false);
  const [weighing, setWeighing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removeFace, setRemoveFace] = useState<number | null>(null);
  const rename = useRenamePet();
  const del = useDeletePet();
  const delFace = useDeleteFace();
  const history = usePetHistory(pet.id);

  const saveName = (name: string | null) => {
    setEditing(false);
    if (name === null) return;
    rename.mutate(
      { id: pet.id, name },
      {
        onSuccess: () => {
          notify('Renamed');
        },
        onError: e => {
          notify(errorMessage(e), true);
        },
      },
    );
  };

  return (
    <article
      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-start gap-5 max-[900px]:grid-cols-1"
      aria-label={pet.name}
    >
      <div className="flex min-w-0 flex-col gap-5">
        <PetHeroCard pet={pet} slot={petSlot(index)} status={petStatus(pet, aiDetails)} />
        <PetProfileCard
          pet={pet}
          devices={devices}
          aiDetails={aiDetails}
          load={load}
          editingName={editing}
          renaming={rename.isPending}
          onRename={() => {
            setEditing(true);
          }}
          onNameDone={saveName}
          onEditWeight={() => {
            setWeighing(true);
          }}
          onDelete={() => {
            setConfirmDelete(true);
          }}
          notify={notify}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        {history.error && (
          <ErrorBlock
            message={`Some days of ${pet.name}'s history could not be loaded. ${errorMessage(history.error)}`}
            retrying={history.isFetching}
            onRetry={history.refetch}
          />
        )}
        <PetWeightChartCard
          name={pet.name}
          days={history.days}
          registeredG={pet.weight_g}
          isPending={history.isPending}
        />
        <PetVisitsCard name={pet.name} days={history.days} isPending={history.isPending} />
        <PetFacePhotosCard
          pet={pet}
          onAdd={onAddPhoto}
          onRemove={setRemoveFace}
          busy={delFace.isPending}
        />
      </div>

      {weighing && (
        <PetWeightDialog
          pet={pet}
          devices={devices}
          load={load}
          notify={notify}
          onClose={() => {
            setWeighing(false);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${pet.name}?`}
        confirmLabel="Delete pet"
        busy={del.isPending}
        onCancel={() => {
          setConfirmDelete(false);
        }}
        onConfirm={() => {
          del.mutate(pet.id, {
            onSuccess: () => {
              notify(`Deleted ${pet.name}`);
            },
            onError: e => {
              notify(errorMessage(e), true);
            },
            onSettled: () => {
              setConfirmDelete(false);
            },
          });
        }}
      >
        <p>This removes the pet and every face photo it has. Recorded events stay.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={removeFace !== null}
        title="Remove this face photo?"
        confirmLabel="Remove photo"
        busy={delFace.isPending}
        onCancel={() => {
          setRemoveFace(null);
        }}
        onConfirm={() => {
          if (removeFace === null) return;
          delFace.mutate(
            { petId: pet.id, faceId: removeFace },
            {
              onSuccess: () => {
                notify('Photo removed');
              },
              onError: e => {
                notify(errorMessage(e), true);
              },
              onSettled: () => {
                setRemoveFace(null);
              },
            },
          );
        }}
      >
        {/* Confirmed because it unlinks a file the device keeps matching against until its next poll. */}
        <p>
          The device keeps matching against it until it next fetches photos, about once an hour.
        </p>
      </ConfirmDialog>
    </article>
  );
}
