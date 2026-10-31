import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { DrumMark } from '@/shared/ui/drum-mark';
import { Icon, type IconName } from '@/shared/ui/icons';
import {
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/ui/shadcn/sidebar';
import { LiveIndicator, type LiveState } from '@/shared/ui/status-mark';

/** One destination in the sidebar. */
export interface ShellNavItem {
  to: string;
  label: string;
  icon: IconName;
  /** Match the path exactly (for an index route). */
  end?: boolean;
}

/** A group of destinations; the first group (Home) has no visible label. */
export interface ShellNavGroup {
  id: string;
  /** Visible group label, e.g. "Server" or "Advanced · needs step-up"; also its accessible name. */
  label?: string;
  /** Accessible name when there is no visible label, e.g. "Home". */
  ariaLabel?: string;
  items: readonly ShellNavItem[];
}

/** The product mark and name, at the top of the sidebar and in the phone bar. */
export function ShellBrand() {
  return (
    <span className="inline-flex items-center gap-2.5 px-2 text-lg font-semibold">
      <DrumMark size={18} />
      my-petkit
    </span>
  );
}

/** Props for {@link ShellNav}. */
export interface ShellNavProps {
  navGroups: readonly ShellNavGroup[];
  /** Called after a link is followed, e.g. to close the phone menu. */
  onNavigate?: () => void;
}

/**
 * The nav groups, shared by the desktop sidebar and the phone menu sheet: 40px pill items with an
 * 18px muted icon; the current page is a white pill in 600 with an ink icon.
 */
export function ShellNav({ navGroups, onNavigate }: ShellNavProps) {
  return (
    <div className="flex flex-col gap-2">
      {navGroups.map(group => (
        <nav
          key={group.id}
          className="flex flex-col gap-0.5"
          aria-label={group.label ?? group.ariaLabel ?? group.id}
        >
          {group.label && (
            <SidebarGroupLabel
              aria-hidden="true"
              className="h-auto rounded-none px-3 pt-2.5 pb-1.5 text-xs font-normal text-muted-foreground"
            >
              {group.label}
            </SidebarGroupLabel>
          )}
          <SidebarMenu className="gap-0.5">
            {group.items.map(item => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  render={<NavLink to={item.to} end={item.end} onClick={onNavigate} />}
                  className="group/nav h-10 gap-2.5 rounded-full px-3 py-0 text-base text-foreground no-underline hover:bg-background/60 hover:text-foreground active:bg-background/60 aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-semibold [&_svg]:size-[18px]"
                >
                  <span className="flex text-muted-foreground group-aria-[current=page]/nav:text-foreground">
                    <Icon name={item.icon} size={18} />
                  </span>
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </nav>
      ))}
    </div>
  );
}

/** Props for {@link ShellFoot}. */
export interface ShellFootProps {
  liveState: LiveState;
  /** Server address in mono, e.g. "192.168.1.20:8443". */
  serverLabel?: string;
  /** What is true about the connection, e.g. "TLS" or "Not encrypted". */
  badge?: ReactNode;
  /** Account controls under the connection, e.g. Sign out. */
  account?: ReactNode;
}

/** The sidebar foot: a raised panel with the Live dot, the server address and the connection. */
export function ShellFoot({ liveState, serverLabel, badge, account }: ShellFootProps) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-raised p-3 [--pk-fill-secondary:var(--pk-surface)]">
      <LiveIndicator state={liveState} className="text-sm text-foreground" />
      {serverLabel && (
        <span className="font-mono text-xs break-all text-muted-foreground">{serverLabel}</span>
      )}
      {badge && <span className="text-xs text-muted-foreground">{badge}</span>}
      {account && <div className="pt-2">{account}</div>}
    </div>
  );
}
