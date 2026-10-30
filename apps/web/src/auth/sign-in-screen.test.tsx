import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { renderWithProviders } from '@/test/render';
import { SignInScreen } from './sign-in-screen';

describe('SignInScreen', () => {
  it('signs in with the admin password only', async () => {
    const calls = mockApi({ 'POST /api/auth/login': { body: { ok: true } } });
    const user = userEvent.setup();
    renderWithProviders(<SignInScreen />);
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Sign in' });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText('Admin password'), 'correct horse');
    await user.click(submit);
    const login = calls.find(r => r.url.endsWith('/api/auth/login'));
    expect(await login?.json()).toEqual({ password: 'correct horse' });
  });

  it('turns into first run when the server has no admin yet', async () => {
    mockApi({
      'POST /api/auth/login': {
        status: 409,
        body: { error: { code: 'setup_required', message: 'No admin yet.' } },
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<SignInScreen />);
    await user.type(screen.getByLabelText('Admin password'), 'anything-at-all');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Set up your server' })).toBeInTheDocument();
    expect(screen.getByText(/Restart the server for a new one/)).toBeInTheDocument();
  });

  it('refuses two different passwords before asking the server', async () => {
    const calls = mockApi({});
    const user = userEvent.setup();
    renderWithProviders(<SignInScreen />);
    await user.click(screen.getByRole('button', { name: 'Set up the admin' }));
    await user.type(screen.getByLabelText('Setup code'), 'code-from-log');
    await user.type(screen.getByLabelText('Admin password'), 'short');
    expect(screen.getByText('At least 10 characters')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Admin password'), '-but-longer');
    expect(screen.getByText('Long enough')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Repeat the password'), 'something else');
    await user.click(screen.getByRole('button', { name: 'Create admin' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The two passwords are different.');
    expect(calls).toHaveLength(0);
  });

  it('creates the admin with the setup code and the password', async () => {
    const calls = mockApi({ 'POST /api/auth/setup': { body: { ok: true } } });
    const user = userEvent.setup();
    renderWithProviders(<SignInScreen />);
    await user.click(screen.getByRole('button', { name: 'Set up the admin' }));
    await user.type(screen.getByLabelText('Setup code'), 'code-from-log');
    await user.type(screen.getByLabelText('Admin password'), 'long-enough-pw');
    await user.type(screen.getByLabelText('Repeat the password'), 'long-enough-pw');
    await user.click(screen.getByRole('button', { name: 'Create admin' }));
    const setup = calls.find(r => r.url.endsWith('/api/auth/setup'));
    expect(await setup?.json()).toEqual({
      password: 'long-enough-pw',
      setup_token: 'code-from-log',
    });
  });
});
