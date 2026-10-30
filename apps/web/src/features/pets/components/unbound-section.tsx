import { useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { formatDateTime } from '@/shared/format/format';
import { Button, Card, ErrorBlock, Select, UnknownPetAvatar } from '@/shared/ui';
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

  const bindControl = (u: UnboundRef) =>
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
            size="small"
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
    );

  return (
    <Card as="section" className="flex flex-col gap-3" aria-labelledby="pets-unbound-title">
      <div className="flex flex-col gap-1">
        <h2 id="pets-unbound-title">Unbound identities</h2>
        <p className="text-sm text-muted-foreground">
          Your device reported these pet ids, but they are not yours: it is still matching against
          faces cached from PetKit's cloud. Bind one to a pet to name its past events. Once the
          device picks up your own photos it reports your ids instead, and this list empties.
        </p>
      </div>
      {error ? (
        <ErrorBlock
          message={`Could not load the unbound identities. ${errorMessage(error)}`}
          onRetry={onRetry}
        />
      ) : (
        <ul className="m-0 flex list-none flex-col p-0" aria-label="Unbound identities">
          {(unbound ?? []).map(u => (
            <li
              key={u.pet_ref}
              className="flex min-h-15 flex-wrap items-center gap-3 border-t border-rule py-2 first:border-t-0"
            >
              <UnknownPetAvatar size={40} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">
                  Identity <span className="font-mono text-sm">{u.pet_ref}</span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {[
                    `seen ${plural(u.count, 'time')}`,
                    u.last_ts ? `last ${formatDateTime(u.last_ts)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              {bindControl(u)}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
