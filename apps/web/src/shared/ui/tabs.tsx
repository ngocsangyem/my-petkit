import type { ReactNode } from 'react';
import { Tabs as TabsRoot, TabsContent, TabsList, TabsTrigger } from './shadcn/tabs';

/** One tab or chip choice. */
export interface TabItem<Id extends string = string> {
  id: Id;
  label: string;
  disabled?: boolean;
}

/** Props for {@link Tabs}. */
export interface TabsProps<Id extends string> {
  /** Accessible name of the tab list. */
  label: string;
  tabs: readonly TabItem<Id>[];
  selected: Id;
  onSelect: (id: Id) => void;
  /** The selected tab's panel. */
  children: ReactNode;
}

/**
 * Underlined tab list and the selected tab's panel (ARIA tabs; arrow keys move between tabs; the
 * selected tab gets the accent line).
 */
export function Tabs<Id extends string>({
  label,
  tabs,
  selected,
  onSelect,
  children,
}: TabsProps<Id>) {
  return (
    <TabsRoot
      value={selected}
      onValueChange={value => {
        onSelect(value as Id);
      }}
      className="gap-3"
    >
      <TabsList
        variant="line"
        aria-label={label}
        // Arrow keys, Home and End select as they move, as the tabs always did.
        activateOnFocus
        className="h-auto w-full justify-start gap-5 overflow-x-auto border-b border-border p-0"
      >
        {tabs.map(t => (
          <TabsTrigger
            key={t.id}
            value={t.id}
            disabled={t.disabled}
            className="h-8 flex-none rounded-none border-0 px-0 py-0 text-base font-normal text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring data-active:font-medium data-active:text-foreground after:bg-data group-data-[orientation=horizontal]/tabs:after:bottom-[-1px]"
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent
        value={selected}
        className="text-base focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        {children}
      </TabsContent>
    </TabsRoot>
  );
}
