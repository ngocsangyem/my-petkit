import { useState } from 'react';

interface PortionInputProps {
  value: number;
  /** Called only with a whole number inside `0..max`. */
  onChange: (value: number) => void;
  label: string;
  max: number;
}

/**
 * A portion count. The text is held locally so the field can be cleared and
 * retyped; only a whole number in range reaches the schedule, and a field left
 * invalid is marked and snaps back to the stored value when it loses focus.
 */
export function PortionInput({ value, onChange, label, max }: PortionInputProps) {
  const [textValue, setTextValue] = useState<string | null>(null);
  const shown = textValue ?? String(value);
  const n = Number(shown);
  const valid = shown.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= max;
  return (
    <label className="sched-portion">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        className="ui-control ui-control--end sched-portion__input"
        min={0}
        max={max}
        step={1}
        value={shown}
        aria-invalid={!valid}
        onChange={e => {
          const raw = e.target.value;
          setTextValue(raw);
          const parsed = Number(raw);
          if (raw.trim() !== '' && Number.isInteger(parsed) && parsed >= 0 && parsed <= max)
            onChange(parsed);
        }}
        onBlur={() => {
          setTextValue(null);
        }}
      />
    </label>
  );
}
