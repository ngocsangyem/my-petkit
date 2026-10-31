import { cn } from 'cn';
import { Icon } from '@/shared/ui';

interface ProvisionProgressProps {
  wifiDone: boolean;
  serverDone: boolean;
  sent: boolean;
}

function stepsOf({ wifiDone, serverDone, sent }: ProvisionProgressProps) {
  const steps = [
    { label: 'Wi-Fi network', done: wifiDone },
    { label: 'Server and time zone', done: serverDone },
    { label: 'Send to the device', done: sent },
  ];
  return { steps, done: steps.filter(s => s.done).length, next: steps.find(s => !s.done) };
}

/** "1 of 3 done" as a pill beside the title; it is the page's progress bar for assistive tech. */
export function ProvisionProgressPill(props: ProvisionProgressProps) {
  const { steps, done } = stepsOf(props);
  return (
    <span
      role="progressbar"
      aria-label="Provisioning progress"
      aria-valuemin={0}
      aria-valuemax={steps.length}
      aria-valuenow={done}
      className="inline-flex h-5.5 items-center rounded-full bg-pill-neutral px-2.5 text-xs font-medium text-pill-neutral-ink"
    >
      {done} of {steps.length} done
    </span>
  );
}

/** The three steps with a disc each: a check when done, the number in ink when it is next. */
export function ProvisionSteps(props: ProvisionProgressProps) {
  const { steps, next } = stepsOf(props);
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {steps.map((s, i) => {
        const current = s === next;
        return (
          <li
            key={s.label}
            aria-current={current ? 'step' : undefined}
            className={cn(
              'flex min-h-10 items-center gap-3',
              current && 'font-semibold',
              !s.done && !current && 'text-muted-foreground',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-6 flex-none items-center justify-center rounded-full text-sm font-normal',
                s.done && 'bg-pill-positive text-pill-positive-ink',
                current && 'bg-primary text-primary-foreground',
                !s.done && !current && 'bg-pill-neutral text-muted-foreground',
              )}
            >
              {s.done ? <Icon name="check" size={14} strokeWidth={2} /> : i + 1}
            </span>
            <span>
              {s.label}
              <span className="sr-only">, {s.done ? 'done' : current ? 'next' : 'to do'}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
