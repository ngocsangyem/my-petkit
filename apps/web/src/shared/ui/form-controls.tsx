import type { ChangeEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from 'cn';
import { Icon } from './icons';
import { Input } from './shadcn/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from './shadcn/input-group';
import { NativeSelect, NativeSelectOption } from './shadcn/native-select';
import { Switch as ShadcnSwitch } from './shadcn/switch';

type NativeInput = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>;

/** Mono 13px, for hosts, IPs, URLs, keys and grep patterns. */
const MONO = 'font-mono text-sm';

/** Props for {@link TextInput}. */
export interface TextInputProps extends NativeInput {
  /** Mono 13px, for hosts, IPs, URLs and keys. */
  mono?: boolean;
  /** Right-aligned value, as in settings rows. */
  alignEnd?: boolean;
  /** 48px height, level with a large button (the main action of a form). Default is 44px. */
  large?: boolean;
  type?: 'text' | 'password' | 'url' | 'email' | 'search';
}

/** Borderless 44px text field on the container's field fill (48px with `large`). */
export function TextInput({
  mono,
  alignEnd,
  large,
  type = 'text',
  className,
  ...rest
}: TextInputProps) {
  return (
    <Input
      type={type}
      className={cn(
        mono && MONO,
        alignEnd && 'text-right',
        large && 'h-(--pk-control-height-large)',
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
    <Input
      type="number"
      inputMode="decimal"
      className={cn('text-right', mono && MONO, className)}
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
    <Input
      type="time"
      className={cn('w-auto', className)}
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
export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'children' | 'size'
> {
  options: readonly SelectOption[];
}

/**
 * 32px native select. Native on purpose: Base UI's Select injects a <style> element when it
 * opens, which the app's CSP blocks.
 */
export function Select({ options, className, ...rest }: SelectProps) {
  return (
    <NativeSelect className={className} {...rest}>
      {options.map(o => (
        <NativeSelectOption key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

/** Props for {@link Switch}. */
export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Visible label beside the switch (toolbar use); omit inside a settings row, which labels it. */
  label?: ReactNode;
  /** Small in toolbars, regular in settings panels. */
  small?: boolean;
  id?: string;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  className?: string;
}

/** An on/off setting with `role="switch"`, ink-coloured when on. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  small,
  className,
  ...rest
}: SwitchProps) {
  const control = (
    // A real <button>, so a <label htmlFor> names it and clicking the label toggles it.
    <ShadcnSwitch
      nativeButton
      render={<button type="button" />}
      size={small ? 'sm' : 'default'}
      className={className}
      checked={checked}
      onCheckedChange={next => {
        onCheckedChange(next);
      }}
      {...rest}
    />
  );
  if (label === undefined) return control;
  return (
    <label className="inline-flex items-center gap-1.5 text-sm">
      {control}
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
    <label className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
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
  /** 12/400 muted label with a 4px gap, for long step forms (provision); default is 13/500. */
  quiet?: boolean;
  children: ReactNode;
}

/** A label above its control, for forms (sign-in, dialogs). */
export function StackedField({ label, hint, quiet, children }: StackedFieldProps) {
  return (
    <label className={cn('flex flex-col', quiet ? 'gap-1' : 'gap-1.5')}>
      {/* Type styles sit on the label text only, so the control keeps its own weight and colour. */}
      <span className={quiet ? 'text-xs text-muted-foreground' : 'text-sm font-medium'}>
        {label}
      </span>
      {children}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
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
    <InputGroup
      className={cn(
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
        tone === 'frame' && 'border-border',
        className,
      )}
    >
      <InputGroupAddon>
        <Icon name="search" size={14} strokeWidth={2} />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        className={cn('focus-visible:outline-none', mono && MONO)}
        value={value}
        onChange={e => {
          onValueChange(e.target.value);
        }}
        {...rest}
      />
    </InputGroup>
  );
}
