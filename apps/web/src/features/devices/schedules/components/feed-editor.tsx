import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n';
import { Button, Card, EmptyBlock, Icon, IconButton } from '@/shared/ui';
import { EVERY_DAY, parseDays, secToClock, WEEKDAYS, weekdayName } from '../schedule-clock';
import { edited, type FeedGroup, type FeedValue, nextId } from '../schedule-model';
import { MealSheet } from './meal-sheet';
import { WeekdayBar } from './weekday-bar';

interface FeedEditorProps {
  value: FeedValue;
  onChange: (value: FeedValue) => void;
  /** A Dual-Hopper: each meal carries a portion for hopper 1 (`a1`) and hopper 2 (`a2`). */
  dual: boolean;
}

/** "Every day", "Weekdays", or the day names, for a set's `re`, in the active language. */
export function daysText(re: string): string {
  const on = parseDays(re);
  if (on.size === 7) return i18n.t('devices:feedEditor.everyDay');
  if (on.size === 5 && [2, 3, 4, 5, 6].every(d => on.has(d))) {
    return i18n.t('devices:feedEditor.weekdays');
  }
  if (on.size === 0) return i18n.t('devices:feedEditor.noDays');
  return WEEKDAYS.filter((_, i) => on.has(i + 1))
    .map(weekdayName)
    .join(', ');
}

function portions(a1: number, a2: number, dual: boolean): string {
  if (dual) return i18n.t('devices:feedEditor.dualPortions', { a1, a2 });
  return i18n.t('devices:meal.portions', { count: a1 });
}

/**
 * A feeder's meals: sets that share weekdays (`re`), each a card of meals (`it`, `{id, t, a1, a2}`
 * with `t` in seconds). A meal opens in the right sheet; edits go into the working copy, saved
 * with the schedule.
 */
export function FeedEditor({ value, onChange, dual }: FeedEditorProps) {
  const { t } = useTranslation('devices');
  const groups = value.schedule;
  const [editing, setEditing] = useState<{ gi: number; mi: number } | null>(null);
  const change = (gi: number, fn: (group: FeedGroup) => void) => {
    onChange(
      edited(value, v => {
        const group = v.schedule[gi];
        if (group) fn(group);
      }),
    );
  };
  const addSet = (
    <Button
      variant="text"
      onClick={() => {
        onChange({ ...value, schedule: [...groups, { re: EVERY_DAY, it: [] }] });
      }}
    >
      <Icon name="plus" size={14} />
      {t('feedEditor.addDays')}
    </Button>
  );
  if (!groups.length) return <EmptyBlock action={addSet}>{t('feedEditor.empty')}</EmptyBlock>;

  const open = editing ? groups[editing.gi]?.it[editing.mi] : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {groups.map((group, gi) => (
        <Card
          as="section"
          key={gi}
          aria-label={t('feedEditor.set', { n: gi + 1 })}
          className="flex flex-col gap-1 py-3"
        >
          <div className="flex flex-col gap-1.5 pb-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{daysText(group.re)}</span>
              <IconButton
                icon="close"
                variant="ghost"
                aria-label={t('feedEditor.removeSet', { n: gi + 1 })}
                className="-my-2"
                onClick={() => {
                  onChange({ ...value, schedule: groups.filter((_, j) => j !== gi) });
                }}
              />
            </div>
            <WeekdayBar
              label={t('feedEditor.setDays', { n: gi + 1 })}
              days={group.re}
              onChange={days => {
                change(gi, g => {
                  g.re = days;
                });
              }}
            />
          </div>
          {group.it.length ? (
            <ul className="m-0 flex list-none flex-col p-0">
              {group.it.map((meal, mi) => (
                <li key={mi} className="flex min-h-16 items-center gap-3 border-t border-rule">
                  <span className="w-24 text-2xl font-medium tabular-nums">
                    {secToClock(meal.t)}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                    {portions(meal.a1, meal.a2, dual)}
                  </span>
                  <Button
                    size="small"
                    aria-label={t('feedEditor.editMeal', { meal: mi + 1, set: gi + 1 })}
                    onClick={() => {
                      setEditing({ gi, mi });
                    }}
                  >
                    {t('feedEditor.edit')}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-t border-rule py-3 text-sm text-muted-foreground">
              {t('feedEditor.noMeals')}
            </p>
          )}
          <div className="border-t border-rule pt-2">
            <Button
              variant="text"
              aria-label={t('feedEditor.addMealTo', { n: gi + 1 })}
              onClick={() => {
                // Ids only have to be distinct within the schedule the device is
                // handed; the server turns a numeric id into its `n_<seconds>` form.
                const id = nextId(groups.flatMap(g => g.it.map(m => m.id)));
                change(gi, g => {
                  g.it.push({ id, t: 0, a1: 1, a2: 0 });
                });
                setEditing({ gi, mi: group.it.length });
              }}
            >
              <Icon name="plus" size={14} />
              {t('feedEditor.addMeal')}
            </Button>
          </div>
        </Card>
      ))}
      <div>{addSet}</div>
      {editing && open && (
        <MealSheet
          name={t('feedEditor.mealName', { meal: editing.mi + 1, set: editing.gi + 1 })}
          days={daysText(groups[editing.gi]?.re ?? '')}
          everyDay={parseDays(groups[editing.gi]?.re ?? '').size === 7}
          meal={open}
          dual={dual}
          onClose={() => {
            setEditing(null);
          }}
          onChange={(field, n) => {
            change(editing.gi, g => {
              const m = g.it[editing.mi];
              if (m) m[field] = n;
            });
          }}
          onDelete={() => {
            change(editing.gi, g => {
              g.it.splice(editing.mi, 1);
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
