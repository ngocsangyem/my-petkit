import { cn } from 'cn';
import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n';
import { Icon } from '@/shared/ui';

interface ProvisionProgressProps {
  wifiDone: boolean;
  serverDone: boolean;
  sent: boolean;
}

function stepsOf({ wifiDone, serverDone, sent }: ProvisionProgressProps) {
  const steps = [
    { id: 'wifi', label: i18n.t('provision:progress.wifi'), done: wifiDone },
    { id: 'server', label: i18n.t('provision:progress.server'), done: serverDone },
    { id: 'send', label: i18n.t('provision:progress.send'), done: sent },
  ];
  return { steps, done: steps.filter(s => s.done).length, next: steps.find(s => !s.done) };
}

/** "1 of 3 done" as a pill beside the title; it is the page's progress bar for assistive tech. */
export function ProvisionProgressPill(props: ProvisionProgressProps) {
  const { t } = useTranslation('provision');
  const { steps, done } = stepsOf(props);
  return (
    <span
      role="progressbar"
      aria-label={t('progress.label')}
      aria-valuemin={0}
      aria-valuemax={steps.length}
      aria-valuenow={done}
      className="inline-flex h-5.5 items-center rounded-full bg-pill-neutral px-2.5 text-xs font-medium text-pill-neutral-ink"
    >
      {t('progress.done', { done, total: steps.length })}
    </span>
  );
}

/** The three steps with a disc each: a check when done, the number in ink when it is next. */
export function ProvisionSteps(props: ProvisionProgressProps) {
  const { t } = useTranslation('provision');
  const { steps, next } = stepsOf(props);
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {steps.map((s, i) => {
        const current = s === next;
        return (
          <li
            key={s.id}
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
              <span className="sr-only">
                {t(
                  s.done
                    ? 'progress.stepDone'
                    : current
                      ? 'progress.stepNext'
                      : 'progress.stepTodo',
                )}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
