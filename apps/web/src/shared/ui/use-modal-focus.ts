import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
}

/** Options for {@link useModalFocus}. */
export interface ModalFocusOptions {
  open: boolean;
  /** Called on Escape; ignored when `null` (e.g. while a command is in flight). */
  onEscape: (() => void) | null;
  /** Element to focus first; defaults to the first focusable element inside. */
  initialFocus?: RefObject<HTMLElement | null>;
}

/**
 * Modal keyboard behaviour for dialogs and menu sheets: moves focus in on open, keeps Tab inside
 * the container, closes on Escape, and returns focus to the opener on close.
 */
export function useModalFocus(
  container: RefObject<HTMLElement | null>,
  options: ModalFocusOptions,
): void {
  const { open, initialFocus } = options;
  const onEscape = useRef(options.onEscape);
  useEffect(() => {
    onEscape.current = options.onEscape;
  });

  useEffect(() => {
    if (!open) return;
    const root = container.current;
    if (!root) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = initialFocus?.current ?? focusables(root)[0] ?? root;
    first.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (onEscape.current) {
          event.preventDefault();
          onEscape.current();
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables(root);
      if (items.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }
      const head = items[0];
      const tail = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === head || !root.contains(active))) {
        event.preventDefault();
        tail?.focus();
      } else if (!event.shiftKey && (active === tail || !root.contains(active))) {
        event.preventDefault();
        head?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [open, container, initialFocus]);
}
