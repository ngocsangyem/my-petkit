import type { ReactNode } from 'react';
import { Tabs as TabsRoot, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/shadcn/tabs';

interface SegmentTabsProps {
  label: string;
  tabs: readonly { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
  children: ReactNode;
}

/**
 * ARIA tabs drawn as the segmented control (the web-schedules artboard): a pill track on
 * `segment` with the chosen tab as a white pill. Arrow keys select as they move.
 */
export function SegmentTabs({ label, tabs, selected, onSelect, children }: SegmentTabsProps) {
  return (
    <TabsRoot
      value={selected}
      onValueChange={value => {
        onSelect(String(value));
      }}
      className="gap-5"
    >
      <TabsList
        aria-label={label}
        activateOnFocus
        className="h-auto max-w-full justify-start overflow-x-auto rounded-full bg-segment p-[3px] group-data-[orientation=horizontal]/tabs:h-auto"
      >
        {tabs.map(t => (
          <TabsTrigger
            key={t.id}
            value={t.id}
            className="h-8 flex-none rounded-full border-0 px-4 text-base font-medium text-lede data-active:bg-card data-active:font-semibold data-active:text-foreground dark:data-active:border-transparent dark:data-active:bg-card"
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={selected} className="text-base">
        {children}
      </TabsContent>
    </TabsRoot>
  );
}
