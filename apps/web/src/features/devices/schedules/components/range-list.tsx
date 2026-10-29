import { Button, EmptyBlock, Icon, TimeInput } from '@/shared/ui';
import { clockToMin, DAY_END, isAllDay, minToClock } from '../schedule-clock';
import { edited, type Range } from '../schedule-model';

/** The same sentence for every empty range list: unset means unrestricted, not broken. */
export const SCHED_EMPTY =
  'Not set. Nothing here restricts the device; add a period to change that.';

interface RangeListProps {
  ranges: Range[];
  onChange: (ranges: Range[]) => void;
  /** Prefix for accessible names, e.g. "Entry 2" inside a weekly entry. */
  context?: string;
}

/**
 * A list of `[from, to]` periods. A row is either ALL DAY (`[0, 1440]`, which no
 * time input can hold: 24:00 is not a valid time) or a pair of clocks.
 */
export function RangeList({ ranges, onChange, context }: RangeListProps) {
  const name = (i: number) => `${context ? `${context}, ` : ''}period ${i + 1}`;
  const set = (i: number, end: 0 | 1, clock: string) => {
    const m = clockToMin(clock);
    if (m === null) return;
    onChange(
      edited(ranges, r => {
        const pair = r[i];
        if (pair) pair[end] = m;
      }),
    );
  };
  // [0, 1440] is PetKit's own "entire day" and the one starting point that changes nothing.
  const add = (
    <Button
      variant="text"
      onClick={() => {
        onChange([...ranges, [0, DAY_END]]);
      }}
    >
      <Icon name="plus" size={14} />
      Add period
    </Button>
  );
  if (!ranges.length) return <EmptyBlock action={add}>{SCHED_EMPTY}</EmptyBlock>;

  return (
    <div className="sched-list">
      {ranges.map((pair, i) => {
        const allDay = isAllDay(pair);
        return (
          <div className="sched-row" key={i}>
            <div className="sched-row__values">
              {allDay ? (
                <span className="sched-row__allday">All day</span>
              ) : (
                <>
                  <TimeInput
                    aria-label={`${name(i)} start`}
                    value={minToClock(pair[0])}
                    onValueChange={v => {
                      set(i, 0, v);
                    }}
                  />
                  <span className="sched-row__arrow" aria-hidden="true">
                    to
                  </span>
                  <TimeInput
                    aria-label={`${name(i)} end`}
                    value={minToClock(pair[1])}
                    onValueChange={v => {
                      set(i, 1, v);
                    }}
                  />
                  {pair[1] < pair[0] && <span className="sched-row__note">next day</span>}
                </>
              )}
            </div>
            <div className="sched-row__actions">
              <Button
                variant="text"
                size="small"
                aria-label={`${allDay ? 'Pick times for' : 'Make all day:'} ${name(i)}`}
                onClick={() => {
                  // Leaving "all day" collapses to a zero-length window at midnight
                  // rather than inventing an hour: the two clocks appear and you pick them.
                  onChange(
                    edited(ranges, r => {
                      r[i] = allDay ? [0, 0] : [0, DAY_END];
                    }),
                  );
                }}
              >
                {allDay ? 'Pick times' : 'All day'}
              </Button>
              <Button
                variant="destructive"
                size="small"
                aria-label={`Remove ${name(i)}`}
                onClick={() => {
                  onChange(ranges.filter((_, j) => j !== i));
                }}
              >
                <Icon name="close" size={14} />
              </Button>
            </div>
          </div>
        );
      })}
      <div>{add}</div>
    </div>
  );
}
