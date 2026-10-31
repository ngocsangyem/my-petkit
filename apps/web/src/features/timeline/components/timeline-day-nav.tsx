import type { MouseEvent } from 'react';
import { Button, buttonClassName, Icon } from '@/shared/ui';
import { shiftDay, todayLocal } from '@/shared/format/local-day';
import { isDateString } from '../timeline-model';

export interface TimelineDayNavProps {
  date: string;
  onDate: (date: string) => void;
}

/** "Today, 28 Oct" or "Mon, 27 Oct", read on the calendar date the picker holds. */
export function dayButtonLabel(date: string, today: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  const dayMonth = d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  if (date === today) return `Today, ${dayMonth}`;
  const weekday = d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
  return `${weekday}, ${dayMonth}`;
}

/** Opens the native calendar where the browser can; typing into the field still works without. */
function openPicker(event: MouseEvent<HTMLInputElement>) {
  try {
    event.currentTarget.showPicker();
  } catch {
    // Not supported, or not allowed for this click: the focused field takes typing instead.
  }
}

/**
 * Previous day, the day as a pill that opens the calendar, next day. The pill is the date field
 * itself, drawn transparent over the words, so it stays a real labelled input.
 */
export function TimelineDayNav({ date, onDate }: TimelineDayNavProps) {
  const today = todayLocal();
  return (
    <div className="flex items-center gap-2">
      <Button
        aria-label="Previous day"
        onClick={() => {
          onDate(shiftDay(date, -1));
        }}
      >
        <Icon name="back" size={16} strokeWidth={2} />
      </Button>
      <span
        className={buttonClassName(
          'secondary',
          'regular',
          'relative has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
        )}
      >
        <Icon name="calendar" size={16} />
        <span aria-hidden="true">{dayButtonLabel(date, today)}</span>
        <input
          type="date"
          aria-label="Date"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={date}
          max={today}
          onClick={openPicker}
          onChange={e => {
            if (isDateString(e.target.value)) onDate(e.target.value);
          }}
        />
      </span>
      <Button
        aria-label="Next day"
        disabled={date >= today}
        onClick={() => {
          onDate(shiftDay(date, 1));
        }}
      >
        <Icon name="forward" size={16} strokeWidth={2} />
      </Button>
    </div>
  );
}
