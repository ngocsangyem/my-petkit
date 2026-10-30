import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { renderWithProviders } from '@/test/render';
import { SetupPage } from './setup-page';
import type { RetentionCaps } from './retention-and-blocked-model';
import type { LiveSettings, ServerInfo } from './setup-model';
import { summariseUpstream, validDns, withEdit } from './setup-model';

const SETTINGS: LiveSettings = {
  proxy_mode: false,
  proxy_upstream: '',
  proxy_dns: '',
  proxy_block_run_cmd: true,
  proxy_block_ota: true,
  proxy_block_log_upload: true,
  proxy_media_real_oss: false,
  proxy_local_cvr_window: false,
  proxy_mqtt_bridge: true,
  proxy_only: '',
  capture: false,
};

function info(settings: Partial<LiveSettings> = {}, extra: Partial<ServerInfo> = {}): ServerInfo {
  return {
    asset_version: 'abc',
    version: '2.1.0',
    web_entry: null,
    api_url: 'http://192.168.1.20/6/',
    mqtt_tls: true,
    mqtt_tls_port: 8883,
    mqtt_port: 1883,
    strict_auth: false,
    cert_exists: true,
    user_tls: { port: 8443, cert_sha256: 'ab'.repeat(32) },
    ha_publishing: true,
    ha_enabled: true,
    device_count: 2,
    settings: { ...SETTINGS, ...settings },
    settings_writable: true,
    capture: false,
    ai_device_names: [],
    upstreams: [
      { key: 'petkit-eu', url: 'https://api.eu-pet.com/6/', default: true },
      { key: 'petkit-asia', url: 'https://api.petktasia.com/latest/', default: false },
    ],
    redactions: {},
    upstream: {},
    ...extra,
  };
}

const cap = (mb: number | null, days: number | null) => ({ max_mb: mb, max_days: days });
const RETENTION: RetentionCaps = {
  fullVideo: cap(2000, 30),
  eventImage: cap(null, null),
  highLight: cap(null, null),
  dynamicVideo: cap(null, null),
  cloudDouble: cap(null, null),
  wasteCheck: cap(null, null),
  healthPic: cap(null, null),
  events: { max_days: 365 },
  blocked: { max_days: 90 },
  deviceLog: cap(null, null),
  rawUpload: cap(null, 1),
  thumbnail: cap(500, null),
};

const BLOCKED_ROW = {
  id: 7,
  device_id: 123,
  kind: 'ota',
  transport: 'http' as const,
  endpoint: '/6/ota/check',
  payload_json: '{"url… (88 chars)',
  upstream: 'petkit-eu',
  field_path: 'result.url',
  detail_json: null,
  created_at: 1_761_000_000,
};

function routes(i: ServerInfo, blocked: unknown[] = []) {
  return {
    'GET /api/info': { body: i },
    'GET /api/retention': { body: { retention: RETENTION } },
    'GET /api/blocked': { body: { records: blocked, counts: {} } },
  };
}

describe('SetupPage', () => {
  it('shows the guards inactive while the proxy is off, and the finding line', async () => {
    mockApi(routes(info()));
    renderWithProviders(<SetupPage />);
    expect(await screen.findByText(/Cloud guards are on/)).toBeInTheDocument();
    expect(screen.getByText(/Proxying to PetKit’s cloud is off/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Block remote shell commands' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: "Proxy to PetKit's cloud" })).toBeEnabled();
    expect(screen.getByRole('switch', { name: 'Save traffic' })).toBeEnabled();
    // No blocked rows: the section is absent rather than saying so.
    expect(screen.queryByRole('heading', { name: 'Blocked attempts' })).not.toBeInTheDocument();
  });

  it('asks before turning a guard off, then saves the batch in one request', async () => {
    const calls = mockApi({
      ...routes(info({ proxy_mode: true })),
      'POST /api/settings': {
        body: {
          ok: true,
          changed: { proxy_block_ota: false, proxy_dns: '1.1.1.1' },
          settings: { ...SETTINGS, proxy_mode: true, proxy_block_ota: false },
        },
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<SetupPage />);

    await user.click(await screen.findByRole('switch', { name: 'Block firmware updates' }));
    const dialog = screen.getByRole('alertdialog', { name: /Turn off “Block firmware updates”/ });
    await user.click(within(dialog).getByRole('button', { name: 'Turn off' }));
    expect(screen.getByRole('switch', { name: 'Block firmware updates' })).not.toBeChecked();

    await user.type(screen.getByRole('textbox', { name: 'Upstream resolver' }), '1.1.1.1');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => {
      expect(calls.some(c => c.method === 'POST')).toBe(true);
    });
    const post = calls.find(c => c.method === 'POST');
    expect(await post?.json()).toEqual({ proxy_block_ota: false, proxy_dns: '1.1.1.1' });
    expect(await screen.findByText('Saved 2 settings.')).toBeInTheDocument();
  });

  it('keeps the guard on when the question is cancelled', async () => {
    mockApi(routes(info({ proxy_mode: true })));
    const user = userEvent.setup();
    renderWithProviders(<SetupPage />);
    await user.click(await screen.findByRole('switch', { name: 'Block remote shell commands' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('switch', { name: 'Block remote shell commands' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Save settings' })).not.toBeInTheDocument();
  });

  it('says nothing was saved when the server refuses the batch', async () => {
    mockApi({
      ...routes(info()),
      'POST /api/settings': { status: 400, body: { error: 'bad value for proxy_upstream' } },
    });
    const user = userEvent.setup();
    renderWithProviders(<SetupPage />);
    await user.click(await screen.findByRole('switch', { name: 'Save traffic' }));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(
      await screen.findByText(/Nothing was saved: bad value for proxy_upstream/),
    ).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Save traffic' })).toBeChecked();
  });

  it('refuses a hostname as the upstream resolver before saving', async () => {
    mockApi(routes(info({ proxy_mode: true })));
    const user = userEvent.setup();
    renderWithProviders(<SetupPage />);
    await user.type(await screen.findByRole('textbox', { name: 'Upstream resolver' }), 'dns.local');
    expect(screen.getByText(/must be an IPv4 address/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  });

  it('saves every retention category, leaving the staged uploads alone', async () => {
    const calls = mockApi({
      ...routes(info()),
      'POST /api/retention': { body: { ok: true, retention: RETENTION } },
    });
    const user = userEvent.setup();
    renderWithProviders(<SetupPage />);
    const days = await screen.findByRole('spinbutton', { name: 'Recordings, max age in days' });
    await user.clear(days);
    await user.type(days, '14');
    await user.click(screen.getByRole('button', { name: 'Save retention' }));
    expect(await screen.findByText('Retention saved.')).toBeInTheDocument();
    const body = (await calls.find(c => c.method === 'POST')?.json()) as Record<string, unknown>;
    expect(body.fullVideo).toEqual({ max_mb: 2000, max_days: 14 });
    expect(body.events).toEqual({ max_days: 365 });
    expect(body.blocked).toEqual({ max_days: 90 });
    expect(body).not.toHaveProperty('rawUpload');
    expect(Object.keys(body)).toHaveLength(11);
  });

  it('lists blocked attempts masked and asks the server to reveal them', async () => {
    const calls = mockApi(routes(info(), [BLOCKED_ROW]));
    const user = userEvent.setup();
    renderWithProviders(<SetupPage />);
    expect(await screen.findByRole('heading', { name: 'Blocked attempts' })).toBeInTheDocument();
    expect(screen.getByText('Firmware push')).toBeInTheDocument();
    expect(screen.getByText('{"url… (88 chars)')).toBeInTheDocument();
    expect(screen.getByText(/1 blocked attempt is on record/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reveal payloads' }));
    await waitFor(() => {
      expect(calls.some(c => new URL(c.url).searchParams.get('reveal') === '1')).toBe(true);
    });
  });

  it(
    'shows the connection facts and keeps an info failure inside its block',
    { timeout: 10_000 },
    async () => {
      mockApi({ 'GET /api/info': { status: 500, body: { error: 'boom' } } });
      renderWithProviders(<SetupPage />);
      // The info probe retries twice (a restart may be in progress) before failing.
      expect(await screen.findByRole('alert', {}, { timeout: 6000 })).toHaveTextContent(
        /settings could not be loaded/,
      );
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    },
  );
});

describe('setup model', () => {
  it('validates the resolver like the server', () => {
    expect(validDns('')).toBe(true);
    expect(validDns('1.1.1.1')).toBe(true);
    expect(validDns('1.1.1.1:53')).toBe(true);
    expect(validDns('1.1.1.1:0')).toBe(false);
    expect(validDns('256.1.1.1')).toBe(false);
    expect(validDns('dns.google')).toBe(false);
  });

  it('drops an edit that returns to the saved value, the default upstream included', () => {
    const d1 = withEdit({}, SETTINGS, 'capture', true, 'petkit-eu');
    expect(d1).toEqual({ capture: true });
    expect(withEdit(d1, SETTINGS, 'capture', false, 'petkit-eu')).toEqual({});
    expect(withEdit({}, SETTINGS, 'proxy_upstream', 'petkit-eu', 'petkit-eu')).toEqual({});
  });

  it('summarises proxied-call counters', () => {
    expect(summariseUpstream({ ok: 3, error_401: 2, http_502: 1 })).toEqual({
      total: 6,
      ok: 3,
      refused: [{ code: '401', count: 2 }],
      failed: [{ status: '502', count: 1 }],
    });
  });
});
