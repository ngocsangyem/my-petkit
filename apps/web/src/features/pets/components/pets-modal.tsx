import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from '@/shared/ui';

interface PetsModalProps {
  open: boolean;
  title: string;
  /** Called by Escape and a click on the backdrop, unless `busy`. */
  onClose: () => void;
  busy?: boolean;
  /** The cropper needs room for the stage and the preview side by side. */
  wide?: boolean;
  /** Element to focus first; defaults to the first focusable element. */
  initialFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * A modal sheet in the shared dialog look, for the forms on this screen (add,
 * import, crop). The shared ConfirmDialog only asks a question; these hold
 * inputs, so they need their own body and buttons.
 */
export function PetsModal({
  open,
  title,
  onClose,
  busy = false,
  wide = false,
  initialFocus,
  children,
}: PetsModalProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useModalFocus(panel, { open, onEscape: busy ? null : onClose, initialFocus });

  if (!open) return null;
  return createPortal(
    <div className="ui-dialog-layer">
      <div
        className="ui-dialog-backdrop"
        aria-hidden="true"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        ref={panel}
        className={wide ? 'ui-dialog pets-modal--wide' : 'ui-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy || undefined}
        tabIndex={-1}
      >
        <h2 id={titleId} className="ui-dialog__title">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
