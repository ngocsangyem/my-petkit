import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui';
import { sessionKey, type TimelineSession } from '../timeline-model';
import { isUnrecognisedVisit } from '../timeline-view-filter';
import { canChangeCat } from '../visit-pet-model';
import { TimelineEventRow } from './timeline-event-row';

export interface TimelineEventListProps {
  sessions: readonly TimelineSession[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Name the device on each row; only worth it when the household has more than one. */
  showDevice: boolean;
  /** Ask who an unrecognised visit was; opens the change-cat dialog for that session. */
  onAskWho: (session: TimelineSession & { id: number }, key: string) => void;
}

/**
 * The day's sessions, newest first, as rows split by a 1px rule. A row selects its session; an
 * unrecognised visit also offers "Who was it?" beside it, which goes straight to the question.
 */
export function TimelineEventList({
  sessions,
  selectedKey,
  onSelect,
  showDevice,
  onAskWho,
}: TimelineEventListProps) {
  const { t } = useTranslation('timeline');
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {sessions.map((s, i) => {
        const key = sessionKey(s, i);
        return (
          <li
            key={key}
            className="flex items-center gap-2 rounded-md border-t border-l-2 border-t-rule border-l-transparent first:border-t-0 has-[button[aria-pressed=true]]:border-l-data has-[button[aria-pressed=true]]:bg-raised"
          >
            <div className="min-w-0 flex-1">
              <TimelineEventRow
                session={s}
                selected={key === selectedKey}
                onSelect={() => {
                  onSelect(key);
                }}
                device={showDevice ? s.device_name || '—' : null}
              />
            </div>
            {canChangeCat(s) && isUnrecognisedVisit(s) && (
              <Button
                variant="text"
                size="small"
                className="mr-2 flex-none"
                onClick={() => {
                  onAskWho(s, key);
                }}
              >
                {t('row.whoWasIt')}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
