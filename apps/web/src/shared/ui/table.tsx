import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from 'cn';
import {
  Table as ShadcnTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './shadcn/table';
import { EmptyBlock } from './state-blocks';

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
   * `dense`: 48px rows on the sheet, e.g. a file list.
   * `log`: framed, mono 12.5px body, 30px rows, level edge on the left.
   */
  variant?: 'plain' | 'compact' | 'dense' | 'log';
  /** Key of the selected row; it gets a 2px accent inset left edge. */
  selectedKey?: string | null;
  /** Level per row (log variant): a 2px left edge in the level colour. */
  levelOf?: (row: Row) => LogLevel | undefined;
  /** Horizontal scroll threshold so columns never crush, e.g. 760. */
  minWidth?: number;
  /** One sentence shown when there are no rows; the header stays. Has a translated default. */
  emptyText?: string;
  /** ARIA role override; `log` makes a live server log a log region. */
  role?: 'table' | 'log';
}

type Variant = NonNullable<TableProps<unknown>['variant']>;

/** Row height and rule colour per variant; compact rows sit on a raised panel, so the rule is `border`. */
const ROW: Record<Variant, string> = {
  plain: 'h-(--pk-row-height) border-rule',
  compact: 'h-11 border-border',
  dense: 'h-(--pk-row-height-compact) border-rule',
  log: 'h-[30px] border-rule',
};

const CELL_PAD: Record<Variant, string> = {
  plain: 'py-2',
  compact: 'py-1.5',
  dense: 'py-1.5',
  log: 'py-1',
};

/** Left edge colour per log level. */
const LEVEL_EDGE: Record<LogLevel, string> = {
  debug: 'border-l-(--pk-log-info-edge)',
  info: 'border-l-(--pk-log-info-edge)',
  warn: 'border-l-chart-3',
  error: 'border-l-negative',
};

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
  emptyText,
  role,
}: TableProps<Row>) {
  const { t } = useTranslation('ui');
  // Edged tables reserve a 2px left edge on every row so selection never shifts the layout.
  const edged = variant === 'log' || selectedKey !== undefined || levelOf !== undefined;
  const log = variant === 'log';
  const cellClass = (col: TableColumn<Row>) =>
    cn(
      (col.numeric || col.alignEnd) && 'text-right',
      col.mono && (log ? 'font-mono' : 'font-mono text-xs'),
      col.muted && 'text-muted-foreground',
      col.nowrap ? 'whitespace-nowrap' : 'whitespace-normal',
    );

  return (
    <div
      data-variant={variant}
      className={cn('overflow-x-auto', log && 'rounded-lg border border-border')}
    >
      <ShadcnTable
        aria-label={label}
        role={role === 'log' ? 'log' : undefined}
        style={minWidth ? { minWidth } : undefined}
        className="border-collapse text-base"
      >
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className="border-b-0 hover:bg-transparent">
            {columns.map((col, i) => (
              <TableHead
                key={col.key}
                scope="col"
                className={cn(
                  'h-auto px-0 pt-0 pr-3 pb-2 text-xs font-medium text-muted-foreground last:pr-0',
                  log && 'pt-2',
                  i === 0 && edged && (log ? 'pl-3' : 'pl-2.5'),
                  (col.numeric || col.alignEnd) && 'text-right',
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.hiddenHeader ? <span className="sr-only">{col.header}</span> : col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        {/* Every row keeps its top rule, the last one included (shadcn drops the last row's border). */}
        <TableBody className={cn('[&_tr:last-child]:border-t', log && 'font-mono text-[12.5px]')}>
          {rows.length === 0 ? (
            <TableRow className="border-t border-b-0 border-rule hover:bg-transparent">
              <TableCell colSpan={columns.length} className="px-0 py-2 whitespace-normal">
                <EmptyBlock>{emptyText ?? t('tableEmpty')}</EmptyBlock>
              </TableCell>
            </TableRow>
          ) : (
            rows.map(row => {
              const key = rowKey(row);
              const selected =
                selectedKey !== undefined && selectedKey !== null && key === selectedKey;
              const level = levelOf?.(row);
              return (
                <TableRow
                  key={key}
                  aria-current={selected ? 'true' : undefined}
                  data-level={level}
                  className={cn('border-t border-b-0 hover:bg-raised', ROW[variant])}
                >
                  {columns.map((col, i) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        'px-0 pr-3 last:pr-0',
                        CELL_PAD[variant],
                        i === 0 &&
                          edged && [
                            'border-l-2 border-l-transparent',
                            log ? 'pl-2.5' : 'pl-2',
                            selected && 'border-l-data',
                            level && LEVEL_EDGE[level],
                          ],
                        cellClass(col),
                      )}
                    >
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </ShadcnTable>
    </div>
  );
}

/** Props for {@link LogLevelText}. */
export interface LogLevelTextProps {
  level: LogLevel;
  /** The word to print, e.g. the event kind; defaults to the level itself. */
  children?: ReactNode;
}

const LEVEL_TEXT: Record<LogLevel, string> = {
  debug: 'text-muted-foreground',
  info: 'text-muted-foreground',
  warn: 'text-warning',
  error: 'text-negative',
};

/** The level word in a log row, coloured by level (info and debug stay muted). */
export function LogLevelText({ level, children }: LogLevelTextProps) {
  return <span className={cn('font-sans text-xs', LEVEL_TEXT[level])}>{children ?? level}</span>;
}
