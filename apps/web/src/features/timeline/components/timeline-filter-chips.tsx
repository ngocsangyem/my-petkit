import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/shadcn/toggle-group';
import { visibleFilters, type FilterKey, type TimelineCounts } from '../timeline-model';

export interface TimelineFilterChipsProps {
  counts: TimelineCounts | undefined;
  value: FilterKey;
  onChange: (key: FilterKey) => void;
}

/**
 * Kind chips with their counts. The counts come from the server BEFORE the chip is applied, so
 * every chip keeps showing its total while another one is selected. The chosen chip gets the
 * accent border, never a fill; pressing it again keeps it chosen.
 */
export function TimelineFilterChips({ counts, value, onChange }: TimelineFilterChipsProps) {
  const filters = visibleFilters(counts, value);
  return (
    <ToggleGroup
      aria-label="Filter by kind"
      variant="outline"
      size="sm"
      value={[value]}
      onValueChange={values => {
        const next = filters.find(f => f.key === values[0]);
        if (next) onChange(next.key);
      }}
      className="flex-wrap"
    >
      {filters.map(f => (
        <ToggleGroupItem key={f.key} value={f.key} className="gap-1.5">
          {f.label} <span className="text-muted-foreground">{counts ? counts[f.key] : '—'}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
