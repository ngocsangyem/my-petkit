import type { ReactNode } from 'react';
import './page-heading.css';

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
    <div className="ui-page-heading">
      <div className="ui-page-heading__text">
        <div
          className={
            badge
              ? 'ui-page-heading__title-row ui-page-heading__title-row--badge'
              : 'ui-page-heading__title-row'
          }
        >
          <h1>{title}</h1>
          {badge}
          {aside && <span className="ui-page-heading__aside">{aside}</span>}
        </div>
        {finding && <p className="ui-page-heading__finding">{finding}</p>}
      </div>
      {actions && <div className="ui-page-heading__actions">{actions}</div>}
    </div>
  );
}
