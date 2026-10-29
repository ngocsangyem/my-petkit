import type { ReactElement } from 'react';

/** Names of the 16px line icons the artboards use. */
export type IconName =
  | 'devices'
  | 'timeline'
  | 'pets'
  | 'provision'
  | 'log'
  | 'setup'
  | 'capture'
  | 'patchers'
  | 'search'
  | 'menu'
  | 'plus'
  | 'close'
  | 'chevron'
  | 'warning';

const PATHS = new Map<IconName, ReactElement>(
  Object.entries({
    devices: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M5 15h14" />
      </>
    ),
    timeline: <path d="M4 12h16M8 8v8M14 6v12" />,
    pets: (
      <>
        <circle cx="12" cy="13" r="6" />
        <path d="M7 8 6 3l4 3M17 8l1-5-4 3" />
      </>
    ),
    provision: <path d="m7 7 10 10-5 5V2l5 5L7 17" />,
    log: <path d="M4 6h16M4 12h10M4 18h13" />,
    setup: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      </>
    ),
    capture: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 10h8M8 14h5" />
      </>
    ),
    patchers: <path d="M14 4l6 6-10 10H4v-6z" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    warning: (
      <>
        <path d="M12 3 2 21h20L12 3z" />
        <path d="M12 10v5" />
        <path d="M12 18h.01" />
      </>
    ),
  } satisfies Record<IconName, ReactElement>) as [IconName, ReactElement][],
);

/** Props for {@link Icon}. */
export interface IconProps {
  name: IconName;
  /** Rendered size in px; 16 for nav and notices, 14 in fields, 20 on the phone bar. */
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/** Decorative line icon drawn in `currentColor`; always hidden from assistive tech. */
export function Icon({ name, size = 16, strokeWidth = 1.8, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {PATHS.get(name)}
    </svg>
  );
}
