import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { cn } from 'cn';
import { DrumMark } from '@/shared/ui/drum-mark';
import { Icon, type IconName } from '@/shared/ui/icons';
import {
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/ui/shadcn/sidebar';

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
  /** Visible group label, e.g. "Tools" or "Advanced · needs step-up"; also its accessible name. */
  label?: string;
  /** Accessible name when there is no visible label, e.g. "Sections". */
  ariaLabel?: string;
  items: readonly ShellNavItem[];
}

/** Props for {@link ShellNav}. */
export interface ShellNavProps {
  navGroups: readonly ShellNavGroup[];
  serverLine?: ReactNode;
  account?: ReactNode;
  /** Called after a link is followed, e.g. to close the phone menu. */
  onNavigate?: () => void;
  /** 44px touch rows in the phone menu; 32px rows in the sidebar. */
  touch?: boolean;
}

/**
 * The sidebar's contents, shared by the desktop sidebar and the phone menu sheet: the drum mark,
 * the server line, the nav groups (the current page is an `active` pill) and the account line.
 */
export function ShellNav({ navGroups, serverLine, account, onNavigate, touch }: ShellNavProps) {
  return (
    <>
      <div className="flex h-5 items-center gap-2.5 px-2">
        <DrumMark size={20} />
        <span className="text-[15px] font-semibold">my-petkit</span>
      </div>
      {serverLine && <div className="px-2 text-xs text-muted-foreground">{serverLine}</div>}
      {navGroups.map(group => (
        <nav
          key={group.id}
          className="flex flex-col gap-0.5"
          aria-label={group.label ?? group.ariaLabel ?? group.id}
        >
          {group.label && (
            <SidebarGroupLabel
              aria-hidden="true"
              className="h-auto rounded-none px-2 pt-0 pb-1 text-xs font-normal text-muted-foreground"
            >
              {group.label}
            </SidebarGroupLabel>
          )}
          <SidebarMenu className="gap-0.5">
            {group.items.map(item => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  render={<NavLink to={item.to} end={item.end} onClick={onNavigate} />}
                  className={cn(
                    'h-8 gap-2.5 px-2 py-0 text-base text-muted-foreground no-underline hover:bg-active hover:text-foreground active:bg-active active:text-foreground aria-[current=page]:bg-active aria-[current=page]:font-medium aria-[current=page]:text-foreground',
                    touch && 'h-11',
                  )}
                >
                  <Icon name={item.icon} size={16} />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </nav>
      ))}
      <div className="flex-1" />
      {account && (
        <div className="flex items-center gap-2.5 px-2 text-sm text-muted-foreground">
          {account}
        </div>
      )}
    </>
  );
}
