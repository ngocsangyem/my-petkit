import { useRef, type ReactNode } from 'react';
import { Button } from './button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './shadcn/alert-dialog';

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
  /** Called by Cancel and Escape. */
  onCancel: () => void;
  /** While true both buttons are disabled and Escape is ignored. */
  busy?: boolean;
  /** Disables only the confirm button, e.g. until a required field is filled. */
  confirmDisabled?: boolean;
}

/**
 * Confirm sheet for device commands (R2): a question title, a body saying what moves, and a
 * near-black confirm button. Modal: focus is trapped, Escape cancels, focus returns on close.
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
    <AlertDialog
      open={open}
      onOpenChange={next => {
        if (!next && !busy) onCancel();
      }}
    >
      <AlertDialogContent initialFocus={cancelRef} aria-busy={busy || undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription render={<div />}>{children}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
