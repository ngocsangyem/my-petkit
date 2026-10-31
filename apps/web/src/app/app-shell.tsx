import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/shared/ui/icons';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/shared/ui/shadcn/sheet';
import { Sidebar, SidebarInset, SidebarProvider } from '@/shared/ui/shadcn/sidebar';
import type { LiveState } from '@/shared/ui/status-mark';
import { ShellBrand, ShellFoot, ShellNav, type ShellNavGroup } from './app-shell-nav';

export type { ShellNavGroup, ShellNavItem } from './app-shell-nav';

/** Props for {@link AppShell}. */
export interface AppShellProps {
  navGroups: readonly ShellNavGroup[];
  /** Muted line under the mark, e.g. "Home server · v2.1.0". */
  serverLine?: ReactNode;
  /** Account controls in the sidebar foot, e.g. Sign out. */
  account?: ReactNode;
  /** State of the live connection, shown as the Live dot in the sidebar foot. */
  liveState: LiveState;
  /** Server address in mono, e.g. "192.168.1.20:8443". */
  serverLabel?: string;
  /** What is true about the connection, under the address, e.g. "TLS". */
  badge?: ReactNode;
  /** The page; it sits on the ground, in white cards of its own. */
  children: ReactNode;
}

/** The 44px round white button of the phone bar and the menu sheet. */
const PHONE_BUTTON =
  'flex size-11 flex-none items-center justify-center rounded-full border-0 bg-background p-0 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/**
 * The web v3 frame: a 248px sidebar on `ground` with the mark, the server line, the pill nav
 * groups and a foot panel with the Live dot, address and connection. The page sits on the same
 * ground (max 1180px wide) and brings its own white cards. At 900px and under the sidebar folds
 * into a top bar with the mark and a menu button that opens the nav in a sheet.
 */
export function AppShell(props: AppShellProps) {
  const { navGroups, serverLine, account, liveState, serverLabel, badge, children } = props;
  const { t } = useTranslation('app');
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => {
    setMenuOpen(false);
  };
  const foot = (
    <ShellFoot liveState={liveState} serverLabel={serverLabel} badge={badge} account={account} />
  );
  const head = (
    <div className="flex flex-col gap-1">
      <ShellBrand />
      {serverLine && <div className="px-2 text-xs text-muted-foreground">{serverLine}</div>}
    </div>
  );

  return (
    <SidebarProvider className="min-h-screen bg-ground text-foreground">
      <a
        className="absolute top-2 left-2 z-[200] -translate-y-[200%] rounded-full bg-background px-3 py-1.5 text-foreground focus:translate-y-0"
        href="#main"
      >
        {t('shell.skipToContent')}
      </a>
      <aside
        className="sticky top-0 hidden h-svh flex-none min-[901px]:flex"
        aria-label={t('shell.mainMenu')}
      >
        <Sidebar
          collapsible="none"
          className="h-full gap-[18px] overflow-y-auto bg-ground px-4 py-6"
        >
          {head}
          <ShellNav navGroups={navGroups} />
          <div className="mt-auto">{foot}</div>
        </Sidebar>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <header className="flex items-center justify-between px-4 pt-3 min-[901px]:hidden">
            <ShellBrand />
            <SheetTrigger
              render={
                <button type="button" className={PHONE_BUTTON} aria-label={t('shell.openMenu')} />
              }
            >
              <Icon name="menu" size={20} strokeWidth={2} />
            </SheetTrigger>
          </header>
          <SheetContent
            side="left"
            showCloseButton={false}
            aria-label={t('shell.menu')}
            className="gap-[18px] overflow-y-auto bg-ground px-4 pt-3 pb-6 data-[side=left]:w-full data-[side=left]:rounded-none data-[side=left]:sm:max-w-none"
          >
            <div className="flex flex-none items-center justify-between">
              {head}
              <SheetClose
                render={
                  <button
                    type="button"
                    className={PHONE_BUTTON}
                    aria-label={t('shell.closeMenu')}
                  />
                }
              >
                <Icon name="close" size={20} strokeWidth={2} />
              </SheetClose>
            </div>
            <ShellNav navGroups={navGroups} onNavigate={close} />
            {foot}
          </SheetContent>
        </Sheet>

        <SidebarInset
          id="main"
          tabIndex={-1}
          className="w-auto min-w-0 bg-transparent px-4 pt-3 pb-10 wrap-anywhere focus:outline-none min-[901px]:px-9 min-[901px]:pt-7 min-[901px]:pb-14 min-[901px]:wrap-normal"
        >
          <div className="flex w-full max-w-(--pk-content-max) flex-col gap-5">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
