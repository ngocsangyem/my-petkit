import type { ReactNode } from 'react';
import { cn } from 'cn';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/shadcn/dialog';

interface PetsModalProps {
  open: boolean;
  title: string;
  /** Called by Escape and a click on the backdrop, unless `busy`. */
  onClose: () => void;
  busy?: boolean;
  /** The cropper needs room for the stage and the preview side by side. */
  wide?: boolean;
  children: ReactNode;
}

/**
 * A modal sheet in the shared dialog look, for the forms on this screen (add,
 * import, crop). The shared ConfirmDialog only asks a question; these hold
 * inputs, so they need their own body and buttons. Focus is trapped, opens on
 * the first focusable element and returns to the opener on close.
 */
export function PetsModal({
  open,
  title,
  onClose,
  busy = false,
  wide = false,
  children,
}: PetsModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-busy={busy || undefined}
        className={cn(
          'flex max-h-[calc(100vh-32px)] w-[calc(100%-32px)] max-w-[440px] flex-col gap-4 overflow-y-auto text-base sm:max-w-[440px]',
          wide && 'max-w-[720px] sm:max-w-[720px]',
        )}
      >
        <DialogTitle className="text-[18px] leading-normal font-semibold">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
