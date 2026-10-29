import type { ChangeEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { Icon } from './icons';
import './form-controls.css';

type NativeInput = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>;

function controlClass(extra: (string | false | undefined)[], className?: string): string {
  return ['ui-control', ...extra, className].filter(Boolean).join(' ');
}

/** Props for {@link TextInput}. */
export interface TextInputProps extends NativeInput {
  /** Mono 13px, for hosts, IPs, URLs and keys. */
  mono?: boolean;
  /** Right-aligned value, as in settings rows. */
  alignEnd?: boolean;
  /** 36px height, for sign-in forms and dialogs. */
  large?: boolean;
  type?: 'text' | 'password' | 'url' | 'email' | 'search';
}

/** 32px text input with a `control` border. */
export function TextInput({
  mono,
  alignEnd,
  large,
  type = 'text',
  className,
  ...rest
}: TextInputProps) {
  return (
    <input
      type={type}
      className={controlClass(
        [mono && 'ui-control--mono', alignEnd && 'ui-control--end', large && 'ui-control--large'],
        className,
      )}
      {...rest}
    />
  );
}

/** Props for {@link NumberInput}. */
export interface NumberInputProps extends Omit<NativeInput, 'value' | 'onChange'> {
  /** `null` shows an empty field. */
  value: number | null;
  /** Called with the parsed number, or `null` when the field is empty or not a number. */
  onValueChange: (value: number | null) => void;
  mono?: boolean;
}

/** Parses an input's text into a finite number, or `null`. */
export function parseNumberInput(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** 32px numeric input, right-aligned with tabular figures; reports parsed numbers. */
export function NumberInput({ value, onValueChange, mono, className, ...rest }: NumberInputProps) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={controlClass(['ui-control--end', mono && 'ui-control--mono'], className)}
      value={value ?? ''}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        onValueChange(parseNumberInput(e.target.value));
      }}
      {...rest}
    />
  );
}

/** Props for {@link TimeInput}. */
export interface TimeInputProps extends Omit<NativeInput, 'value' | 'onChange'> {
  /** "HH:MM" (24-hour) or '' for none. */
  value: string;
  onValueChange: (value: string) => void;
}

/** 32px native time input; values are "HH:MM" in the device's own day. */
export function TimeInput({ value, onValueChange, className, ...rest }: TimeInputProps) {
  return (
    <input
      type="time"
      className={controlClass(['ui-control--time'], className)}
      value={value}
      onChange={e => {
        onValueChange(e.target.value);
      }}
      {...rest}
    />
  );
}

/** One option of a {@link Select}. */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Props for {@link Select}. */
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: readonly SelectOption[];
}

/** 32px native select. */
export function Select({ options, className, ...rest }: SelectProps) {
  return (
    <select className={controlClass(['ui-control--select'], className)} {...rest}>
      {options.map(o => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Props for {@link Switch}. */
export interface SwitchProps extends Omit<NativeInput, 'checked' | 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Visible label beside the box (toolbar use); omit inside a settings row, which labels it. */
  label?: ReactNode;
  /** 16px in toolbars, 20px in settings panels. */
  small?: boolean;
}

/** An on/off setting: a native checkbox exposed as `role="switch"`, ink-coloured. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  small,
  className,
  ...rest
}: SwitchProps) {
  const input = (
    <input
      type="checkbox"
      role="switch"
      className={['ui-switch', small && 'ui-switch--small', className].filter(Boolean).join(' ')}
      checked={checked}
      onChange={e => {
        onCheckedChange(e.target.checked);
      }}
      {...rest}
    />
  );
  if (label === undefined) return input;
  return (
    <label className="ui-switch-label">
      {input}
      {label}
    </label>
  );
}

/** Props for {@link InlineField}. */
export interface InlineFieldProps {
  /** 13px muted words before the control, e.g. "Level". */
  label: ReactNode;
  children: ReactNode;
}

/** A label with its control on one line, for toolbars ("Level [All levels]"). */
export function InlineField({ label, children }: InlineFieldProps) {
  return (
    <label className="ui-inline-field">
      {label}
      {children}
    </label>
  );
}

/** Props for {@link StackedField}. */
export interface StackedFieldProps {
  /** 13/500 label above the control. */
  label: ReactNode;
  /** Optional 12px muted hint under the control. */
  hint?: ReactNode;
  children: ReactNode;
}

/** A label above its control, for forms (sign-in, dialogs). */
export function StackedField({ label, hint, children }: StackedFieldProps) {
  return (
    <label className="ui-stacked-field">
      <span className="ui-stacked-field__label">{label}</span>
      {children}
      {hint && <span className="ui-stacked-field__hint">{hint}</span>}
    </label>
  );
}

/** Props for {@link SearchField}. */
export interface SearchFieldProps extends Omit<NativeInput, 'onChange'> {
  /** Required: the field has no visible label. */
  'aria-label': string;
  value: string;
  onValueChange: (value: string) => void;
  /** `frame`: the top bar's white field on ground; `control`: a toolbar field. */
  tone?: 'frame' | 'control';
  /** Mono text, for grep-like patterns. */
  mono?: boolean;
}

/** Search field with a 14px magnifier; a real `type="search"` input. */
export function SearchField({
  tone = 'control',
  mono,
  value,
  onValueChange,
  className,
  ...rest
}: SearchFieldProps) {
  return (
    <label className={['ui-search', `ui-search--${tone}`, className].filter(Boolean).join(' ')}>
      <Icon name="search" size={14} strokeWidth={2} />
      <input
        type="search"
        className={mono ? 'ui-search__input ui-control--mono' : 'ui-search__input'}
        value={value}
        onChange={e => {
          onValueChange(e.target.value);
        }}
        {...rest}
      />
    </label>
  );
}
