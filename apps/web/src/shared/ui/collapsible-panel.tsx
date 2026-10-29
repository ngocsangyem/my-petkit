import type { ReactNode } from 'react';
import { Icon } from './icons';
import { usePersistedState } from './persisted-state';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './shadcn/collapsible';

/** Props for {@link CollapsiblePanel}. */
export interface CollapsiblePanelProps {
  /** Section heading (16/600). */
  title: string;
  /** Optional muted line beside the title, kept visible while collapsed. */
  summary?: ReactNode;
  /** Remembers open/closed in this browser under this key, e.g. "devices.litter.open". */
  storageKey: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** A card section whose body can be folded; its open state survives a reload. */
export function CollapsiblePanel({
  title,
  summary,
  storageKey,
  defaultOpen = true,
  children,
}: CollapsiblePanelProps) {
  // Stored values come from localStorage and are validated here, not trusted.
  const [stored, setOpen] = usePersistedState<unknown>(storageKey, defaultOpen);
  const isOpen = typeof stored === 'boolean' ? stored : defaultOpen;
  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setOpen}
      render={<section />}
      className="flex flex-col rounded-lg border border-border"
    >
      <h2 className="text-lg">
        <CollapsibleTrigger className="group/trigger flex w-full items-baseline gap-2.5 rounded-lg border-0 bg-transparent p-5 text-left text-foreground">
          <span className="text-lg font-semibold">{title}</span>
          {summary && (
            <span className="min-w-0 truncate text-sm font-normal text-muted-foreground">
              {summary}
            </span>
          )}
          <Icon
            name="chevron"
            size={16}
            className="ml-auto flex-none -rotate-90 self-center text-muted-foreground group-data-panel-open/trigger:rotate-0"
          />
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent keepMounted className="flex flex-col gap-4 px-5 pb-5">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
