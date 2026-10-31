import { useTranslation } from 'react-i18next';
import { Button, EmptyBlock, Icon, Switch } from '@/shared/ui';
import { DAY_END, EVERY_DAY } from '../schedule-clock';
import { edited, type WeeklyEntry } from '../schedule-model';
import { RangeList, schedEmptyText } from './range-list';
import { WeekdayBar } from './weekday-bar';

interface WeeklyEditorProps {
  value: WeeklyEntry[];
  onChange: (value: WeeklyEntry[]) => void;
}

/** `[{enable, rpt, time}]`: periods that apply on chosen weekdays, each entry with its own switch. */
export function WeeklyEditor({ value, onChange }: WeeklyEditorProps) {
  const { t } = useTranslation('devices');
  const add = (
    <Button
      variant="text"
      onClick={() => {
        onChange([...value, { enable: 1, rpt: EVERY_DAY, time: [[0, DAY_END]] }]);
      }}
    >
      <Icon name="plus" size={14} />
      {t('weekly.add')}
    </Button>
  );
  if (!value.length) return <EmptyBlock action={add}>{schedEmptyText()}</EmptyBlock>;

  const change = (i: number, fn: (entry: WeeklyEntry) => void) => {
    onChange(
      edited(value, v => {
        const entry = v[i];
        if (entry) fn(entry);
      }),
    );
  };
  return (
    <div className="flex min-w-0 flex-col">
      {value.map((entry, i) => (
        <div
          data-slot="panel"
          className="flex flex-col gap-2 rounded-md bg-raised px-4 py-3 [--pk-fill-field:var(--pk-surface)] [--pk-fill-secondary:var(--pk-surface)]"
          key={i}
        >
          <div className="flex min-h-13 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-rule py-2 first:border-t-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              <Switch
                small
                label={t('weekly.enabled')}
                checked={entry.enable === 1}
                onCheckedChange={on => {
                  change(i, e => {
                    e.enable = on ? 1 : 0;
                  });
                }}
              />
              <WeekdayBar
                label={t('weekly.days', { n: i + 1 })}
                days={entry.rpt}
                onChange={days => {
                  change(i, e => {
                    e.rpt = days;
                  });
                }}
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="destructive"
                size="small"
                aria-label={t('weekly.remove', { n: i + 1 })}
                onClick={() => {
                  onChange(value.filter((_, j) => j !== i));
                }}
              >
                <Icon name="close" size={14} />
              </Button>
            </div>
          </div>
          <RangeList
            context={t('weekly.entry', { n: i + 1 })}
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
