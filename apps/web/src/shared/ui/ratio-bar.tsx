import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import type { ReactNode } from 'react';
import { cn } from 'cn';
import { ProgressIndicator } from './shadcn/progress';

/** Fill colour: accent for normal data, warning for running low, negative for empty/failing. */
export type RatioTone = 'accent' | 'warning' | 'negative';

/** Props for {@link RatioBar}. */
export interface RatioBarProps {
  /** Current amount; `null`/`undefined` draws an empty track (value unknown). */
  value: number | null | undefined;
  /** Full amount; the fill is `value / max`, clamped to 0..1. */
  max: number;
  /** Accessible name, e.g. "N60 deodorizer remaining". */
  ariaLabel: string;
  tone?: RatioTone;
  /** Optional name at the left (140px column), e.g. "N60 deodorizer". */
  name?: ReactNode;
  /** Optional label at the right (64px column), e.g. "3 days". Coloured with the tone if not accent. */
  label?: ReactNode;
}

/** Clamped fill ratio in percent; 0 for missing, non-finite or non-positive max. */
export function ratioPercent(value: number | null | undefined, max: number): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  if (!Number.isFinite(max) || max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max)) * 100;
}

const FILL: Record<RatioTone, string> = {
  accent: 'bg-data',
  warning: 'bg-warning',
  negative: 'bg-negative',
};

const LABEL: Record<RatioTone, string> = {
  accent: '',
  warning: 'text-warning',
  negative: 'text-negative',
};

/** Grid columns: a 140px name and a 64px label on desktop; the label column shrinks on a phone. */
function columns(named: boolean, labelled: boolean): string {
  if (named && labelled) {
    return 'grid-cols-[110px_minmax(0,1fr)_auto] min-[901px]:grid-cols-[140px_minmax(0,1fr)_64px]';
  }
  if (named) return 'grid-cols-[110px_minmax(0,1fr)] min-[901px]:grid-cols-[140px_minmax(0,1fr)]';
  if (labelled) return 'grid-cols-[minmax(0,1fr)_64px]';
  return 'grid-cols-[minmax(0,1fr)]';
}

/** 6px track on `rule` with a fill at the true ratio and an optional name and label. */
export function RatioBar({ value, max, ariaLabel, tone = 'accent', name, label }: RatioBarProps) {
  const valid = Number.isFinite(max) && max > 0;
  const known = valid && value !== null && value !== undefined && Number.isFinite(value);
  return (
    <div
      className={cn('grid items-center gap-3', columns(name !== undefined, label !== undefined))}
    >
      {name !== undefined && <span>{name}</span>}
      {/* A consumable level is a gauge, not a task's progress: keep the meter role. */}
      <ProgressPrimitive.Root
        role="meter"
        aria-label={ariaLabel}
        value={known ? Math.min(max, Math.max(0, value)) : null}
        max={valid ? max : 100}
        className="relative flex h-1.5 w-full items-center overflow-hidden rounded-full bg-rule"
      >
        <ProgressIndicator className={FILL[tone]} />
      </ProgressPrimitive.Root>
      {label !== undefined && <span className={cn('text-right', LABEL[tone])}>{label}</span>}
    </div>
  );
}
