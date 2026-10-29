import { useId, type ReactNode } from 'react';
import './section-card.css';

/** Props for {@link SectionCard}. */
export interface SectionCardProps {
  /** Section heading (16/600). */
  title: string;
  /** Muted 13px line on the title's baseline, e.g. "Tue 28 Oct · 5 litter-box visits". */
  aside?: ReactNode;
  /** Right side of the header: a link, a pill, or a legend. */
  end?: ReactNode;
  children: ReactNode;
}

/** A bordered block on the sheet (1px `border`, radius 8, 20px padding), headed by a section title. */
export function SectionCard({ title, aside, end, children }: SectionCardProps) {
  const headingId = useId();
  return (
    <section className="ui-card" aria-labelledby={headingId}>
      <div className="ui-card__header">
        <div className="ui-card__title-row">
          <h2 id={headingId}>{title}</h2>
          {aside && <span className="ui-card__aside">{aside}</span>}
        </div>
        {end}
      </div>
      {children}
    </section>
  );
}
