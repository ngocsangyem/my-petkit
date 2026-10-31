import type { ReactNode } from 'react';

/** Eyebrow and title on the left, a short lede on the right; children are the lede. */
export function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="lp-head" data-lp-reveal="">
      <div>
        <p className="lp-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <p>{children}</p>
    </div>
  );
}
