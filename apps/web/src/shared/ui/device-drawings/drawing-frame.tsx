import { useId, type ReactNode } from 'react';
import { cn } from 'cn';

/** A fill level in percent (0-100). `null`/`undefined`/NaN mean "not reported": nothing is drawn. */
export type DrawingLevel = number | null | undefined;

/** Clamps a level to 0..1, or `null` when it is missing, so the drawing shows an empty vessel. */
export function levelFraction(level: DrawingLevel): number | null {
  if (level === null || level === undefined || !Number.isFinite(level)) return null;
  return Math.min(100, Math.max(0, level)) / 100;
}

/** An id safe inside `url(#…)`: React's ids carry characters a CSS url reference may not. */
export function useSvgId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^\w-]/g, '')}`;
}

/** Props shared by every device drawing. */
export interface DrawingProps {
  /** Rendered width and height in px; 104 on Home tiles, 40 in rows, 140 on a device page. */
  size?: number;
  /**
   * Accessible name, e.g. "Litter box, litter 62%". Omit when the words beside the drawing say the
   * same: the drawing is then hidden from assistive tech.
   */
  title?: string;
  className?: string;
}

/**
 * The 100x100 frame every drawing is drawn in. Colours come from the drawing tokens
 * (`--pk-drawing-*`, `--pk-litter`, `--pk-food`, `--pk-water`), so dark mode needs no prop.
 */
export function DrawingFrame({
  size = 104,
  title,
  className,
  children,
}: DrawingProps & { children: ReactNode }) {
  return (
    <svg
      className={cn('flex-none', className)}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Stroke classes for the outline of every drawing. */
export const STROKE = 'stroke-drawing-stroke';
