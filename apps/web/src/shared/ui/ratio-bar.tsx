import type { ReactNode } from 'react';
import './ratio-bar.css';

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

/** 6px track on `rule` with a fill at the true ratio and an optional name and label. */
export function RatioBar({ value, max, ariaLabel, tone = 'accent', name, label }: RatioBarProps) {
  const pct = ratioPercent(value, max);
  const known = value !== null && value !== undefined && Number.isFinite(value);
  const layout = `ui-ratio${name !== undefined ? ' ui-ratio--named' : ''}${label !== undefined ? ' ui-ratio--labelled' : ''}`;
  return (
    <div className={layout}>
      {name !== undefined && <span className="ui-ratio__name">{name}</span>}
      <span
        className="ui-ratio__track"
        role="meter"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={known ? value : undefined}
      >
        <span className={`ui-ratio__fill ui-ratio__fill--${tone}`} style={{ width: `${pct}%` }} />
      </span>
      {label !== undefined && (
        <span className={`ui-ratio__label ui-ratio__label--${tone}`}>{label}</span>
      )}
    </div>
  );
}
