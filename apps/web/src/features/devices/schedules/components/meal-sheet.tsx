import { useTranslation } from 'react-i18next';
import { Button, OverlayTitleRow, Panel, TimeInput } from '@/shared/ui';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/shared/ui/shadcn/sheet';
import { clockToSec, secToClock } from '../schedule-clock';
import type { FeedMeal } from '../schedule-model';
import { PortionInput } from './portion-input';

interface MealSheetProps {
  /** "Meal 1 of set 1": names the fields. */
  name: string;
  /** The days of the meal's set, e.g. "Mon, Wed". */
  days: string;
  /** The set runs on all seven days. */
  everyDay: boolean;
  meal: FeedMeal;
  dual: boolean;
  onChange: (field: 't' | 'a1' | 'a2', value: number) => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * The meal editor in the right sheet: the time, the portions per hopper, and Delete. Every change
 * lands in the schedule's working copy at once; Done closes the sheet, and the schedule is sent
 * with Save.
 */
export function MealSheet(props: MealSheetProps) {
  const { name, days, everyDay, meal, dual, onChange, onDelete, onClose } = props;
  const { t } = useTranslation('devices');
  return (
    <Sheet
      open
      onOpenChange={next => {
        if (!next) onClose();
      }}
    >
      <SheetContent side="right" showCloseButton={false} className="overflow-y-auto">
        <OverlayTitleRow onClose={onClose}>
          <SheetTitle>{t('mealSheet.title')}</SheetTitle>
        </OverlayTitleRow>
        <SheetDescription className="-mt-2">
          {everyDay
            ? t('mealSheet.repeatsEveryDay', { name })
            : t('mealSheet.repeatsOn', { name, days })}
        </SheetDescription>
        <label className="flex flex-col gap-1.5">
          <span className="ml-1 text-sm text-muted-foreground">{t('deferred.time')}</span>
          <TimeInput
            aria-label={t('mealSheet.timeLabel', { name })}
            value={secToClock(meal.t)}
            onValueChange={v => {
              const s = clockToSec(v);
              if (s !== null) onChange('t', s);
            }}
          />
        </label>
        <Panel className="flex flex-col gap-3">
          <PortionInput
            label={dual ? t('feeder.hopper', { n: 1 }) : t('deferred.portions')}
            max={255}
            value={meal.a1}
            onChange={n => {
              onChange('a1', n);
            }}
          />
          {dual && (
            <PortionInput
              label={t('feeder.hopper', { n: 2 })}
              max={255}
              value={meal.a2}
              onChange={n => {
                onChange('a2', n);
              }}
            />
          )}
        </Panel>
        <div className="mt-auto flex flex-col gap-2">
          <Button variant="primary" size="large" onClick={onClose}>
            {t('mealSheet.done')}
          </Button>
          <Button variant="ghost" className="text-negative" onClick={onDelete}>
            {t('mealSheet.delete')}
          </Button>
          <p className="text-xs text-muted-foreground">{t('mealSheet.kept')}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
