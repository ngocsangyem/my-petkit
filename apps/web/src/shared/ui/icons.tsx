import { createElement } from 'react';
import {
  Bluetooth,
  Captions,
  Cat,
  ChartNoAxesGantt,
  ChevronDown,
  CircleMinus,
  Menu,
  Pencil,
  Plus,
  Search,
  SunDim,
  TextAlignStart,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';

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

/**
 * Each artboard icon mapped to the closest lucide glyph: the drum (a ring cut by a line) is
 * `CircleMinus`, provisioning is Bluetooth, the setup sun is `SunDim`, capture is a framed page.
 */
const ICONS = new Map<IconName, LucideIcon>(
  Object.entries({
    devices: CircleMinus,
    timeline: ChartNoAxesGantt,
    pets: Cat,
    provision: Bluetooth,
    log: TextAlignStart,
    setup: SunDim,
    capture: Captions,
    patchers: Pencil,
    search: Search,
    menu: Menu,
    plus: Plus,
    close: X,
    chevron: ChevronDown,
    warning: TriangleAlert,
  } satisfies Record<IconName, LucideIcon>) as [IconName, LucideIcon][],
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
  // createElement with a glyph looked up from a static table: no component is created per render.
  return createElement(ICONS.get(name) ?? CircleMinus, {
    size,
    strokeWidth,
    'aria-hidden': true,
    focusable: false,
    className,
  });
}
