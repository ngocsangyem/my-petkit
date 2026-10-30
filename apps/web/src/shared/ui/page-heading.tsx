import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from 'cn';
import { Icon } from './icons';

/** Colour of a {@link StatusWord}: the one coloured word of a header or finding. */
export type StatusTone = 'positive' | 'negative' | 'warning' | 'info' | 'muted';

const TONE: Record<StatusTone, string> = {
  positive: 'text-positive',
  negative: 'text-negative',
  warning: 'text-warning',
  info: 'text-chart-2',
  muted: 'text-muted-foreground',
};

/** Props for {@link StatusWord}. */
export interface StatusWordProps {
  tone: StatusTone;
  children: ReactNode;
  /** Draw the 8px status dot before the words (beside a title). */
  dot?: boolean;
}

/**
 * A coloured status word: "Online · MQTT · 12 s ago" beside a title (with `dot`), or the lead
 * words of a finding sentence ("The fountain has been silent since 06:10.").
 */
export function StatusWord({ tone, children, dot }: StatusWordProps) {
  return (
    <span className={cn('font-medium', TONE[tone], dot && 'inline-flex items-center gap-1.5')}>
      {dot && <span className="size-2 flex-none rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Where a pushed page goes back to. */
export interface PageBackLink {
  /** Route path, e.g. "/devices". */
  to: string;
  /** Words of the link, e.g. "Home". */
  label: string;
}

/** Props for {@link PageHeader}. */
export interface PageHeaderProps {
  /** 28/600 page title (24 under 900px). */
  title: string;
  /** Back link above the title, for a pushed page (a device, a pet). */
  back?: PageBackLink;
  /** 13px status beside the title, normally a {@link StatusWord} with `dot`. */
  status?: ReactNode;
  /** A pill beside the title, e.g. {@link StepUpPill}. */
  badge?: ReactNode;
  /** Optional muted aside on the title's baseline, e.g. "4 devices · 2 reporting". */
  aside?: ReactNode;
  /** The one finding sentence under the title; lead with a {@link StatusWord} when it is news. */
  finding?: ReactNode;
  /**
   * Actions on the right (at most one primary). From 900px they stay on the right and the finding
   * wraps beside them; under 900px they wrap under the title.
   */
  actions?: ReactNode;
}

/**
 * The page header: back link, title with its status word or pill, one finding sentence, and the
 * actions on the right, bottom-aligned with the finding.
 */
export function PageHeader({
  title,
  back,
  status,
  badge,
  aside,
  finding,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 min-[900px]:flex-nowrap">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {back && (
          <Link
            to={back.to}
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Icon name="back" size={14} strokeWidth={2} />
            {back.label}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1>{title}</h1>
          {status && <span className="text-sm">{status}</span>}
          {badge}
          {aside && <span className="text-muted-foreground">{aside}</span>}
        </div>
        {finding && <p className="max-w-[760px] text-md text-lede">{finding}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 max-[900px]:w-full min-[900px]:max-w-[60%] min-[900px]:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}

/** The earlier name of {@link PageHeader}; same component. */
export const PageHeading = PageHeader;
/** The earlier name of {@link PageHeaderProps}. */
export type PageHeadingProps = PageHeaderProps;
