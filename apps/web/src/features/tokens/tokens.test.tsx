import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { renderWithProviders } from '@/test/render';
import { countdown, groupFingerprint, qrPath } from './pairing-format';
import { TokensSection } from './tokens-page';

const SHA = '4f9a2c71b8e06d13a5c490f73e2b51d0'.repeat(2);

const INFO = {
  user_tls: { port: 8443, cert_sha256: SHA },
};

const TOKENS = [{ id: 3, name: 'iPhone 16', created_at: 1_761_000_000, last_used: 0 }];

function pairing() {
  const expires_at = Date.now() / 1000 + 300;
  return {
    code: 'k3Fq9-code',
    expires_at,
    expires_in: 300,
    qr: { url: 'https://192.168.1.20:8443', cert_sha256: SHA, code: 'k3Fq9-code' },
  };
}

describe('TokensSection', () => {
  it('lists client tokens with when they were last used', async () => {
    mockApi({
      'GET /api/info': { body: INFO },
      'GET /api/auth/tokens': { body: { tokens: TOKENS } },
    });
    renderWithProviders(<TokensSection />);
    const list = await screen.findByRole('list', { name: 'Client tokens' });
    expect(within(list).getByText('iPhone 16')).toBeInTheDocument();
    expect(within(list).getByText(/last used never/)).toBeInTheDocument();
    expect(await screen.findByText(groupFingerprint(SHA))).toBeInTheDocument();
  });

  it('says so when no phone is paired', async () => {
    mockApi({
      'GET /api/info': { body: INFO },
      'GET /api/auth/tokens': { body: { tokens: [] } },
    });
    renderWithProviders(<TokensSection />);
    expect(await screen.findByText('No phone is paired yet.')).toBeInTheDocument();
  });

  it('revokes a token after asking', async () => {
    const calls = mockApi({
      'GET /api/info': { body: INFO },
      'GET /api/auth/tokens': { body: { tokens: TOKENS } },
      'DELETE /api/auth/tokens/3': { body: { ok: true } },
    });
    const user = userEvent.setup();
    renderWithProviders(<TokensSection />);
    await user.click(await screen.findByRole('button', { name: 'Revoke' }));
    const dialog = screen.getByRole('dialog', { name: /Revoke “iPhone 16”/ });
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }));
    await waitFor(() => {
      expect(calls.some(c => c.method === 'DELETE' && c.url.endsWith('/api/auth/tokens/3'))).toBe(
        true,
      );
    });
  });

  it('creates a pairing code and shows its QR, server and fingerprint', async () => {
    const calls = mockApi({
      'GET /api/info': { body: INFO },
      'GET /api/auth/tokens': { body: { tokens: [] } },
      'POST /api/auth/pairing': { body: pairing() },
    });
    const user = userEvent.setup();
    renderWithProviders(<TokensSection />);
    await user.click(await screen.findByRole('button', { name: 'Pair a phone' }));
    expect(await screen.findByRole('img', { name: /QR code for pairing/ })).toBeInTheDocument();
    expect(screen.getByText('https://192.168.1.20:8443')).toBeInTheDocument();
    expect(screen.getByText('k3Fq9-code')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent(/Expires in (5:00|4:59)/);
    expect(calls.filter(c => c.method === 'POST')).toHaveLength(1);
  });

  it('keeps a refused pairing inside its block', async () => {
    mockApi({
      'GET /api/info': { body: INFO },
      'GET /api/auth/tokens': { body: { tokens: [] } },
      'POST /api/auth/pairing': {
        status: 503,
        body: { error: { code: 'unavailable', message: 'Auth is not set up.' } },
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<TokensSection />);
    await user.click(await screen.findByRole('button', { name: 'Pair a phone' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pairing code: Auth is not set up.',
    );
  });
});

describe('pairing format', () => {
  it('groups a fingerprint in fours, upper case', () => {
    expect(groupFingerprint('4f9a2c71b8e0')).toBe('4F9A 2C71 B8E0');
  });

  it('counts down to zero and never below', () => {
    expect(countdown(100, 40_000)).toBe('1:00');
    expect(countdown(100, 99_500)).toBe('0:01');
    expect(countdown(100, 200_000)).toBe('0:00');
  });

  it('draws one square per dark module', () => {
    const { size, path } = qrPath('{"code":"x"}');
    expect(size).toBeGreaterThanOrEqual(21);
    expect(path.startsWith('M0 0h1v1h-1z')).toBe(true);
  });
});
