import { Button, OverlayTitleRow, Panel, TimeInput } from '@/shared/ui';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/shared/ui/shadcn/sheet';
import { clockToSec, secToClock } from '../schedule-clock';
import type { FeedMeal } from '../schedule-model';
import { PortionInput } from './portion-input';

interface MealSheetProps {
  /** "Meal 1 of set 1": names the fields. */
  name: string;
  /** The days of the meal's set, e.g. "Every day". */
  days: string;
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
export function MealSheet({ name, days, meal, dual, onChange, onDelete, onClose }: MealSheetProps) {
  return (
    <Sheet
      open
      onOpenChange={next => {
        if (!next) onClose();
      }}
    >
      <SheetContent side="right" showCloseButton={false} className="overflow-y-auto">
        <OverlayTitleRow onClose={onClose}>
          <SheetTitle>Edit meal</SheetTitle>
        </OverlayTitleRow>
        <SheetDescription className="-mt-2">
          {name}. Repeats {days === 'Every day' ? 'every day' : `on ${days}`}, the days of its set.
        </SheetDescription>
        <label className="flex flex-col gap-1.5">
          <span className="ml-1 text-sm text-muted-foreground">Time</span>
          <TimeInput
            aria-label={`${name} time`}
            value={secToClock(meal.t)}
            onValueChange={v => {
              const s = clockToSec(v);
              if (s !== null) onChange('t', s);
            }}
          />
        </label>
        <Panel className="flex flex-col gap-3">
          <PortionInput
            label={dual ? 'Hopper 1' : 'Portions'}
            max={255}
            value={meal.a1}
            onChange={n => {
              onChange('a1', n);
            }}
          />
          {dual && (
            <PortionInput
              label="Hopper 2"
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
            Done
          </Button>
          <Button variant="ghost" className="text-negative" onClick={onDelete}>
            Delete meal
          </Button>
          <p className="text-xs text-muted-foreground">
            Changes are kept in this schedule until you save it.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
