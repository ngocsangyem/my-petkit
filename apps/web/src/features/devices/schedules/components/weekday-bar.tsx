import { formatDays, parseDays, WEEKDAYS } from '../schedule-clock';

interface WeekdayBarProps {
  /** Comma list of weekday numbers, Sunday is 1. */
  days: string;
  onChange: (days: string) => void;
  /** Accessible name of the group, e.g. "Days of entry 1". */
  label: string;
}

/** Seven day toggles; a chosen day is a checked box, so the keyboard and screen readers get real checkboxes. */
export function WeekdayBar({ days, onChange, label }: WeekdayBarProps) {
  const on = parseDays(days);
  return (
    <div className="sched-days" role="group" aria-label={label}>
      {WEEKDAYS.map((name, i) => {
        const day = i + 1;
        return (
          <label key={name} className="sched-days__day">
            <input
              type="checkbox"
              checked={on.has(day)}
              onChange={e => {
                const next = new Set(on);
                if (e.target.checked) next.add(day);
                else next.delete(day);
                onChange(formatDays(next));
              }}
            />
            <span>{name}</span>
          </label>
        );
      })}
    </div>
  );
}
