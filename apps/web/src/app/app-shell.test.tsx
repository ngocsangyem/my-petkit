import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AppShell, type ShellNavGroup } from './app-shell';

const NAV: readonly ShellNavGroup[] = [
  {
    id: 'home',
    ariaLabel: 'Home',
    items: [
      { to: '/devices', label: 'Home', icon: 'home' },
      { to: '/timeline', label: 'Timeline', icon: 'timeline' },
    ],
  },
  {
    id: 'server',
    label: 'Server',
    items: [{ to: '/setup', label: 'Settings', icon: 'settings' }],
  },
  {
    id: 'advanced',
    label: 'Advanced · needs step-up',
    items: [{ to: '/patchers', label: 'Patchers', icon: 'patchers' }],
  },
];

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/devices']}>
      <AppShell
        navGroups={NAV}
        serverLine="Home server · v2.1.0"
        liveState="live"
        serverLabel="192.168.1.20:8443"
        badge="TLS"
      >
        <p>the page</p>
      </AppShell>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  it('names each nav group and marks the current page', () => {
    renderShell();
    const home = screen.getByRole('navigation', { name: 'Home' });
    expect(within(home).getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(home).getByRole('link', { name: 'Timeline' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(
      screen.getByRole('navigation', { name: 'Advanced · needs step-up' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('the page');
    expect(screen.getByRole('navigation', { name: 'Server' })).toBeInTheDocument();
  });

  it('shows the live state, the server address and the connection in the sidebar foot', () => {
    renderShell();
    const sidebar = screen.getByRole('complementary', { name: 'Main menu' });
    expect(within(sidebar).getByRole('status')).toHaveTextContent('Live');
    expect(within(sidebar).getByText('192.168.1.20:8443')).toBeInTheDocument();
    expect(within(sidebar).getByText('TLS')).toBeInTheDocument();
    expect(within(sidebar).getByText('Home server · v2.1.0')).toBeInTheDocument();
  });

  it('opens the phone menu as a modal sheet and closes it after a link is followed', async () => {
    const user = userEvent.setup();
    renderShell();
    const opener = screen.getByRole('button', { name: 'Open menu' });
    await user.click(opener);
    const menu = await screen.findByRole('dialog', { name: 'Menu' });
    expect(within(menu).getByRole('navigation', { name: 'Home' })).toBeInTheDocument();
    await user.click(within(menu).getByRole('link', { name: 'Timeline' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes the phone menu with its close button and returns focus to the opener', async () => {
    const user = userEvent.setup();
    renderShell();
    const opener = screen.getByRole('button', { name: 'Open menu' });
    await user.click(opener);
    const menu = await screen.findByRole('dialog', { name: 'Menu' });
    await user.click(within(menu).getByRole('button', { name: 'Close menu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
