import { createElement } from 'react';
import {
  Bluetooth,
  BrushCleaning,
  Calendar,
  Camera,
  Captions,
  Cat,
  ChartNoAxesGantt,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleMinus,
  Cloud,
  Copy,
  Download,
  Droplet,
  Ellipsis,
  ExternalLink,
  File,
  House,
  KeyRound,
  Leaf,
  Lightbulb,
  Lock,
  Maximize,
  Menu,
  Minus,
  Moon,
  Pause,
  Pencil,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Scale,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Smartphone,
  Sun,
  SunDim,
  TextAlignStart,
  Trash2,
  TriangleAlert,
  Upload,
  Video,
  Waves,
  Wifi,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';

/**
 * Each artboard glyph (docs/design/tools/ios-v3/build_artboards.py ICONS, web-v3 additions)
 * mapped to the closest lucide glyph. The older names (`devices`, `setup`, `capture`, `patchers`)
 * stay for existing callers.
 */
const ICON_TABLE = {
  // Navigation
  home: House,
  devices: CircleMinus,
  timeline: ChartNoAxesGantt,
  pets: Cat,
  provision: Bluetooth,
  log: TextAlignStart,
  settings: Settings,
  setup: SunDim,
  capture: Captions,
  file: File,
  patchers: Pencil,
  wrench: Wrench,
  // Controls
  search: Search,
  menu: Menu,
  plus: Plus,
  minus: Minus,
  close: X,
  chevron: ChevronDown,
  back: ChevronLeft,
  forward: ChevronRight,
  check: Check,
  more: Ellipsis,
  refresh: RefreshCw,
  copy: Copy,
  external: ExternalLink,
  download: Download,
  upload: Upload,
  trash: Trash2,
  edit: Pencil,
  // Status and notices
  warning: TriangleAlert,
  lock: Lock,
  shield: Shield,
  cloud: Cloud,
  wifi: Wifi,
  key: KeyRound,
  phone: Smartphone,
  qr: QrCode,
  // Device actions and media
  clean: BrushCleaning,
  bag: ShoppingBag,
  level: Waves,
  leaf: Leaf,
  light: Lightbulb,
  drop: Droplet,
  scale: Scale,
  calendar: Calendar,
  play: Play,
  pause: Pause,
  video: Video,
  camera: Camera,
  fullscreen: Maximize,
  sun: Sun,
  moon: Moon,
} satisfies Record<string, LucideIcon>;

/** Names of the line icons the artboards use. */
export type IconName = keyof typeof ICON_TABLE;

const ICONS = new Map<IconName, LucideIcon>(Object.entries(ICON_TABLE) as [IconName, LucideIcon][]);

/** Props for {@link Icon}. */
export interface IconProps {
  name: IconName;
  /** Rendered size in px; 18 for nav, 16 in buttons and notices, 20 on the phone bar. */
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
