import type { ReactNode } from 'react';
import { isMissing, Missing, type MaybeValue } from './state-blocks';

/** One cell of a {@link FigureContainer}. */
export interface FigureCell {
  /** Stable key; defaults to the label. */
  id?: string;
  /** 13px muted label, sentence case. */
  label: string;
  /** The figure. `0` prints as 0; `null`/`undefined`/`''` prints `missingText`. */
  value: MaybeValue;
  /** 15px muted unit after the value, e.g. "%" or "kg". */
  unit?: string;
  /** Shown instead of the value when it is missing; defaults to a muted em dash. */
  missingText?: string;
  /** Optional muted line under the value. */
  note?: ReactNode;
}

/** Props for {@link FigureContainer}. */
export interface FigureContainerProps {
  cells: readonly FigureCell[];
  /** Accessible name for the group, e.g. "Litter box figures". */
  label?: string;
}

/**
 * One `raised` panel (radius 14) split by 1px `border` lines, each cell a label over a 30/500
 * figure; never tiles, icons or sparklines. On a phone
 * the cells wrap into two columns and an odd last cell takes the full width. The
 * `ui-figures__missing` class marks a missing value for tests and screen-level selectors.
 */
export function FigureContainer({ cells, label }: FigureContainerProps) {
  return (
    <dl
      className="grid grid-flow-col auto-cols-[minmax(0,1fr)] rounded-md bg-raised max-[901px]:grid-flow-row max-[901px]:grid-cols-2"
      aria-label={label}
      data-count={cells.length}
    >
      {cells.map(cell => (
        <div
          className="flex min-w-0 flex-col gap-1 border-border px-3.5 py-3 min-[901px]:not-first:border-l max-[901px]:even:border-l max-[901px]:nth-[n+3]:border-t max-[901px]:last:odd:col-span-full"
          key={cell.id ?? cell.label}
        >
          <dt className="text-sm text-muted-foreground">{cell.label}</dt>
          {isMissing(cell.value) ? (
            <dd className="ui-figures__missing pt-2 text-md text-muted-foreground">
              {cell.missingText ?? <Missing />}
            </dd>
          ) : (
            <dd className="text-3xl leading-[1.1] font-medium">
              {String(cell.value)}
              {cell.unit && (
                <span className="ml-0.5 text-md font-normal text-muted-foreground">
                  {' '}
                  {cell.unit}
                </span>
              )}
            </dd>
          )}
          {cell.note && <dd className="text-xs text-muted-foreground">{cell.note}</dd>}
        </div>
      ))}
    </dl>
  );
}
