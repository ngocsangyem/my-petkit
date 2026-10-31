import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import { Card } from './card-and-panel';
import { Icon } from './icons';
import { Alert } from './shadcn/alert';
import { Empty } from './shadcn/empty';
import { Skeleton as ShadcnSkeleton } from './shadcn/skeleton';

/** A value that may be absent: `null`, `undefined` and `''` are missing; `0` is a real zero. */
export type MaybeValue = number | string | null | undefined;

/** True when a value is absent (as opposed to a real zero). */
export function isMissing(value: MaybeValue): boolean {
  return value === null || value === undefined || value === '' || Number.isNaN(value);
}

/** Muted em dash for a missing value; screen readers hear "No value". */
export function Missing() {
  const { t } = useTranslation('ui');
  return (
    <span className="text-muted-foreground">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{t('noValue')}</span>
    </span>
  );
}

/** Prints a value as text, with 0 as "0" and a missing value as {@link Missing}. */
export function ValueText({ value }: { value: MaybeValue }) {
  return isMissing(value) ? <Missing /> : <>{String(value)}</>;
}

/** Props for {@link EmptyBlock}. */
export interface EmptyBlockProps {
  /** One sentence, e.g. "No device has reported yet." */
  children: ReactNode;
  /** Optional single next step (a link or button) after the sentence. */
  action?: ReactNode;
}

/** Empty section body: one muted sentence on a `raised` panel; the section keeps its header. */
export function EmptyBlock({ children, action }: EmptyBlockProps) {
  return (
    <Empty className="col-span-full min-h-11 flex-none flex-row flex-wrap items-center justify-start gap-x-3 gap-y-1 rounded-md bg-raised px-4 py-3 text-left text-base text-muted-foreground [--pk-fill-secondary:var(--pk-surface)]">
      <span>{children}</span>
      {action}
    </Empty>
  );
}

/** Props for {@link EmptyState}. */
export interface EmptyStateProps {
  /** 20/600 heading, e.g. "Add your first device". */
  title: string;
  /** One or two sentences under the heading. */
  children: ReactNode;
  /** A device drawing (or other line art) shown on a `raised` panel at the left. */
  art?: ReactNode;
  /** The single next step, normally a primary button or a link styled as one. */
  action?: ReactNode;
}

/**
 * A whole-screen empty state (web-states): a card with the drawing on a `raised` panel, a heading,
 * a sentence and one action. Stacks on a phone.
 */
export function EmptyState({ title, children, art, action }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-start gap-6 p-8 min-[901px]:flex-row min-[901px]:items-center">
      {art && (
        <div className="flex flex-none items-center justify-center rounded-lg bg-raised p-[18px]">
          {art}
        </div>
      )}
      <div className="flex min-w-0 flex-col items-start gap-2">
        <h2 className="text-[20px]">{title}</h2>
        <p className="max-w-[760px] text-md text-lede">{children}</p>
        {action}
      </div>
    </Card>
  );
}

/** Props for {@link NoticeCard}. */
export interface NoticeCardProps {
  /** Section heading, e.g. "Can't reach your server" or "This page is out of date". */
  title: string;
  /** One or two sentences: what happened and what the page does meanwhile. */
  children: ReactNode;
  /** The one action, e.g. Retry now (secondary) or Reload (primary). */
  action?: ReactNode;
  /** `status` (default) is announced politely; `alert` interrupts. */
  role?: 'status' | 'alert';
}

/** A card-level notice (web-states): heading, sentence and one action, e.g. the server is unreachable. */
export function NoticeCard({ title, children, action, role = 'status' }: NoticeCardProps) {
  return (
    <Card role={role} className="flex flex-col items-start gap-2.5">
      <h2>{title}</h2>
      <p className="text-md text-lede">{children}</p>
      {action && <div className="pt-0.5">{action}</div>}
    </Card>
  );
}

/** Props for {@link ErrorBlock}. */
export interface ErrorBlockProps {
  /** One sentence saying what failed and when the data was last good. */
  message: string;
  onRetry?: () => void;
  /** Defaults to "Retry" in the active language. */
  retryLabel?: string;
  /** Disables Retry while a retry is in flight. */
  retrying?: boolean;
}

/**
 * An error kept inside the block that failed (web-states): a `raised` panel with one red warning
 * icon, the sentence, and a white Retry button.
 */
export function ErrorBlock({ message, onRetry, retryLabel, retrying = false }: ErrorBlockProps) {
  const { t } = useTranslation('common');
  return (
    <Alert className="col-span-full flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 rounded-md border-0 bg-raised px-4 py-3 text-base text-foreground [--pk-fill-secondary:var(--pk-surface)]">
      <span className="flex flex-none text-negative">
        <Icon name="warning" size={18} />
      </span>
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} disabled={retrying}>
          {retryLabel ?? t('retry')}
        </Button>
      )}
    </Alert>
  );
}

/** Props for {@link Skeleton}. */
export interface SkeletonProps {
  /** Final width of the value it stands in for (px number or any CSS length). */
  width?: number | string;
  /** Final height; a 28px figure gets a 28px bar so nothing shifts when data lands. */
  height?: number | string;
  className?: string;
}

/** Flat `raised` loading bar at the value's final size; no shimmer, hidden from assistive tech. */
export function Skeleton({ width = '100%', height = 14, className }: SkeletonProps) {
  const style: CSSProperties = { width, height };
  return (
    <ShadcnSkeleton
      className={['inline-block max-w-full align-middle', className].filter(Boolean).join(' ')}
      style={style}
      aria-hidden="true"
    />
  );
}
