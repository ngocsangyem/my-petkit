import { useId, useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { Button, TimeInput } from '@/shared/ui';
import { Input } from '@/shared/ui/shadcn/input';
import { useAddDeferredFeed } from '../api';
import { deviceToday } from '../schedule-clock';
import { InlineControlField, PortionInput } from './portion-input';

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
  const id = useId();
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
      className="flex flex-col gap-2 rounded-lg border border-border p-3"
      aria-label="Schedule a one-off feed"
      onSubmit={e => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <InlineControlField id={`${id}-date`} label="Date">
          <Input
            id={`${id}-date`}
            type="date"
            className="w-auto"
            min={today}
            value={date}
            onChange={e => {
              setDate(e.target.value);
            }}
          />
        </InlineControlField>
        <InlineControlField id={`${id}-time`} label="Time">
          <TimeInput id={`${id}-time`} value={time} onValueChange={setTime} />
        </InlineControlField>
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
        <p className="text-sm text-negative" role="alert">
          {problem ?? `Not scheduled: ${errorMessage(add.error)}`}
        </p>
      )}
      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}
    </form>
  );
}
