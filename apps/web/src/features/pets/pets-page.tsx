import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { EmptyBlock, ErrorBlock, Skeleton, useToast } from '@/shared/ui';
import { useHubEvents } from '@/shared/ws/use-event-stream';
import {
  petsKeys,
  useAddFace,
  useAiDeviceNames,
  useAiDevices,
  usePets,
  useUnboundRefs,
} from './api';
import { AddPetDialog } from './components/add-pet-dialog';
import { FaceCropper, type CropTarget } from './components/face-cropper';
import { ImportDialog } from './components/import-dialog';
import { PetChips } from './components/pet-chips';
import { PetProfile } from './components/pet-profile';
import { PetsHeading } from './components/pets-heading';
import { RecognitionSection } from './components/recognition-section';
import { UnboundSection } from './components/unbound-section';
import { isRecognising } from './pet-model';
import { isDeviceFull, MAX_PETS_PER_DEVICE, petsPerDevice } from './pet-weight-model';

/** The profile's two columns; one once the screen is narrow. */
const GRID =
  'grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-start gap-5 max-[900px]:grid-cols-1';

function NoAiDevice({ names }: { names: readonly string[] }) {
  // The product list comes from the server rather than being spelled out here,
  // which is what let the old copy go stale when a fountain joined it.
  return (
    <EmptyBlock>
      None of your devices does on-device recognition
      {names.length ? `; that is ${names.join(', ')}` : ''}. A device not on that list earns it by
      asking: the first time one requests face data it is remembered, which is how the newer
      YumShare models are recognised despite sharing a codename with older ones that have no camera
      AI.
    </EmptyBlock>
  );
}

/** The AI and pets screen: recognition per device, the pets and their face photos, unbound ids. */
export function PetsPage() {
  const client = useQueryClient();
  const devicesQ = useAiDevices();
  const petsQ = usePets();
  const unboundQ = useUnboundRefs();
  const namesQ = useAiDeviceNames();
  const addFace = useAddFace();
  const toast = useToast();
  // Every outcome on this screen is one sentence; a failure stays until it is closed.
  const notify = useCallback(
    (text: string, error = false) => {
      toast(text, error ? { error: true } : undefined);
    },
    [toast],
  );
  const [crop, setCrop] = useState<CropTarget | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);

  // A new device event may carry an identity nobody has bound yet.
  useHubEvents(event => {
    if (event.kind === 'event') void client.invalidateQueries({ queryKey: petsKeys.unbound });
  });

  const devices = devicesQ.data;
  const pets = petsQ.data;
  const recognising = devices ? devices.details.some(isRecognising) : false;
  const capable = devices?.capable ?? [];
  const unbound = recognising && pets?.length ? (unboundQ.data ?? []) : [];
  const load = petsPerDevice(pets ?? []);
  // Adding needs a recognising box with room; the server refuses a 16th cat on any box.
  const allFull = capable.length > 0 && capable.every(d => isDeviceFull(load, d.id));

  const saveFace = (petId: number, jpeg: Blob) => {
    addFace.mutate(
      { petId, jpeg },
      {
        onSuccess: () => {
          notify('Photo added');
        },
        onError: e => {
          notify(errorMessage(e), true);
        },
      },
    );
  };

  const loadError = devicesQ.error ?? petsQ.error;
  let body;
  if (loadError) {
    body = (
      <ErrorBlock
        message={`Could not load the pets. ${errorMessage(loadError)}`}
        retrying={devicesQ.isFetching || petsQ.isFetching}
        onRetry={() => {
          void devicesQ.refetch();
          void petsQ.refetch();
        }}
      />
    );
  } else if (!devices || !pets) {
    body = (
      <div className={GRID} aria-busy="true">
        <Skeleton height={238} />
        <Skeleton height={238} />
      </div>
    );
  } else if (capable.length === 0) {
    body = <NoAiDevice names={namesQ.data ?? []} />;
  } else if (devices.details.length === 0) {
    // Every detail failed: without them "recognition is off" would be a guess.
    body = (
      <ErrorBlock
        message="Could not read the recognition settings of your devices."
        retrying={devicesQ.isFetching}
        onRetry={() => void devicesQ.refetch()}
      />
    );
  } else {
    const ourFaceIds = pets.flatMap(p => p.faces.map(f => f.id));
    const recognition = (
      <RecognitionSection devices={devices.details} ourFaceIds={ourFaceIds} notify={notify} />
    );
    // A pet deleted elsewhere, or none chosen yet, shows the first one.
    const index = Math.max(
      0,
      pets.findIndex(p => p.id === chosen),
    );
    const shown = pets.at(index);
    body = (
      <>
        {!recognising || !shown ? recognition : null}
        {!recognising ? (
          // The pets are still stored; this only hides a section that would be
          // configuring a matcher nobody is running.
          <EmptyBlock>
            Pet recognition is off. Your face photos are kept, but nothing is matching against them.
            Turn Recognise pets back on above to manage them.
          </EmptyBlock>
        ) : !shown ? (
          <EmptyBlock>
            No pets yet. Add one, then give it a few face photos. Until then the device records
            visits without saying who made them.
          </EmptyBlock>
        ) : (
          <>
            <PetChips pets={pets} selected={shown.id} onSelect={setChosen} />
            <PetProfile
              key={shown.id}
              pet={shown}
              index={index}
              devices={devices.all}
              aiDetails={devices.details}
              load={load}
              notify={notify}
              onAddPhoto={() => {
                setCrop({ petId: shown.id, name: shown.name });
              }}
            />
            <div className={GRID}>
              {recognition}
              <UnboundSection
                unbound={unboundQ.data}
                error={unboundQ.error}
                onRetry={() => void unboundQ.refetch()}
                pets={pets}
                notify={notify}
              />
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PetsHeading
        pets={!loadError && recognising ? (pets ?? null) : null}
        aiDetails={devices?.details ?? []}
        unboundCount={unbound.length}
        canImport={capable.length > 0}
        canAdd={recognising}
        addBlocked={
          allFull
            ? `Every box already recognises ${MAX_PETS_PER_DEVICE} cats, the most it can hold.`
            : null
        }
        onImport={() => {
          setImporting(true);
        }}
        onAdd={() => {
          setAdding(true);
        }}
      />
      {body}
      <FaceCropper
        key={crop ? crop.petId : 'closed'}
        target={crop}
        onClose={() => {
          setCrop(null);
        }}
        onSave={saveFace}
      />
      {adding && (
        <AddPetDialog
          open
          devices={capable}
          load={load}
          notify={notify}
          onClose={() => {
            setAdding(false);
          }}
        />
      )}
      {importing && (
        <ImportDialog
          open
          devices={capable}
          notify={notify}
          onClose={() => {
            setImporting(false);
          }}
        />
      )}
    </div>
  );
}
