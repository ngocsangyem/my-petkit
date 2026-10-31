import { cn } from 'cn';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Select, SettingsRow, Switch } from '@/shared/ui';
import { Input } from '@/shared/ui/shadcn/input';
import { usePendingEdit } from '../hooks/pending-edits';
import { type AnyEntity, entityHelp, optionValues } from '../lib/entity-sections';
import { dirtyClass } from './panel-parts';

interface EntityControlProps {
  entity: AnyEntity;
  /** "<kind>:<id>", the owner of the control, for its pending edit. */
  owner: string;
  /** Sends the value; resolves true once the server accepted it. */
  onSet: (value: string) => Promise<boolean>;
  disabled?: boolean;
}

function isOn(value: unknown): boolean {
  return value === 1 || value === true || value === '1';
}

/**
 * Seconds since midnight as HH:MM (HH:MM:SS when not minute-aligned), or '' for
 * anything that is not a time of day. Empty rather than 00:00 on purpose: none
 * of these settings is seeded, so before the device reports one there is no
 * hour to show, and a zero would read as midnight.
 */
export function secondsToClock(value: unknown): string {
  const n = Number(value);
  if (value === null || value === '' || !Number.isFinite(n) || n < 0 || n >= 86400) return '';
  const p = (x: number) => String(Math.floor(x)).padStart(2, '0');
  const hm = `${p(n / 3600)}:${p((n / 60) % 60)}`;
  return n % 60 ? `${hm}:${p(n % 60)}` : hm;
}

/** A scalar value as an input's text; '' for missing or structured values. */
function scalarText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function rangeText(e: AnyEntity): string {
  if (e.min !== null && e.max !== null) return `${e.min}–${e.max}${e.unit ? ` ${e.unit}` : ''}`;
  return e.unit ?? '';
}

/** One switch, number, select or time control, bound to a device or accessory entity. */
export function EntityControl({ entity: e, owner, onSet, disabled }: EntityControlProps) {
  // Subscribes so the help text follows a language change.
  useTranslation('devices');
  const help = entityHelp(e.key);
  if (e.component === 'switch')
    return <SwitchControl entity={e} onSet={onSet} disabled={disabled} help={help} />;
  if (e.component === 'number' || e.component === 'time') {
    return <TypedControl entity={e} owner={owner} onSet={onSet} disabled={disabled} help={help} />;
  }
  return <SelectControl entity={e} onSet={onSet} disabled={disabled} help={help} />;
}

type ControlProps = Omit<EntityControlProps, 'owner'> & { help: string | undefined };

function SwitchControl({ entity: e, onSet, disabled, help }: ControlProps) {
  // Shows the flip at once, until the device's value moves: a switch that snaps
  // back while the write is in flight reads as the write failing.
  const [flip, setFlip] = useState<{ base: unknown; on: boolean } | null>(null);
  const checked = flip && flip.base === e.value ? flip.on : isOn(e.value);
  return (
    <SettingsRow
      label={e.name}
      description={help}
      control={props => (
        <Switch
          {...props}
          checked={checked}
          disabled={disabled}
          onCheckedChange={on => {
            setFlip({ base: e.value, on });
            void onSet(on ? 'ON' : 'OFF').then(ok => {
              if (!ok) setFlip(null);
            });
          }}
        />
      )}
    />
  );
}

function TypedControl({
  entity: e,
  owner,
  onSet,
  disabled,
  help,
}: ControlProps & { owner: string }) {
  const { t } = useTranslation('devices');
  const isTime = e.component === 'time';
  const deviceValue = isTime ? secondsToClock(e.value) : scalarText(e.value);
  const [pending, setPending] = usePendingEdit(`${owner}:${e.key}`, deviceValue);
  const [problem, setProblem] = useState<string | null>(null);
  const shown = pending ?? deviceValue;
  const range = isTime ? '' : rangeText(e);

  const submit = () => {
    if (isTime) {
      if (!shown) {
        setProblem(t('entity.pickTime'));
        return;
      }
    } else {
      const v = Number(shown);
      if (shown.trim() === '' || !Number.isFinite(v)) {
        setProblem(t('entity.enterNumber'));
        return;
      }
      // Refused rather than clamped: a silently different number is worse than
      // being told no. The server refuses it too; the panel is not the only way in.
      if ((e.min !== null && v < e.min) || (e.max !== null && v > e.max)) {
        setProblem(t('entity.outOfRange', { min: e.min ?? '…', max: e.max ?? '…' }));
        return;
      }
    }
    setProblem(null);
    // Sent verbatim: the server parses it and decides what a valid value is.
    void onSet(shown).then(ok => {
      if (ok) setPending(undefined);
    });
  };

  return (
    <SettingsRow
      label={e.name}
      kind="field"
      description={
        [
          range && t('entity.range', { range }),
          help,
          pending !== undefined && t('notSentYet'),
          problem,
        ]
          .filter(Boolean)
          .join(' · ') || undefined
      }
      control={props => (
        <span className="flex min-w-0 gap-1.5">
          <Input
            {...props}
            type={isTime ? 'time' : 'number'}
            className={cn('min-w-0 flex-1 text-right', dirtyClass(pending !== undefined))}
            value={shown}
            min={isTime ? undefined : (e.min ?? undefined)}
            max={isTime ? undefined : (e.max ?? undefined)}
            step={isTime ? (e.step ?? 60) : (e.step ?? 'any')}
            disabled={disabled}
            onChange={ev => {
              setPending(ev.target.value);
            }}
            onKeyDown={ev => {
              if (ev.key === 'Enter') submit();
            }}
          />
          <Button
            size="small"
            onClick={submit}
            disabled={disabled}
            aria-label={t('entity.setLabel', { name: e.name })}
          >
            {t('set')}
          </Button>
        </span>
      )}
    />
  );
}

function SelectControl({ entity: e, onSet, disabled, help }: ControlProps) {
  const { t } = useTranslation('devices');
  const labels = (e.options ?? []).map(o => (typeof o === 'string' ? o : JSON.stringify(o)));
  // A device value maps to an option through option_values, or by bare index
  // when the entity declares none (the server's HA template does the same).
  const values = optionValues(e)?.length ? (optionValues(e) ?? []) : labels.map((_, i) => i);
  const selected = values.findIndex(v => String(v) === String(e.value));
  const options = labels.map((label, i) => ({ value: String(i), label }));
  if (selected < 0) options.unshift({ value: '', label: t('notReported') });
  return (
    <SettingsRow
      label={e.name}
      kind="field"
      description={help}
      control={props => (
        <Select
          {...props}
          options={options}
          value={selected < 0 ? '' : String(selected)}
          disabled={disabled}
          onChange={ev => {
            const label = labels[Number(ev.target.value)];
            if (ev.target.value !== '' && label !== undefined) void onSet(label);
          }}
        />
      )}
    />
  );
}
