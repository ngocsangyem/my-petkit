import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { errorMessage } from '@/shared/api/errors';
import { formatDateTime } from '@/shared/format/format';
import { Button, Card, ErrorBlock, Select, UnknownPetAvatar } from '@/shared/ui';
import { useBindPetRef } from '../api';
import { countText, type Pet, type UnboundRef } from '../pet-model';

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
  const { t } = useTranslation('pets');
  const [choice, setChoice] = useState(String(pets[0]?.id ?? ''));
  return (
    <span className="inline-flex flex-wrap justify-end gap-2">
      <Select
        aria-label={t('unbound.pickerLabel', { ref: refId })}
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
        {t('unbound.bind')}
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
  const { t } = useTranslation('pets');
  const bind = useBindPetRef();
  if (pets.length === 0) return null;
  if (!error && (!unbound || unbound.length === 0)) return null;

  const onBind = (ref: number, petId: number) => {
    bind.mutate(
      { petId, ref },
      {
        onSuccess: r => {
          notify(t('unbound.bound', { events: countText('pastEvent', r.bound_events) }));
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
            aria-label={t('unbound.bindAria', { ref: u.pet_ref, name: p.name })}
            onClick={() => {
              onBind(u.pet_ref, p.id);
            }}
          >
            {t('unbound.bindTo', { name: p.name })}
          </Button>
        ))}
      </span>
    );

  return (
    <Card as="section" className="flex flex-col gap-3" aria-labelledby="pets-unbound-title">
      <div className="flex flex-col gap-1">
        <h2 id="pets-unbound-title">{t('unbound.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('unbound.intro')}</p>
      </div>
      {error ? (
        <ErrorBlock
          message={t('unbound.loadFailed', { error: errorMessage(error) })}
          onRetry={onRetry}
        />
      ) : (
        <ul className="m-0 flex list-none flex-col p-0" aria-label={t('unbound.title')}>
          {(unbound ?? []).map(u => (
            <li
              key={u.pet_ref}
              className="flex min-h-15 flex-wrap items-center gap-3 border-t border-rule py-2 first:border-t-0"
            >
              <UnknownPetAvatar size={40} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">
                  <Trans
                    t={t}
                    i18nKey="unbound.identity"
                    values={{ ref: u.pet_ref }}
                    components={{ ref: <span className="font-mono text-sm" /> }}
                  />
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {[
                    t('unbound.seen', { times: countText('time', u.count) }),
                    u.last_ts ? t('unbound.last', { when: formatDateTime(u.last_ts) }) : null,
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
