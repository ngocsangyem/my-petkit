import { cn } from 'cn';
import { type FigureCell, isMissing, Missing } from '@/shared/ui';

interface FigureSplitProps {
  cells: readonly FigureCell[];
  /** Accessible name, e.g. "Litter box figures". */
  label: string;
  className?: string;
}

/**
 * The device page's split figure panel: two columns of label-over-figure cells on `raised`,
 * radius 14, split by 1px lines (the artboards' `.split`). A missing value prints its
 * `missingText` at 17px, or a dash; a zero prints as 0. An odd last cell spans both columns.
 */
export function FigureSplit({ cells, label, className }: FigureSplitProps) {
  if (!cells.length) return null;
  return (
    <dl
      aria-label={label}
      className={cn('m-0 grid grid-cols-2 content-stretch rounded-md bg-raised', className)}
    >
      {cells.map((cell, i) => (
        <div
          key={cell.id ?? cell.label}
          className={cn(
            'flex min-w-0 flex-col gap-1 border-border px-3.5 py-3',
            i % 2 === 1 && 'border-l',
            i >= 2 && 'border-t',
            i === cells.length - 1 && i % 2 === 0 && 'col-span-2',
          )}
        >
          <dt className="text-sm text-muted-foreground">{cell.label}</dt>
          <dd className="m-0">
            {isMissing(cell.value) ? (
              cell.missingText ? (
                <span className="block pt-1.5 text-lg text-muted-foreground">
                  {cell.missingText}
                </span>
              ) : (
                <span className="text-3xl leading-tight font-medium">
                  <Missing />
                </span>
              )
            ) : (
              <span className="text-3xl leading-tight font-medium tabular-nums">
                {cell.value}
                {cell.unit && (
                  <span className="ml-0.5 text-md font-normal text-muted-foreground">
                    {cell.unit}
                  </span>
                )}
              </span>
            )}
            {cell.note && <span className="block text-xs text-muted-foreground">{cell.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
