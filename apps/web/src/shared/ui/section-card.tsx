import { useId, type ReactNode } from 'react';
import { Card } from './card-and-panel';

/** Props for {@link SectionCard}. */
export interface SectionCardProps {
  /** Section heading (17/600). */
  title: string;
  /** Muted 13px line on the title's baseline, e.g. "Tue 28 Oct · 5 litter-box visits". */
  aside?: ReactNode;
  /** Right side of the header: a link, a pill, or a legend. */
  end?: ReactNode;
  children: ReactNode;
}

/** A white card (radius 20, 20px padding, no border) headed by a section title. */
export function SectionCard({ title, aside, end, children }: SectionCardProps) {
  const headingId = useId();
  return (
    <Card as="section" aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h2 id={headingId}>{title}</h2>
          {aside && <span className="text-sm text-muted-foreground">{aside}</span>}
        </div>
        {end}
      </div>
      {children}
    </Card>
  );
}
