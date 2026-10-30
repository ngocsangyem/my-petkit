import type { ReactNode } from 'react';
import { cn } from 'cn';

/** Props for {@link PageHeading}. */
export interface PageHeadingProps {
  /** 22/600 page title. */
  title: string;
  /** Optional muted aside on the title's baseline, e.g. "4 devices · 2 reporting". */
  aside?: ReactNode;
  /** Optional pill beside the title (e.g. {@link StepUpPill}). */
  badge?: ReactNode;
  /** The finding line under the title. */
  finding?: ReactNode;
  /** Header actions on the right (at most one primary). */
  actions?: ReactNode;
}

/** Page title row: title, aside or pill, the one finding line, and actions on the right. */
export function PageHeading({ title, aside, badge, finding, actions }: PageHeadingProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {/* A pill is centred on the title; a plain aside sits on its baseline. */}
        <div className={cn('flex flex-wrap gap-3', badge ? 'items-center' : 'items-baseline')}>
          <h1>{title}</h1>
          {badge}
          {aside && <span className="text-muted-foreground">{aside}</span>}
        </div>
        {finding && <p>{finding}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
