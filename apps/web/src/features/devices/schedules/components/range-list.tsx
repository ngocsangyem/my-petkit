import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n';
import { Button, EmptyBlock, Icon, TimeInput } from '@/shared/ui';
import { clockToMin, DAY_END, isAllDay, minToClock } from '../schedule-clock';
import { edited, type Range } from '../schedule-model';

/** The same sentence for every empty range list: unset means unrestricted, not broken. */
export const schedEmptyText = () => i18n.t('devices:ranges.empty');

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
  const { t } = useTranslation('devices');
  const name = (i: number) =>
    context ? t('ranges.periodIn', { entry: context, n: i + 1 }) : t('ranges.period', { n: i + 1 });
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
      {t('ranges.add')}
    </Button>
  );
  if (!ranges.length) return <EmptyBlock action={add}>{schedEmptyText()}</EmptyBlock>;

  return (
    <div className="flex min-w-0 flex-col">
      {ranges.map((pair, i) => {
        const allDay = isAllDay(pair);
        return (
          <div
            className="flex min-h-13 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-rule py-2 first:border-t-0"
            key={i}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              {allDay ? (
                <span className="font-semibold">{t('ranges.allDay')}</span>
              ) : (
                <>
                  <TimeInput
                    aria-label={t('ranges.start', { name: name(i) })}
                    value={minToClock(pair[0])}
                    onValueChange={v => {
                      set(i, 0, v);
                    }}
                  />
                  <span className="text-sm text-muted-foreground" aria-hidden="true">
                    {t('autoPack.fields.to')}
                  </span>
                  <TimeInput
                    aria-label={t('ranges.end', { name: name(i) })}
                    value={minToClock(pair[1])}
                    onValueChange={v => {
                      set(i, 1, v);
                    }}
                  />
                  {pair[1] < pair[0] && (
                    <span className="text-sm text-muted-foreground">{t('ranges.nextDay')}</span>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="text"
                size="small"
                aria-label={
                  allDay
                    ? t('ranges.pickTimesFor', { name: name(i) })
                    : t('ranges.makeAllDay', { name: name(i) })
                }
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
                {allDay ? t('ranges.pickTimes') : t('ranges.allDay')}
              </Button>
              <Button
                variant="destructive"
                size="small"
                aria-label={t('ranges.remove', { name: name(i) })}
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
