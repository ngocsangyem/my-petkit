import { useState, type ReactNode } from 'react';
import { Icon } from '@/shared/ui/icons';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/shared/ui/shadcn/sheet';
import { Sidebar, SidebarInset, SidebarProvider } from '@/shared/ui/shadcn/sidebar';
import { LiveIndicator, type LiveState } from '@/shared/ui/status-mark';
import { ShellNav, type ShellNavGroup } from './app-shell-nav';

export type { ShellNavGroup, ShellNavItem } from './app-shell-nav';

/** Props for {@link AppShell}. */
export interface AppShellProps {
  navGroups: readonly ShellNavGroup[];
  /** Muted line under the mark, e.g. "Home server · v2.1.0". */
  serverLine?: ReactNode;
  /** Bottom of the sidebar, e.g. "Signed in as admin" or a sign-out link. */
  account?: ReactNode;
  /** Top bar left slot, normally a 420px `SearchField` with `tone="frame"`. */
  search?: ReactNode;
  /** State of the live connection, shown as the Live dot. */
  liveState: LiveState;
  /** Server address in mono, e.g. "192.168.1.20:8443". */
  serverLabel?: string;
  /** Badge after the server, e.g. "TLS pinned". */
  badge?: ReactNode;
  /** Title in the phone bar (under 900px). */
  pageTitle: string;
  /** One 44px action at the right of the phone bar. */
  phoneAction?: ReactNode;
  /** The page; it sits on the white sheet. */
  children: ReactNode;
}

/** The 44px icon button of the phone bar and the menu sheet. */
const PHONE_BUTTON = 'flex size-11 items-center border-0 bg-transparent p-0 text-foreground';

/**
 * The tinted L-frame: a 228px sidebar and a 48px top bar on `ground`, with the page on a white
 * sheet inset 8px right and bottom (1px edge, radius 16, no shadow). At 900px and under the frame
 * folds into a 48px phone bar whose menu button opens a full-screen menu sheet.
 */
export function AppShell(props: AppShellProps) {
  const {
    navGroups,
    serverLine,
    account,
    search,
    liveState,
    serverLabel,
    badge,
    pageTitle,
    phoneAction,
    children,
  } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => {
    setMenuOpen(false);
  };

  return (
    <SidebarProvider className="min-h-screen bg-ground text-foreground">
      <a
        className="absolute top-2 left-2 z-[200] -translate-y-[200%] rounded-md bg-background px-2.5 py-1.5 text-foreground focus:translate-y-0"
        href="#main"
      >
        Skip to content
      </a>
      <aside className="hidden flex-none min-[901px]:flex">
        <Sidebar collapsible="none" className="h-auto gap-5 bg-ground px-3 pt-3.5 pb-4">
          <ShellNav navGroups={navGroups} serverLine={serverLine} account={account} />
        </Sidebar>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden h-(--pk-topbar-height) min-w-0 items-center justify-between gap-4 pr-4 min-[901px]:flex">
          <div className="min-w-0 flex-[0_1_420px]">{search}</div>
          <div className="flex flex-none items-center gap-4 text-sm text-muted-foreground">
            <LiveIndicator state={liveState} />
            {(serverLabel || badge) && (
              <span>
                {serverLabel && <span className="font-mono text-xs">{serverLabel}</span>}
                {serverLabel && badge && ' · '}
                {badge}
              </span>
            )}
          </div>
        </header>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <div className="flex h-(--pk-topbar-height) items-center justify-between bg-ground px-4 min-[901px]:hidden">
            <SheetTrigger
              render={<button type="button" className={PHONE_BUTTON} aria-label="Open menu" />}
            >
              <Icon name="menu" size={20} strokeWidth={2} />
            </SheetTrigger>
            <span className="min-w-0 truncate font-semibold">{pageTitle}</span>
            <span className="flex w-11 justify-end">{phoneAction}</span>
          </div>
          <SheetContent
            side="left"
            showCloseButton={false}
            aria-label="Menu"
            className="gap-5 overflow-y-auto bg-ground px-3 pt-0 pb-4 data-[side=left]:w-full data-[side=left]:border-r-0 data-[side=left]:sm:max-w-none"
          >
            <div className="flex h-(--pk-topbar-height) flex-none items-center px-1">
              <SheetClose
                render={<button type="button" className={PHONE_BUTTON} aria-label="Close menu" />}
              >
                <Icon name="close" size={20} strokeWidth={2} />
              </SheetClose>
            </div>
            <ShellNav
              navGroups={navGroups}
              serverLine={serverLine}
              account={account}
              onNavigate={close}
              touch
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-2 text-sm text-muted-foreground">
              <LiveIndicator state={liveState} />
              {serverLabel && <span className="font-mono text-xs">{serverLabel}</span>}
              {badge}
            </div>
          </SheetContent>
        </Sheet>

        <SidebarInset
          id="main"
          tabIndex={-1}
          className="w-auto min-w-0 gap-6 border-y border-border p-4 wrap-anywhere focus:outline-none min-[901px]:mr-(--pk-sheet-inset) min-[901px]:mb-(--pk-sheet-inset) min-[901px]:rounded-2xl min-[901px]:border min-[901px]:p-(--pk-pad) min-[901px]:wrap-normal"
        >
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
