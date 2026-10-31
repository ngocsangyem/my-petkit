import type { ReactNode } from 'react';
import { cn } from 'cn';

/** Props for {@link CaptionPill}. */
export interface CaptionPillProps {
  children: ReactNode;
  /** Position it over the photo, e.g. "absolute top-3 left-3". */
  className?: string;
}

/**
 * The dark caption pill over a photo or video thumbnail ("Live view", "14:05 · 48 s"): 22px,
 * `rgba(0,0,0,.55)` with white text. The only overlay allowed on a photo (design-reference §7.3).
 */
export function CaptionPill({ children, className }: CaptionPillProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5.5 items-center rounded-full bg-caption px-[9px] text-xs font-medium whitespace-nowrap text-caption-ink',
        className,
      )}
    >
      {children}
    </span>
  );
}
