import { createElement, type HTMLAttributes, type Ref } from 'react';
import { cn } from 'cn';

/** Elements a {@link Card} or {@link Panel} may render as. */
export type SurfaceElement = 'div' | 'section' | 'article' | 'aside' | 'li';

/** Props for {@link Card}. */
export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Rendered element; `section` with `aria-labelledby` for a titled block. Default `div`. */
  as?: SurfaceElement;
  /** `regular` 20px (default), `compact` 8px (photo and device tiles), `none` for full-bleed media. */
  padding?: 'regular' | 'compact' | 'none';
  ref?: Ref<HTMLElement>;
}

const CARD_PADDING = { regular: 'p-5', compact: 'p-2', none: 'p-0' } as const;

/**
 * A white card on the ground: radius 20, no border and no shadow (the tone step is the edge).
 * Inside it a secondary button is ground-tinted and a field is raised.
 */
export function Card({ as = 'div', padding = 'regular', className, ...rest }: CardProps) {
  return createElement(as, {
    'data-slot': 'card',
    className: cn(
      'min-w-0 rounded-xl bg-card text-card-foreground [--pk-fill-field:var(--pk-raised)] [--pk-fill-secondary:var(--pk-tint)]',
      CARD_PADDING[padding],
      className,
    ),
    ...rest,
  });
}

/** Props for {@link Panel}. */
export interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: SurfaceElement;
  /** `regular` 14px by 16px (default), `none` for a drawing or a split figure panel. */
  padding?: 'regular' | 'none';
  ref?: Ref<HTMLElement>;
}

/**
 * An inner panel on `raised`, radius 14, inside a card or dialog: a warning, a drawing, the
 * figures, the sidebar foot. Inside it a secondary button and a field are white again.
 */
export function Panel({ as = 'div', padding = 'regular', className, ...rest }: PanelProps) {
  return createElement(as, {
    'data-slot': 'panel',
    className: cn(
      'min-w-0 rounded-md bg-raised [--pk-fill-field:var(--pk-surface)] [--pk-fill-secondary:var(--pk-surface)]',
      padding === 'regular' && 'px-4 py-3.5',
      className,
    ),
    ...rest,
  });
}
