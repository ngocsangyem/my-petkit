import { visibleFilters, type FilterKey, type TimelineCounts } from '../timeline-model';

export interface TimelineFilterChipsProps {
  counts: TimelineCounts | undefined;
  value: FilterKey;
  onChange: (key: FilterKey) => void;
}

/**
 * Kind chips with their counts. The counts come from the server BEFORE the chip is applied, so
 * every chip keeps showing its total while another one is selected.
 */
export function TimelineFilterChips({ counts, value, onChange }: TimelineFilterChipsProps) {
  return (
    <div className="ui-chips" role="group" aria-label="Filter by kind">
      {visibleFilters(counts, value).map(f => (
        <button
          key={f.key}
          type="button"
          className="ui-chips__chip tl-chip"
          aria-pressed={f.key === value}
          onClick={() => {
            onChange(f.key);
          }}
        >
          {f.label} <span className="tl-chip__count">{counts ? counts[f.key] : '—'}</span>
        </button>
      ))}
    </div>
  );
}
