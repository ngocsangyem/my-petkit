import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from './icon-button';

/** Props for {@link OverlayTitleRow}. */
export interface OverlayTitleRowProps {
  /** The overlay's own title element: a `DialogTitle` or a `SheetTitle`. */
  children: ReactNode;
  onClose: () => void;
  /** Disable Close while the overlay is busy saving. */
  closeDisabled?: boolean;
}

/**
 * The top row of a dialog or right sheet: its title on the left and a round Close button on the
 * right. A one-line title sits centred on the button; a title that wraps (on a phone) stays
 * top-aligned with it. Pair it with `showCloseButton={false}` on the content.
 */
export function OverlayTitleRow({ children, onClose, closeDisabled }: OverlayTitleRowProps) {
  const { t } = useTranslation('common');
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 pt-1.5">{children}</div>
      <IconButton icon="close" aria-label={t('close')} disabled={closeDisabled} onClick={onClose} />
    </div>
  );
}
