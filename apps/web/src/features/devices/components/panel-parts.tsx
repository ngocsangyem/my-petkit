import type { ReactNode } from 'react';
import { cn } from 'cn';
import { Icon } from '@/shared/ui';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/ui/shadcn/collapsible';
import type { Feedback } from '../hooks/use-device-call';

/** The status line under a block: the answer to the last thing it did. Polite live region. */
export function FeedbackLine({ feedback }: { feedback: Feedback | null }) {
  return (
    // Kept at its height so an answer never shifts the layout.
    <p
      className={cn(
        'min-h-[18px] text-sm',
        feedback?.tone === 'error' ? 'text-negative' : 'text-muted-foreground',
      )}
      role="status"
    >
      {feedback?.text ?? ''}
    </p>
  );
}

interface DisclosureProps {
  summary: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

/** A disclosure under a rule inside a panel; the body exists only while open. */
export function Disclosure({ summary, open, onOpenChange, children }: DisclosureProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <DisclosureFrame summary={summary}>{open && children}</DisclosureFrame>
    </Collapsible>
  );
}

/** The trigger and body of a disclosure, inside a `Collapsible` root (controlled or not). */
export function DisclosureFrame({
  summary,
  children,
  plain,
}: {
  summary: string;
  children: ReactNode;
  /** No rule above it, e.g. as the first thing on a panel. */
  plain?: boolean;
}) {
  return (
    <div className={plain ? undefined : 'border-t border-rule pt-3'}>
      <CollapsibleTrigger className="group/disclosure inline-flex items-center gap-1.5 rounded-md font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <Icon
          name="chevron"
          size={14}
          className="flex-none -rotate-90 text-muted-foreground group-aria-expanded/disclosure:rotate-0"
        />
        {summary}
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2.5 pt-3">{children}</CollapsibleContent>
    </div>
  );
}

/** A labelled fact in a panel's metadata grid. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}

/** A block heading inside a panel (16/600), with an optional muted aside. */
export function BlockHeading({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <h3 className="text-lg font-semibold">{title}</h3>
      {aside && <span className="text-sm text-muted-foreground">{aside}</span>}
    </div>
  );
}

/** Pretty JSON of a device's own words, as text in a mono block. */
export function JsonBlock({ value, label }: { value: unknown; label: string }) {
  return (
    <pre
      className="m-0 max-h-80 overflow-auto rounded-lg bg-raised p-3 font-mono text-xs whitespace-pre"
      aria-label={label}
    >
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  );
}

/** An edit typed but not sent gets an accent edge, so it never passes for the device's value. */
export const dirtyClass = (dirty: boolean) => (dirty ? 'border-ring' : undefined);
