import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('setup');
  const notes = [t(`toggle.${def.key}.description`)];
  if (inactive) notes.push(t('toggle.inactive'));
  if (pending) notes.push(t('toggle.notSaved'));
  return (
    <SettingsRow
      label={t(`toggle.${def.key}.label`)}
      description={notes.join(' ')}
      control={props => (
        <Switch {...props} checked={checked} disabled={disabled} onCheckedChange={onChange} />
      )}
    />
  );
}
