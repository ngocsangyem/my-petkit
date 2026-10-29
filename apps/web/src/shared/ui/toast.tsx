import { Toast } from '@base-ui/react/toast';
import { useCallback, type ReactNode } from 'react';
import { XIcon } from 'lucide-react';

// Built on the Base UI primitive rather than shadcn's Sonner: Sonner injects
// a <style> element at runtime, which the app's CSP (no inline styles) blocks.

/** How long a toast stays; an error toast stays until it is closed. */
const TIMEOUT_MS = 2600;

/** Wraps the app once: holds the toast queue and renders it bottom right. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider timeout={TIMEOUT_MS} limit={3}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col-reverse gap-2 outline-none">
          <Toasts />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function Toasts() {
  const { toasts } = Toast.useToastManager();
  return toasts.map(toast => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      data-slot="toast"
      className="flex items-start gap-3 rounded-lg border border-border bg-popover px-4 py-3 text-body text-popover-foreground shadow-overlay transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 data-[type=error]:text-destructive"
    >
      {/* Titles are plain strings rendered as text, never markup. */}
      <Toast.Title className="min-w-0 flex-1 break-words" />
      <Toast.Close
        aria-label="Dismiss"
        className="-m-1 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <XIcon className="size-4" aria-hidden="true" />
      </Toast.Close>
    </Toast.Root>
  ));
}

/**
 * A short status sentence ("Copied", "Saved 12 rows"). Errors stay until the
 * user closes them; everything else clears itself.
 */
export function useToast(): (text: string, options?: { error?: boolean }) => void {
  const { add } = Toast.useToastManager();
  return useCallback(
    (text, options) => {
      add(
        options?.error
          ? { title: text, type: 'error', timeout: 0, priority: 'high' }
          : { title: text, type: 'status' },
      );
    },
    [add],
  );
}
