import type { ReactNode } from 'react';

/**
 * A field of the sign-in card: a muted 13px label set in by 4px, above a 44px field, the way the
 * step-up dialog labels its password.
 */
export function AuthField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="ml-1 text-sm text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
