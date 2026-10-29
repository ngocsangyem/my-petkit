import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { api } from '@/shared/api/client';
import { mockApi } from '@/test/mock-api';
import { AuthGate } from './auth-gate';

const info = { version: '1.0.0', web_entry: null };
const unauthorized = { status: 401, body: { error: { code: 'unauthorized', message: 'No.' } } };

function renderGate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AuthGate>
        <p>the app</p>
      </AuthGate>
    </QueryClientProvider>,
  );
}

describe('AuthGate', () => {
  it('shows the sign-in screen, without a request storm, once a signed-in session ends', async () => {
    let signedIn = true;
    const calls = mockApi({
      'GET /api/info': () => (signedIn ? { body: info } : unauthorized),
      'GET /api/devices': unauthorized,
    });
    renderGate();
    expect(await screen.findByText('the app')).toBeInTheDocument();
    signedIn = false;
    await api.GET('/api/devices'); // any route answering 401 ends the session
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    const probes = calls.filter(c => c.url.endsWith('/api/info')).length;
    await new Promise(r => setTimeout(r, 200));
    expect(calls.filter(c => c.url.endsWith('/api/info')).length).toBe(probes);
    expect(probes).toBeLessThanOrEqual(3);
  });

  it('keeps the app mounted when a background check of the server fails', async () => {
    let up = true;
    mockApi({
      'GET /api/info': () => (up ? { body: info } : { status: 502, body: { error: 'down' } }),
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AuthGate>
          <p>the app</p>
        </AuthGate>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('the app')).toBeInTheDocument();
    up = false;
    await client.refetchQueries({ queryKey: ['info'] });
    await waitFor(() => {
      expect(client.getQueryState(['info'])?.status).toBe('error');
    });
    expect(screen.getByText('the app')).toBeInTheDocument();
  });
});
