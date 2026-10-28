import { useRef, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { DrumMark } from '../shared/ui/drum-mark';
import { Icon, type IconName } from '../shared/ui/icons';
import { LiveIndicator, type LiveState } from '../shared/ui/status-mark';
import { useModalFocus } from '../shared/ui/use-modal-focus';
import './app-shell.css';

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

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'shell-nav__link shell-nav__link--active' : 'shell-nav__link';
}

interface SidebarContentProps {
  navGroups: readonly ShellNavGroup[];
  serverLine?: ReactNode;
  account?: ReactNode;
  onNavigate?: () => void;
}

function SidebarContent({ navGroups, serverLine, account, onNavigate }: SidebarContentProps) {
  return (
    <>
      <div className="shell-brand">
        <DrumMark size={20} />
        <span className="shell-brand__name">my-petkit</span>
      </div>
      {serverLine && <div className="shell-server-line">{serverLine}</div>}
      {navGroups.map(group => (
        <nav
          key={group.id}
          className="shell-nav"
          aria-label={group.label ?? group.ariaLabel ?? group.id}
        >
          {group.label && (
            <span className="shell-nav__group" aria-hidden="true">
              {group.label}
            </span>
          )}
          {group.items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={navClass}
              onClick={onNavigate}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      ))}
      <div className="shell-spacer" />
      {account && <div className="shell-account">{account}</div>}
    </>
  );
}

/**
 * The tinted L-frame: a 228px sidebar and a 48px top bar on `ground`, with the page on a white
 * sheet inset 8px (1px edge, radius 16, no shadow). Under 900px the frame folds into a 48px phone
 * bar whose menu button opens a full-screen menu sheet.
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
  const menuRef = useRef<HTMLDivElement>(null);
  const close = () => {
    setMenuOpen(false);
  };
  useModalFocus(menuRef, { open: menuOpen, onEscape: close });

  return (
    <div className="shell">
      <a className="shell-skip" href="#main">
        Skip to content
      </a>
      <aside className="shell-side">
        <SidebarContent navGroups={navGroups} serverLine={serverLine} account={account} />
      </aside>

      <header className="shell-topbar">
        <div className="shell-topbar__search">{search}</div>
        <div className="shell-topbar__status">
          <LiveIndicator state={liveState} />
          {(serverLabel || badge) && (
            <span>
              {serverLabel && <span className="shell-topbar__server">{serverLabel}</span>}
              {serverLabel && badge && ' · '}
              {badge}
            </span>
          )}
        </div>
      </header>

      <div className="shell-phonebar">
        <button
          type="button"
          className="shell-phonebar__button"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          onClick={() => {
            setMenuOpen(true);
          }}
        >
          <Icon name="menu" size={20} strokeWidth={2} />
        </button>
        <span className="shell-phonebar__title">{pageTitle}</span>
        <span className="shell-phonebar__action">{phoneAction}</span>
      </div>

      <main id="main" className="shell-sheet" tabIndex={-1}>
        {children}
      </main>

      {menuOpen && (
        <div ref={menuRef} className="shell-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="shell-menu__bar">
            <button
              type="button"
              className="shell-phonebar__button"
              aria-label="Close menu"
              onClick={close}
            >
              <Icon name="close" size={20} strokeWidth={2} />
            </button>
          </div>
          <SidebarContent
            navGroups={navGroups}
            serverLine={serverLine}
            account={account}
            onNavigate={close}
          />
          <div className="shell-menu__status">
            <LiveIndicator state={liveState} />
            {serverLabel && <span className="shell-topbar__server">{serverLabel}</span>}
            {badge}
          </div>
        </div>
      )}
    </div>
  );
}
