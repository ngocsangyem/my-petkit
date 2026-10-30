import { useId, type ReactNode } from 'react';
import { Card } from '@/shared/ui';

interface SettingsCardProps {
  title: string;
  /** Right side of the title row: a pill ("All on", "Step-up") or a muted total. */
  end?: ReactNode;
  children: ReactNode;
}

/**
 * A settings card of the Settings screen: the 17/600 title with a pill or a total on its right,
 * then rows split by 1px rules. It is `SettingsSection` plus a slot on the right of the title,
 * where the card states its own condition.
 */
export function SettingsCard({ title, end, children }: SettingsCardProps) {
  const headingId = useId();
  return (
    <Card as="section" aria-labelledby={headingId} className="flex flex-col px-5 pt-4 pb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pb-1">
        <h2 id={headingId}>{title}</h2>
        {end}
      </div>
      {children}
    </Card>
  );
}
