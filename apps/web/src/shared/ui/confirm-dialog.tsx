import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './button';
import { useModalFocus } from './use-modal-focus';
import './confirm-dialog.css';

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
  const titleId = useId();
  const bodyId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useModalFocus(panel, { open, onEscape: busy ? null : onCancel, initialFocus: cancelRef });

  if (!open) return null;
  return createPortal(
    <div className="ui-dialog-layer">
      <div
        className="ui-dialog-backdrop"
        aria-hidden="true"
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div
        ref={panel}
        className="ui-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        aria-busy={busy || undefined}
        tabIndex={-1}
      >
        <h2 id={titleId} className="ui-dialog__title">
          {title}
        </h2>
        <div id={bodyId} className="ui-dialog__body">
          {children}
        </div>
        <div className="ui-dialog__actions">
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
      </div>
    </div>,
    document.body,
  );
}
