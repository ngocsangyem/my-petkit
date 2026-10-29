import { Button, EmptyBlock, Icon, TimeInput } from '@/shared/ui';
import { clockToSec, EVERY_DAY, secToClock } from '../schedule-clock';
import { edited, type FeedGroup, type FeedValue, nextId } from '../schedule-model';
import { PortionInput } from './portion-input';
import { WeekdayBar } from './weekday-bar';

interface FeedEditorProps {
  value: FeedValue;
  onChange: (value: FeedValue) => void;
  /** A Dual-Hopper: each meal carries a portion for hopper 1 (`a1`) and hopper 2 (`a2`). */
  dual: boolean;
}

/** A feeder's meals: groups share weekdays (`re`) and hold meals (`it`), each `{id, t, a1, a2}` with `t` in seconds. */
export function FeedEditor({ value, onChange, dual }: FeedEditorProps) {
  const groups = value.schedule;
  const change = (gi: number, fn: (group: FeedGroup) => void) => {
    onChange(
      edited(value, v => {
        const group = v.schedule[gi];
        if (group) fn(group);
      }),
    );
  };
  const add = (
    <Button
      variant="text"
      onClick={() => {
        onChange({ ...value, schedule: [...groups, { re: EVERY_DAY, it: [] }] });
      }}
    >
      <Icon name="plus" size={14} />
      Add days
    </Button>
  );
  if (!groups.length)
    return (
      <EmptyBlock action={add}>
        No meals set. The feeder dispenses only when you press Feed.
      </EmptyBlock>
    );

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {groups.map((group, gi) => (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3" key={gi}>
          <div className="flex min-h-(--pk-row-height-compact) flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg bg-raised px-3 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              <WeekdayBar
                label={`Days of meal set ${gi + 1}`}
                days={group.re}
                onChange={days => {
                  change(gi, g => {
                    g.re = days;
                  });
                }}
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="destructive"
                size="small"
                aria-label={`Remove meal set ${gi + 1}`}
                onClick={() => {
                  onChange({ ...value, schedule: groups.filter((_, j) => j !== gi) });
                }}
              >
                <Icon name="close" size={14} />
              </Button>
            </div>
          </div>
          {group.it.length ? (
            group.it.map((meal, mi) => {
              const name = `Meal ${mi + 1} of set ${gi + 1}`;
              const setMeal = (field: 't' | 'a1' | 'a2', n: number) => {
                change(gi, g => {
                  const m = g.it[mi];
                  if (m) m[field] = n;
                });
              };
              return (
                <div
                  className="flex min-h-(--pk-row-height-compact) flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg bg-raised px-3 py-2"
                  key={mi}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                    <TimeInput
                      aria-label={`${name} time`}
                      value={secToClock(meal.t)}
                      onValueChange={v => {
                        const s = clockToSec(v);
                        if (s !== null) setMeal('t', s);
                      }}
                    />
                    <PortionInput
                      label={dual ? 'Hopper 1' : 'Portions'}
                      max={255}
                      value={meal.a1}
                      onChange={n => {
                        setMeal('a1', n);
                      }}
                    />
                    {dual && (
                      <PortionInput
                        label="Hopper 2"
                        max={255}
                        value={meal.a2}
                        onChange={n => {
                          setMeal('a2', n);
                        }}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="destructive"
                      size="small"
                      aria-label={`Remove ${name.toLowerCase()}`}
                      onClick={() => {
                        change(gi, g => {
                          g.it.splice(mi, 1);
                        });
                      }}
                    >
                      <Icon name="close" size={14} />
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">No meals on these days.</p>
          )}
          <div>
            <Button
              variant="text"
              aria-label={`Add a meal to set ${gi + 1}`}
              onClick={() => {
                // Ids only have to be distinct within the schedule the device is
                // handed; the server turns a numeric id into its `n_<seconds>` form.
                const id = nextId(groups.flatMap(g => g.it.map(m => m.id)));
                change(gi, g => {
                  g.it.push({ id, t: 0, a1: 1, a2: 0 });
                });
              }}
            >
              <Icon name="plus" size={14} />
              Add meal
            </Button>
          </div>
        </div>
      ))}
      <div>{add}</div>
    </div>
  );
}
