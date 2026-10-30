import { useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { useToast } from '@/shared/ui';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/shadcn/dialog';
import { Sheet, SheetContent, SheetTitle } from '@/shared/ui/shadcn/sheet';
import { useSetVisitPet, type TimelinePet, type VisitPetRequest } from '../api';
import { formatWeight, type TimelineSession } from '../timeline-model';
import { changeCatTitle } from '../visit-pet-model';
import { ChangeCatForm } from './change-cat-form';

const TITLE = 'text-[18px] leading-snug font-semibold';

export interface ChangeCatSheetProps {
  /** A visit with a numeric event id; the sheet is mounted only while open. */
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
 * "Who used the box at 14:31?": a bottom sheet on a phone, a dialog elsewhere. Saving changes
 * only the server's record of this visit; a refusal stays inside the sheet, success is a toast.
 */
export function ChangeCatSheet({ session, pets, onClose }: ChangeCatSheetProps) {
  const mobile = useIsMobile();
  const toast = useToast();
  const save = useSetVisitPet();
  const [error, setError] = useState<string | null>(null);
  const busy = save.isPending;
  const title = changeCatTitle(session);

  const onOpenChange = (next: boolean) => {
    if (!next && !busy) onClose();
  };
  const form = (
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
  );

  if (mobile) {
    return (
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          aria-busy={busy || undefined}
          className="max-h-[90vh] gap-3 overflow-y-auto rounded-t-xl p-5 text-base"
        >
          <SheetTitle className={TITLE}>{title}</SheetTitle>
          {form}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-busy={busy || undefined}
        className="max-h-[calc(100vh-32px)] w-[calc(100%-32px)] max-w-[440px] gap-3 overflow-y-auto text-base sm:max-w-[440px]"
      >
        <DialogTitle className={TITLE}>{title}</DialogTitle>
        {form}
      </DialogContent>
    </Dialog>
  );
}
