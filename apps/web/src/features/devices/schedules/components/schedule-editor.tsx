import { useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { Button, Card } from '@/shared/ui';
import { useSaveSchedule } from '../api';
import { draftOf, type ScheduleDraft, type ScheduleTarget, validateDraft } from '../schedule-model';
import { FeedEditor } from './feed-editor';
import { PointsEditor } from './points-editor';
import { RangeList } from './range-list';
import { WeeklyEditor } from './weekly-editor';

interface ScheduleEditorProps {
  deviceId: number;
  /** The target as the device detail currently serves it. */
  target: ScheduleTarget;
  /** The working copy, or undefined while nothing has been changed. */
  draft: ScheduleDraft | undefined;
  onDraft: (draft: ScheduleDraft | undefined) => void;
}

/**
 * The value that goes on the wire. A feeder's schedule object also carries
 * keys this editor does not own (`deferred`, the one-off feeds), and the server
 * stores the object it is sent; so everything but the meals comes from the
 * device's CURRENT value, never from the copy taken when editing began, or a
 * one-off feed added meanwhile would be deleted by this save.
 */
function wireValue(draft: ScheduleDraft, target: ScheduleTarget): unknown {
  if (draft.kind !== 'feed') return draft.value;
  const current = draftOf(target);
  return current.kind === 'feed'
    ? { ...current.value, schedule: draft.value.schedule }
    : draft.value;
}

/** One schedule: its editor, and Save / Discard once something has changed. */
export function ScheduleEditor({ deviceId, target, draft, onDraft }: ScheduleEditorProps) {
  const save = useSaveSchedule(deviceId);
  const [notice, setNotice] = useState<string | null>(null);
  const shown = draft ?? draftOf(target);
  const problem = draft ? validateDraft(draft) : null;
  const change = (next: ScheduleDraft) => {
    setNotice(null);
    save.reset();
    onDraft(next);
  };

  let body;
  switch (shown.kind) {
    case 'ranges':
      body = (
        <RangeList
          ranges={shown.value}
          onChange={value => {
            change({ kind: 'ranges', value });
          }}
        />
      );
      break;
    case 'weekly':
      body = (
        <WeeklyEditor
          value={shown.value}
          onChange={value => {
            change({ kind: 'weekly', value });
          }}
        />
      );
      break;
    case 'points':
      body = (
        <PointsEditor
          value={shown.value}
          onChange={value => {
            change({ kind: 'points', value });
          }}
        />
      );
      break;
    case 'feed':
      body = (
        <FeedEditor
          dual={target.dual ?? false}
          value={shown.value}
          onChange={value => {
            change({ kind: 'feed', value });
          }}
        />
      );
      break;
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {shown.kind === 'feed' ? body : <Card className="py-3">{body}</Card>}
      {draft && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button
            variant="primary"
            disabled={problem !== null || save.isPending}
            onClick={() => {
              save.mutate(
                { target: target.target, value: wireValue(draft, target) },
                {
                  onSuccess: res => {
                    onDraft(undefined);
                    setNotice(
                      res.delivered === 'mqtt'
                        ? 'Saved and sent to the device.'
                        : 'Saved. The device picks it up on its next poll.',
                    );
                  },
                },
              );
            }}
          >
            {save.isPending ? 'Saving…' : `Save ${target.name}`}
          </Button>
          <Button
            variant="text"
            disabled={save.isPending}
            onClick={() => {
              save.reset();
              onDraft(undefined);
            }}
          >
            Discard
          </Button>
          {problem && <span className="text-sm text-negative">{problem}</span>}
        </div>
      )}
      {save.isError && (
        <p className="text-sm text-negative" role="alert">
          Not saved: {errorMessage(save.error)}
        </p>
      )}
      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
