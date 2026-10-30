import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/shadcn/toggle-group';
import { formatDays, parseDays, WEEKDAYS } from '../schedule-clock';

interface WeekdayBarProps {
  /** Comma list of weekday numbers, Sunday is 1. */
  days: string;
  onChange: (days: string) => void;
  /** Accessible name of the group, e.g. "Days of entry 1". */
  label: string;
}

/**
 * Seven day toggles. Each day is announced as a checkbox (several can be on at
 * once, and "checked" is what a screen reader should say), while the group
 * keeps the toggle group's arrow-key movement. A chosen day gets the accent
 * border, never a fill.
 */
export function WeekdayBar({ days, onChange, label }: WeekdayBarProps) {
  const on = parseDays(days);
  return (
    <ToggleGroup
      multiple
      aria-label={label}
      variant="outline"
      size="sm"
      spacing={1}
      className="flex-wrap"
      value={WEEKDAYS.filter((_, i) => on.has(i + 1))}
      onValueChange={values => {
        const next = new Set<number>();
        for (const v of values) {
          const i = (WEEKDAYS as readonly unknown[]).indexOf(v);
          if (i >= 0) next.add(i + 1);
        }
        onChange(formatDays(next));
      }}
    >
      {WEEKDAYS.map((name, i) => (
        <ToggleGroupItem
          key={name}
          value={name}
          role="checkbox"
          aria-label={name}
          aria-checked={on.has(i + 1)}
          className="px-2 text-muted-foreground aria-pressed:font-semibold aria-pressed:text-foreground"
        >
          {name}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
