import { createContext, type ReactNode, useContext, useState, useSyncExternalStore } from 'react';

/**
 * Values typed into a control but not yet sent, keyed "<kind>:<id>:<key>".
 *
 * Panels refresh from the device's own state on every hub event. A control
 * bound straight to that state would replace what someone is typing, and so
 * would a panel that was collapsed and opened again. Held here instead, above
 * the panels, so a refresh re-renders the edit rather than discarding it.
 * Cleared once the value is accepted, or when it matches the device again.
 */
class PendingEdits {
  private readonly values = new Map<string, unknown>();
  private readonly listeners = new Set<() => void>();

  get(key: string): unknown {
    return this.values.get(key);
  }

  set(key: string, value: unknown): void {
    if (value === undefined) this.values.delete(key);
    else this.values.set(key, value);
    for (const l of this.listeners) l();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

const Context = createContext<PendingEdits | null>(null);

export function PendingEditsProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new PendingEdits());
  return <Context.Provider value={store}>{children}</Context.Provider>;
}

/**
 * The unsent edit for `key` and a setter. Setting the device's current value
 * clears it, so an edit typed back to what the device says stops being
 * "unsaved". An empty field is kept as an edit: for a timezone it means "auto".
 */
export function usePendingEdit(
  key: string,
  deviceValue: string,
): [string | undefined, (value: string | undefined) => void] {
  const store = useContext(Context);
  if (!store) throw new Error('usePendingEdit needs a PendingEditsProvider');
  const value = useSyncExternalStore(store.subscribe, () => store.get(key) as string | undefined);
  const set = (next: string | undefined) => {
    store.set(key, next === deviceValue ? undefined : next);
  };
  // An edit the device has since caught up with is no longer unsaved.
  return [value === deviceValue ? undefined : value, set];
}

/**
 * A structured working copy held the same way, e.g. a schedule being edited:
 * it outlives leaving the page and coming back, until it is saved or dropped.
 * Replace the value rather than mutating it, so the store notices the change.
 */
export function usePendingDraft<T>(key: string): [T | undefined, (value: T | undefined) => void] {
  const store = useContext(Context);
  if (!store) throw new Error('usePendingDraft needs a PendingEditsProvider');
  const value = useSyncExternalStore(store.subscribe, () => store.get(key) as T | undefined);
  return [
    value,
    next => {
      store.set(key, next);
    },
  ];
}
