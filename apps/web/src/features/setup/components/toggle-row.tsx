import { SettingsRow, Switch } from '@/shared/ui';
import type { ToggleDef } from '../setup-model';

interface ToggleRowProps {
  def: ToggleDef;
  checked: boolean;
  /** True while the row cannot be changed (read-only server, or proxy off for a guard). */
  disabled: boolean;
  /** The proxy is off and this row only acts while it is on. */
  inactive: boolean;
  /** Edited and not saved yet. */
  pending: boolean;
  onChange: (checked: boolean) => void;
}

/** One on/off live setting: its label, what it does, and whether it acts or is saved yet. */
export function ToggleRow({ def, checked, disabled, inactive, pending, onChange }: ToggleRowProps) {
  const notes = [def.description];
  if (inactive) notes.push('Inactive while the proxy is off.');
  if (pending) notes.push('Not saved yet.');
  return (
    <SettingsRow
      label={def.label}
      description={notes.join(' ')}
      control={props => (
        <Switch {...props} checked={checked} disabled={disabled} onCheckedChange={onChange} />
      )}
    />
  );
}
