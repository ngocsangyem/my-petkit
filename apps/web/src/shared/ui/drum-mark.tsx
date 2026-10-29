/** Props for {@link DrumMark}. */
export interface DrumMarkProps {
  /** Rendered size in px (20 in the shell, 56 on the design sheet). */
  size?: number;
  /** Accessible name; omit when a visible product name sits beside the mark. */
  title?: string;
}

/** The litter-box drum: a ring in accent with its lower third filled. */
export function DrumMark({ size = 20, title }: DrumMarkProps) {
  return (
    <svg
      className="flex-none"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <circle
        className="fill-none stroke-data"
        cx="10"
        cy="10"
        r="8.5"
        strokeWidth={size > 32 ? 1.6 : 2}
      />
      <path className="fill-data" d="M3.2 13.2 A8 8 0 0 0 16.8 13.2 Z" />
    </svg>
  );
}
