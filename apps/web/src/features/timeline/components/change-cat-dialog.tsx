import { useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { IconButton, useToast } from '@/shared/ui';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/shadcn/dialog';
import { useSetVisitPet, type TimelinePet, type VisitPetRequest } from '../api';
import { formatWeight, type TimelineSession } from '../timeline-model';
import { changeCatTitle } from '../visit-pet-model';
import { ChangeCatForm } from './change-cat-form';

export interface ChangeCatDialogProps {
  /** A visit with a numeric event id; the dialog is mounted only while open. */
  session: TimelineSession & { id: number };
  pets: readonly TimelinePet[];
  onClose: () => void;
}

function savedSentence(body: VisitPetRequest, pets: readonly TimelinePet[], s: TimelineSession) {
  if (body.passing) return 'Marked as just passing';
  const name = pets.find(p => p.id === body.pet_id)?.name ?? 'the cat';
  const weight = body.use_weight ? formatWeight(s.weight) : null;
  return weight ? `Assigned to ${name}; registered weight now ${weight}` : `Assigned to ${name}`;
}

/**
 * "Who used the box at 14:31?": a centred dialog, full width on a phone. Saving changes only the
 * server's record of this visit; a refusal stays inside the dialog, success is a toast.
 */
export function ChangeCatDialog({ session, pets, onClose }: ChangeCatDialogProps) {
  const toast = useToast();
  const save = useSetVisitPet();
  const [error, setError] = useState<string | null>(null);
  const busy = save.isPending;

  return (
    <Dialog
      open
      onOpenChange={next => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-busy={busy || undefined}
        className="max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-125 overflow-y-auto sm:max-w-125"
      >
        <div className="flex items-start justify-between gap-3">
          <DialogTitle className="pt-1.5">{changeCatTitle(session)}</DialogTitle>
          <IconButton icon="close" aria-label="Close" disabled={busy} onClick={onClose} />
        </div>
        <ChangeCatForm
          session={session}
          pets={pets}
          busy={busy}
          error={error}
          onCancel={onClose}
          onSave={body => {
            setError(null);
            save.mutate(
              { id: session.id, body },
              {
                onSuccess: () => {
                  toast(savedSentence(body, pets, session));
                  onClose();
                },
                onError: e => {
                  setError(errorMessage(e));
                },
              },
            );
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
