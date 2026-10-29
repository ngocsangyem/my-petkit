import { useState } from 'react';
import { serverUrl } from '@/shared/api/base-path';
import { errorMessage } from '@/shared/api/errors';
import { Button, ConfirmDialog, FigureContainer, petSlot, StatusMark } from '@/shared/ui';
import { useDeleteFace, useDeletePet, useRenamePet } from '../api';
import {
  MAX_FACES,
  parseIdList,
  petStatus,
  type DeviceDetail,
  type DeviceSummary,
  type Pet,
} from '../pet-model';
import { FaceStrip } from './face-strip';
import { PetNameEditor } from './pet-name-editor';

interface PetCardProps {
  pet: Pet;
  /** Position in the list; picks the pet's identity tint. */
  index: number;
  devices: readonly DeviceSummary[];
  aiDetails: readonly DeviceDetail[];
  onAddPhoto: () => void;
  notify: (text: string, error?: boolean) => void;
}

/** One pet: photo, status, figures, face photos, the devices it is assigned to, and its actions. */
export function PetCard({ pet, index, devices, aiDetails, onAddPhoto, notify }: PetCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removeFace, setRemoveFace] = useState<number | null>(null);
  const rename = useRenamePet();
  const del = useDeletePet();
  const delFace = useDeleteFace();

  const status = petStatus(pet, aiDetails);
  const deviceIds = parseIdList(pet.device_ids_json);
  const aliases = parseIdList(pet.device_pet_ids_json);
  const full = pet.faces.length >= MAX_FACES;
  const first = pet.faces[0];
  const slot = petSlot(index);

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
    <article className="pets-card" aria-label={pet.name}>
      <div className="pets-card__top">
        {first ? (
          <img
            className="pets-avatar"
            src={serverUrl(first.url)}
            alt={`${pet.name}, first face photo`}
            width={112}
            height={112}
          />
        ) : (
          <span className={`pets-avatar pets-avatar--empty pets-tint-${slot}`} aria-hidden="true">
            {pet.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="pets-card__main">
          <div className="pets-card__head">
            {editing ? (
              <PetNameEditor name={pet.name} onDone={saveName} />
            ) : (
              <h2 className="pets-card__name">{pet.name}</h2>
            )}
            <StatusMark status={status.status} label={status.label} />
          </div>
          <FigureContainer
            label={`${pet.name} figures`}
            cells={[
              { label: 'Face photos', value: pet.faces.length, unit: `of ${MAX_FACES}` },
              { label: 'Devices', value: deviceIds.length },
              { label: 'Bound ids', value: aliases.length },
            ]}
          />
        </div>
      </div>

      <div className="pets-card__faces">
        <FaceStrip pet={pet} onAdd={onAddPhoto} onRemove={setRemoveFace} busy={delFace.isPending} />
        <span className="pets-small pets-muted">
          {aliases.length ? `Alias ${aliases.join(', ')}` : 'No alias yet'}
        </span>
      </div>

      <p className="pets-small pets-muted pets-card__devices">
        {deviceIds.length === 0
          ? 'No devices assigned'
          : deviceIds.map((id, i) => {
              const name = devices.find(d => d.id === id)?.name || `#${id}`;
              const detail = aiDetails.find(d => d.id === id);
              // An assignment to a box that is not recognising is real but idle;
              // without the mark a pet on two devices looks equally active on both.
              const off = detail ? detail.aiInfo?.ai_enabled === false : false;
              return (
                <span key={id}>
                  {i > 0 && ' · '}
                  {off ? `${name} (recognition off)` : name}
                </span>
              );
            })}
      </p>

      <div className="pets-card__actions">
        <Button onClick={onAddPhoto} disabled={full}>
          {full ? 'Photos full' : 'Upload photo'}
        </Button>
        <Button
          onClick={() => {
            setEditing(true);
          }}
          disabled={editing || rename.isPending}
        >
          Rename
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            setConfirmDelete(true);
          }}
        >
          Delete
        </Button>
      </div>

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
