import type { ReactNode } from 'react';
import { isMissing, Missing, type MaybeValue } from './state-blocks';
import './figure-container.css';

/** One cell of a {@link FigureContainer}. */
export interface FigureCell {
  /** Stable key; defaults to the label. */
  id?: string;
  /** 12/500 muted label, sentence case. */
  label: string;
  /** The figure. `0` prints as 0; `null`/`undefined`/`''` prints `missingText`. */
  value: MaybeValue;
  /** 14px muted unit after the value, e.g. "%" or "kg". */
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

/** One `raised` container split by 1px lines; never tiles, icons or sparklines. */
export function FigureContainer({ cells, label }: FigureContainerProps) {
  return (
    <dl className="ui-figures" aria-label={label} data-count={cells.length}>
      {cells.map(cell => (
        <div className="ui-figures__cell" key={cell.id ?? cell.label}>
          <dt className="ui-figures__label">{cell.label}</dt>
          {isMissing(cell.value) ? (
            <dd className="ui-figures__missing">{cell.missingText ?? <Missing />}</dd>
          ) : (
            <dd className="ui-figures__value">
              {String(cell.value)}
              {cell.unit && <span className="ui-figures__unit"> {cell.unit}</span>}
            </dd>
          )}
          {cell.note && <dd className="ui-figures__note">{cell.note}</dd>}
        </div>
      ))}
    </dl>
  );
}
