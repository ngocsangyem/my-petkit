import type { ReactNode } from 'react';
import { EmptyBlock } from './state-blocks';
import './table.css';

/** Severity of a log line; drawn as a 2px left edge, never as a row fill. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** One column of a {@link Table}. */
export interface TableColumn<Row> {
  /** Stable key, unique within the table. */
  key: string;
  /** 12px muted sentence-case header. Pass `hiddenHeader` for an action column. */
  header: string;
  /** Header text for screen readers only (e.g. "Action"); the visible header stays empty. */
  hiddenHeader?: boolean;
  /** Cell content for a row; render strings as text only. */
  cell: (row: Row) => ReactNode;
  /** Right-aligned with tabular figures. */
  numeric?: boolean;
  /** Right-aligned without being a number (a trailing action). */
  alignEnd?: boolean;
  /** Mono for IDs, firmware, URLs, keys and log lines only. */
  mono?: boolean;
  /** Muted ink for secondary columns (times, models). */
  muted?: boolean;
  /** Keep the cell on one line. */
  nowrap?: boolean;
  /** CSS width, e.g. "34%" or "96px". */
  width?: string;
}

/** Props for {@link Table}. */
export interface TableProps<Row> {
  columns: readonly TableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  /** Accessible name of the table. */
  label: string;
  /**
   * `plain`: the device list (56px rows, 1px rule, no band).
   * `compact`: 44px rows, e.g. inside a settings panel.
   * `log`: framed, mono 12.5px body, 30px rows, level edge on the left.
   */
  variant?: 'plain' | 'compact' | 'log';
  /** Key of the selected row; it gets a 2px accent inset left edge. */
  selectedKey?: string | null;
  /** Level per row (log variant): a 2px left edge in the level colour. */
  levelOf?: (row: Row) => LogLevel | undefined;
  /** Horizontal scroll threshold so columns never crush, e.g. 760. */
  minWidth?: number;
  /** One sentence shown when there are no rows; the header stays. */
  emptyText?: string;
  /** ARIA role override; `log` makes a live server log a log region. */
  role?: 'table' | 'log';
}

/** Data table: muted headers, 1px rules, no zebra, numbers right-aligned. */
export function Table<Row>({
  columns,
  rows,
  rowKey,
  label,
  variant = 'plain',
  selectedKey,
  levelOf,
  minWidth,
  emptyText = 'Nothing to show yet.',
  role,
}: TableProps<Row>) {
  const edged = variant === 'log' || selectedKey !== undefined || levelOf !== undefined;
  const cellClass = (col: TableColumn<Row>) =>
    [
      col.numeric || col.alignEnd ? 'ui-table__end' : '',
      col.mono ? 'ui-table__mono' : '',
      col.muted ? 'ui-table__muted' : '',
      col.nowrap ? 'ui-table__nowrap' : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className={`ui-table-wrap ui-table-wrap--${variant}`}>
      <table
        className={`ui-table ui-table--${variant}${edged ? ' ui-table--edged' : ''}`}
        aria-label={label}
        role={role === 'log' ? 'log' : undefined}
        style={minWidth ? { minWidth } : undefined}
      >
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                scope="col"
                className={cellClass(col)}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.hiddenHeader ? (
                  <span className="ui-visually-hidden">{col.header}</span>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="ui-table__empty-row">
              <td colSpan={columns.length}>
                <EmptyBlock>{emptyText}</EmptyBlock>
              </td>
            </tr>
          ) : (
            rows.map(row => {
              const key = rowKey(row);
              const selected =
                selectedKey !== undefined && selectedKey !== null && key === selectedKey;
              const level = levelOf?.(row);
              return (
                <tr
                  key={key}
                  aria-current={selected ? 'true' : undefined}
                  className={
                    [
                      selected ? 'ui-table__row--selected' : '',
                      level ? `ui-table__row--${level}` : '',
                    ]
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                >
                  {columns.map(col => (
                    <td key={col.key} className={cellClass(col)}>
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Props for {@link LogLevelText}. */
export interface LogLevelTextProps {
  level: LogLevel;
}

/** The level word in a log row, coloured by level (info and debug stay muted). */
export function LogLevelText({ level }: LogLevelTextProps) {
  return <span className={`ui-level-text ui-level-text--${level}`}>{level}</span>;
}
