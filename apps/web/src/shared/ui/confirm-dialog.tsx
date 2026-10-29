import { useRef, type ReactNode } from 'react';
import { Button } from './button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './shadcn/dialog';

/** Props for {@link ConfirmDialog}. */
export interface ConfirmDialogProps {
  open: boolean;
  /** A question, e.g. "Clean the litter box now?" */
  title: string;
  /** What will move or change, in plain words. */
  children: ReactNode;
  /** Verb for the near-black confirm button, e.g. "Clean now". */
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Called by Cancel, Escape and a click on the backdrop. */
  onCancel: () => void;
  /** While true both buttons are disabled and Escape is ignored. */
  busy?: boolean;
  /** Disables only the confirm button, e.g. until a required field is filled. */
  confirmDisabled?: boolean;
}

/**
 * Confirm sheet for device commands (R2): a question title, a body saying what moves, and a
 * near-black confirm button. Modal: focus is trapped, Escape or a backdrop click cancels, focus
 * returns on close. A Base UI dialog with the alertdialog role rather than its AlertDialog, which
 * ignores backdrop clicks.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  busy = false,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent
        role="alertdialog"
        showCloseButton={false}
        initialFocus={cancelRef}
        aria-busy={busy || undefined}
        className="max-h-[calc(100vh-32px)] w-[calc(100%-32px)] max-w-[440px] gap-4 overflow-y-auto sm:max-w-[440px]"
      >
        <div className="grid gap-1.5">
          <DialogTitle className="text-[18px] leading-snug font-semibold">{title}</DialogTitle>
          <DialogDescription
            render={<div />}
            className="flex flex-col gap-2 text-base text-muted-foreground"
          >
            {children}
          </DialogDescription>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            ref={cancelRef}
            variant="secondary"
            size="large"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            size="large"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
