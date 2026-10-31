import { Button, Icon, TimeInput } from '@/shared/ui';
import { clockToMin, EVERY_DAY, minToClock } from '../schedule-clock';
import { edited, nextId, type PointEntry } from '../schedule-model';
import { WeekdayBar } from './weekday-bar';

// `type` 0 is a cleaning and 1 a deodorizing, and BOTH live in one array, so
// each section edits its own entries and the save sends the whole array back.
// A section that rewrote only its own rows would delete the other job.
const POINT_SECTIONS = [
  { type: 0, name: 'Scheduled cleaning' },
  { type: 1, name: 'Periodic deodorizing' },
] as const;
const KNOWN_TYPES = new Set<number>(POINT_SECTIONS.map(s => s.type));

interface PointsEditorProps {
  value: PointEntry[];
  onChange: (value: PointEntry[]) => void;
}

/** The litter box's timed jobs: single moments on chosen weekdays, grouped by job. */
export function PointsEditor({ value, onChange }: PointsEditorProps) {
  // A type nobody has seen is kept and shown, never a reason to delete somebody's entry.
  const sections: { type: number | null; name: string }[] = [...POINT_SECTIONS];
  if (value.some(e => !KNOWN_TYPES.has(e.type))) sections.push({ type: null, name: 'Other' });

  const change = (i: number, fn: (entry: PointEntry) => void) => {
    onChange(
      edited(value, v => {
        const entry = v[i];
        if (entry) fn(entry);
      }),
    );
  };

  return (
    <div className="flex min-w-0 flex-col">
      {sections.map(section => {
        const rows = value
          .map((entry, i) => ({ entry, i }))
          .filter(({ entry }) =>
            section.type === null ? !KNOWN_TYPES.has(entry.type) : entry.type === section.type,
          );
        return (
          <div
            data-slot="panel"
            className="flex flex-col gap-2 rounded-md bg-raised px-4 py-3 [--pk-fill-field:var(--pk-surface)] [--pk-fill-secondary:var(--pk-surface)]"
            key={section.name}
          >
            <h3 className="text-base font-semibold">{section.name}</h3>
            {rows.length ? (
              rows.map(({ entry, i }, n) => (
                <div
                  className="flex min-h-13 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-rule py-2 first:border-t-0"
                  key={i}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                    <TimeInput
                      aria-label={`${section.name} time ${n + 1}`}
                      value={minToClock(entry.time)}
                      onValueChange={v => {
                        const m = clockToMin(v);
                        if (m !== null)
                          change(i, e => {
                            e.time = m;
                          });
                      }}
                    />
                    <WeekdayBar
                      label={`Days of ${section.name.toLowerCase()} time ${n + 1}`}
                      days={entry.repeats}
                      onChange={days => {
                        change(i, e => {
                          e.repeats = days;
                        });
                      }}
                    />
                    {section.type === null && (
                      <span className="text-sm text-muted-foreground">type {entry.type}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="destructive"
                      size="small"
                      aria-label={`Remove ${section.name.toLowerCase()} time ${n + 1}`}
                      onClick={() => {
                        onChange(value.filter((_, j) => j !== i));
                      }}
                    >
                      <Icon name="close" size={14} />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No times set.</p>
            )}
            {section.type !== null && (
              <div>
                <Button
                  variant="text"
                  aria-label={`Add ${section.name.toLowerCase()} time`}
                  onClick={() => {
                    // The cloud hands these ids out of one pool shared by both job
                    // types; one above the highest held keeps that property.
                    const type = section.type ?? 0;
                    onChange([
                      ...value,
                      { id: nextId(value.map(e => e.id)), repeats: EVERY_DAY, time: 0, type },
                    ]);
                  }}
                >
                  <Icon name="plus" size={14} />
                  Add time
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
