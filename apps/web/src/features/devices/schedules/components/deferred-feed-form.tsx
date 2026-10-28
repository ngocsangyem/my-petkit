import { useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { Button, TimeInput } from '@/shared/ui';
import { useAddDeferredFeed } from '../api';
import { deviceToday } from '../schedule-clock';
import { PortionInput } from './portion-input';

/** The most portions one one-off feed asks for, as the legacy form allowed. */
const MAX_ONE_OFF_PORTIONS = 20;

interface DeferredFeedFormProps {
  deviceId: number;
  dual: boolean;
  /** Hours east of UTC on the device's clock. */
  offset: number;
}

/** Date, time and portions of a new one-off feed; the date starts at today on the device's clock. */
export function DeferredFeedForm({ deviceId, dual, offset }: DeferredFeedFormProps) {
  const add = useAddDeferredFeed(deviceId);
  const today = deviceToday(offset);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('');
  const [a1, setA1] = useState(1);
  const [a2, setA2] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = () => {
    setNotice(null);
    if (!date || !time) {
      setProblem('Pick a date and a time.');
      return;
    }
    setProblem(null);
    add.mutate(
      { date, time, a1, a2: dual ? a2 : 0 },
      {
        onSuccess: () => {
          setTime('');
          setNotice('Feed scheduled.');
        },
      },
    );
  };

  return (
    <form
      className="sched-entry"
      aria-label="Schedule a one-off feed"
      onSubmit={e => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="sched-row__values">
        <label className="sched-portion">
          <span>Date</span>
          <input
            type="date"
            className="ui-control ui-control--time"
            min={today}
            value={date}
            onChange={e => {
              setDate(e.target.value);
            }}
          />
        </label>
        <label className="sched-portion">
          <span>Time</span>
          <TimeInput value={time} onValueChange={setTime} />
        </label>
        <PortionInput
          label={dual ? 'Hopper 1' : 'Portions'}
          max={MAX_ONE_OFF_PORTIONS}
          value={a1}
          onChange={setA1}
        />
        {dual && (
          <PortionInput label="Hopper 2" max={MAX_ONE_OFF_PORTIONS} value={a2} onChange={setA2} />
        )}
        <Button type="submit" variant="secondary" disabled={add.isPending}>
          {add.isPending ? 'Scheduling…' : 'Schedule feed'}
        </Button>
      </div>
      {(problem !== null || add.isError) && (
        <p className="sched-editor__problem" role="alert">
          {problem ?? `Not scheduled: ${errorMessage(add.error)}`}
        </p>
      )}
      {notice && (
        <p className="sched-muted" role="status">
          {notice}
        </p>
      )}
    </form>
  );
}
