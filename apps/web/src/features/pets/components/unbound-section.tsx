import { useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { formatDateTime } from '@/shared/format/format';
import { Button, ErrorBlock, Missing, Select, Table, type TableColumn } from '@/shared/ui';
import { useBindPetRef } from '../api';
import { plural, type Pet, type UnboundRef } from '../pet-model';

/** Up to this many pets get one "Bind to" button each; more get a picker. */
const MAX_BIND_BUTTONS = 3;

interface UnboundSectionProps {
  unbound: readonly UnboundRef[] | undefined;
  error: unknown;
  onRetry: () => void;
  pets: readonly Pet[];
  notify: (text: string, error?: boolean) => void;
}

function BindPicker({
  pets,
  busy,
  onBind,
  refId,
}: {
  pets: readonly Pet[];
  busy: boolean;
  onBind: (petId: number) => void;
  refId: number;
}) {
  const [choice, setChoice] = useState(String(pets[0]?.id ?? ''));
  return (
    <span className="inline-flex flex-wrap justify-end gap-2">
      <Select
        aria-label={`Pet to bind ${refId} to`}
        value={choice}
        onChange={e => {
          setChoice(e.target.value);
        }}
        options={pets.map(p => ({ value: String(p.id), label: p.name }))}
      />
      <Button
        size="small"
        disabled={busy || !choice}
        onClick={() => {
          onBind(Number(choice));
        }}
      >
        Bind
      </Button>
    </span>
  );
}

/**
 * Identities a device reported that match no pet: almost always ids a box
 * cached from PetKit's cloud before the takeover. The user says who they are;
 * nothing is guessed, because with one pet a guess would even look right, and
 * be wrong the day a second animal appears.
 */
export function UnboundSection({ unbound, error, onRetry, pets, notify }: UnboundSectionProps) {
  const bind = useBindPetRef();
  if (pets.length === 0) return null;
  if (!error && (!unbound || unbound.length === 0)) return null;

  const onBind = (ref: number, petId: number) => {
    bind.mutate(
      { petId, ref },
      {
        onSuccess: r => {
          notify(`Bound: ${plural(r.bound_events, 'past event')} attributed`);
        },
        onError: e => {
          notify(errorMessage(e), true);
        },
      },
    );
  };

  const columns: TableColumn<UnboundRef>[] = [
    { key: 'ref', header: 'Identity', mono: true, nowrap: true, cell: u => String(u.pet_ref) },
    {
      key: 'count',
      header: 'Seen',
      numeric: true,
      nowrap: true,
      cell: u => plural(u.count, 'time'),
    },
    {
      key: 'last',
      header: 'Last seen',
      muted: true,
      nowrap: true,
      cell: u => (u.last_ts ? formatDateTime(u.last_ts) : <Missing />),
    },
    {
      key: 'bind',
      header: 'Bind to',
      alignEnd: true,
      cell: u =>
        pets.length > MAX_BIND_BUTTONS ? (
          <BindPicker
            pets={pets}
            busy={bind.isPending}
            refId={u.pet_ref}
            onBind={petId => {
              onBind(u.pet_ref, petId);
            }}
          />
        ) : (
          <span className="inline-flex flex-wrap justify-end gap-2">
            {pets.map(p => (
              <Button
                key={p.id}
                disabled={bind.isPending}
                aria-label={`Bind ${u.pet_ref} to ${p.name}`}
                onClick={() => {
                  onBind(u.pet_ref, p.id);
                }}
              >
                Bind to {p.name}
              </Button>
            ))}
          </span>
        ),
    },
  ];

  return (
    <section className="flex min-w-0 flex-col gap-2" aria-labelledby="pets-unbound-title">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 id="pets-unbound-title" className="text-lg font-semibold">
          Unbound identities
        </h2>
        <span className="text-sm text-muted-foreground">
          Your device reported these pet ids, but they are not yours: it is still matching against
          faces cached from PetKit's cloud. Bind one to a pet to name its past events. Once the
          device picks up your own photos it reports your ids instead, and this list empties.
        </span>
      </div>
      {error ? (
        <ErrorBlock
          message={`Could not load the unbound identities. ${errorMessage(error)}`}
          onRetry={onRetry}
        />
      ) : (
        <Table
          label="Unbound identities"
          columns={columns}
          rows={unbound ?? []}
          rowKey={u => String(u.pet_ref)}
          minWidth={640}
        />
      )}
    </section>
  );
}
