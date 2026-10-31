import { cn } from 'cn';
import { IconButton } from './icon-button';

/** Props for {@link Stepper}. */
export interface StepperProps {
  /** What the number counts, e.g. "Portions"; names the group and the two buttons. */
  label: string;
  /** `null` shows a muted em dash and only lets Increase start from `min`. */
  value: number | null;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Muted unit after the number, e.g. "g". */
  unit?: string;
  disabled?: boolean;
  className?: string;
}

/** Rounds away binary noise from repeated fractional steps (0.1 + 0.2). */
function tidy(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Minus and plus as round icon buttons around a tabular number. The number is announced politely
 * when it changes; each button is disabled at its bound.
 */
export function Stepper({
  label,
  value,
  onValueChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  unit,
  disabled,
  className,
}: StepperProps) {
  const canDown = !disabled && value !== null && value > min;
  const canUp = !disabled && (value === null || value < max);
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex items-center gap-3', className)}
    >
      <IconButton
        icon="minus"
        aria-label={`Decrease ${label.toLowerCase()}`}
        disabled={!canDown}
        onClick={() => {
          if (value !== null) onValueChange(Math.max(min, tidy(value - step)));
        }}
      />
      <output
        aria-live="polite"
        className="min-w-10 text-center text-lg font-semibold tabular-nums"
      >
        {value === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <>
            {value}
            {unit && (
              <span className="ml-0.5 text-base font-normal text-muted-foreground">{unit}</span>
            )}
          </>
        )}
      </output>
      <IconButton
        icon="plus"
        aria-label={`Increase ${label.toLowerCase()}`}
        disabled={!canUp}
        onClick={() => {
          onValueChange(value === null ? min : Math.min(max, tidy(value + step)));
        }}
      />
    </div>
  );
}
