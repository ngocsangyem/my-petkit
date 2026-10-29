import type { CSSProperties, ReactNode } from 'react';
import { Button } from './button';
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
  return (
    <span className="text-muted-foreground">
      <span aria-hidden="true">—</span>
      <span className="sr-only">No value</span>
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

/** Empty section body: one sentence in a 1px dashed box; the section keeps its header. */
export function EmptyBlock({ children, action }: EmptyBlockProps) {
  return (
    <Empty className="col-span-full min-h-[38px] flex-none flex-row flex-wrap items-center justify-start gap-x-3 gap-y-1 rounded-lg border border-dashed border-control px-3 py-2 text-left text-small text-muted-foreground">
      <span>{children}</span>
      {action}
    </Empty>
  );
}

/** Props for {@link ErrorBlock}. */
export interface ErrorBlockProps {
  /** One sentence saying what failed and when the data was last good. */
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Disables Retry while a retry is in flight. */
  retrying?: boolean;
}

/** An error kept inside the block that failed: one sentence plus a Retry text button. */
export function ErrorBlock({
  message,
  onRetry,
  retryLabel = 'Retry',
  retrying = false,
}: ErrorBlockProps) {
  return (
    <Alert className="col-span-full flex min-h-[38px] flex-wrap items-center gap-x-2 gap-y-1 border-0 bg-transparent p-0 text-small text-foreground">
      <span>{message}</span>
      {onRetry && (
        <Button variant="text" onClick={onRetry} disabled={retrying}>
          {retryLabel}
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

/** Flat grey loading bar at the value's final size; no shimmer, hidden from assistive tech. */
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
