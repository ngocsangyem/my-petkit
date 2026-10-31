import type { ReactNode } from 'react';
import { Toggle } from './shadcn/toggle';
import { ToggleGroup, ToggleGroupItem } from './shadcn/toggle-group';

/** One choice of a chip row or a segmented control. */
export interface ChoiceItem<Id extends string = string> {
  id: Id;
  label: string;
  disabled?: boolean;
}

/** Props for {@link Chip}. */
export interface ChipProps {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
  /** 32px instead of 36px, for dense filter rows. */
  small?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

/**
 * A standalone on/off chip (`aria-pressed`): a 36px pill, white on the ground and ground-tinted
 * inside a card; pressed, it fills with ink (inverted in dark mode).
 */
export function Chip({ pressed, onPressedChange, small, className, ...rest }: ChipProps) {
  return (
    <Toggle
      variant="outline"
      size={small ? 'sm' : 'default'}
      pressed={pressed}
      onPressedChange={next => {
        onPressedChange(next);
      }}
      className={className}
      {...rest}
    />
  );
}

/** Props for {@link SegmentedChips}. */
export interface SegmentedChipsProps<Id extends string> {
  /** Accessible name of the group, e.g. "Cat shown in colour". */
  label: string;
  options: readonly ChoiceItem<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  /** 32px chips instead of 36px. */
  small?: boolean;
}

/** A row of single-choice chips (`aria-pressed`); the chosen chip is filled with ink. */
export function SegmentedChips<Id extends string>({
  label,
  options,
  value,
  onChange,
  small,
}: SegmentedChipsProps<Id>) {
  return (
    <ToggleGroup
      aria-label={label}
      variant="outline"
      size={small ? 'sm' : 'default'}
      value={[value]}
      onValueChange={values => {
        const next = values[0] as Id | undefined;
        if (next) onChange(next);
      }}
      className="flex-wrap"
    >
      {options.map(o => (
        <ToggleGroupItem key={o.id} value={o.id} disabled={o.disabled}>
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Props for {@link Segmented}. */
export interface SegmentedProps<Id extends string> {
  /** Accessible name of the group, e.g. "Appearance". */
  label: string;
  options: readonly ChoiceItem<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  /** Stretch across the container (default) or fit the labels. */
  fit?: boolean;
  className?: string;
}

/**
 * The segmented control: a pill track on `segment` with the chosen choice as a white pill
 * (`aria-pressed`). For two to four mutually exclusive views, e.g. System / Light / Dark.
 */
export function Segmented<Id extends string>({
  label,
  options,
  value,
  onChange,
  fit,
  className,
}: SegmentedProps<Id>) {
  return (
    <ToggleGroup
      aria-label={label}
      variant="segment"
      value={[value]}
      onValueChange={values => {
        const next = values[0] as Id | undefined;
        if (next) onChange(next);
      }}
      className={fit ? className : ['w-full', className].filter(Boolean).join(' ')}
    >
      {options.map(o => (
        <ToggleGroupItem key={o.id} value={o.id} disabled={o.disabled}>
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
