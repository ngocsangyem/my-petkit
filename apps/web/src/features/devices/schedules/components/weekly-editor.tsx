import { Button, EmptyBlock, Icon, Switch } from '@/shared/ui';
import { DAY_END, EVERY_DAY } from '../schedule-clock';
import { edited, type WeeklyEntry } from '../schedule-model';
import { RangeList, SCHED_EMPTY } from './range-list';
import { WeekdayBar } from './weekday-bar';

interface WeeklyEditorProps {
  value: WeeklyEntry[];
  onChange: (value: WeeklyEntry[]) => void;
}

/** `[{enable, rpt, time}]`: periods that apply on chosen weekdays, each entry with its own switch. */
export function WeeklyEditor({ value, onChange }: WeeklyEditorProps) {
  const add = (
    <Button
      variant="text"
      onClick={() => {
        onChange([...value, { enable: 1, rpt: EVERY_DAY, time: [[0, DAY_END]] }]);
      }}
    >
      <Icon name="plus" size={14} />
      Add entry
    </Button>
  );
  if (!value.length) return <EmptyBlock action={add}>{SCHED_EMPTY}</EmptyBlock>;

  const change = (i: number, fn: (entry: WeeklyEntry) => void) => {
    onChange(
      edited(value, v => {
        const entry = v[i];
        if (entry) fn(entry);
      }),
    );
  };
  return (
    <div className="sched-list">
      {value.map((entry, i) => (
        <div className="sched-entry" key={i}>
          <div className="sched-row">
            <div className="sched-row__values">
              <Switch
                small
                label="Enabled"
                checked={entry.enable === 1}
                onCheckedChange={on => {
                  change(i, e => {
                    e.enable = on ? 1 : 0;
                  });
                }}
              />
              <WeekdayBar
                label={`Days of entry ${i + 1}`}
                days={entry.rpt}
                onChange={days => {
                  change(i, e => {
                    e.rpt = days;
                  });
                }}
              />
            </div>
            <div className="sched-row__actions">
              <Button
                variant="destructive"
                size="small"
                aria-label={`Remove entry ${i + 1}`}
                onClick={() => {
                  onChange(value.filter((_, j) => j !== i));
                }}
              >
                <Icon name="close" size={14} />
              </Button>
            </div>
          </div>
          <RangeList
            context={`Entry ${i + 1}`}
            ranges={entry.time}
            onChange={time => {
              change(i, e => {
                e.time = time;
              });
            }}
          />
        </div>
      ))}
      <div>{add}</div>
    </div>
  );
}
