// The dashboard's mark (apps/web/public/favicon.svg), drawn in the current
// primary colour so it follows light and dark mode.
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className}>
      <circle cx="10" cy="10" r="8.5" fill="none" stroke="var(--color-fd-primary)" strokeWidth="2" />
      <path d="M3.2 13.2 A8 8 0 0 0 16.8 13.2 Z" fill="var(--color-fd-primary)" />
    </svg>
  );
}
