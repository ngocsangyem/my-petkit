import type { ReactNode } from 'react';

/** The signed-out page: one centred column on `ground`, used by sign-in, loading and errors. */
export function AuthPage({ busy, children }: { busy?: boolean; children: ReactNode }) {
  return (
    <main
      className="grid min-h-screen place-items-center bg-ground p-(--pk-pad)"
      aria-busy={busy || undefined}
    >
      {children}
    </main>
  );
}
