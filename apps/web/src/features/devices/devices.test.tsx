import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, type MockReply } from '@/test/mock-api';
import { renderWithProviders } from '@/test/render';
import {
  accessory,
  feederDetail,
  feederSummary,
  litterDetail,
  litterSummary,
  noLitterAutomation,
  NOW,
  timeline,
} from './devices-fixtures';
import { DevicesPage } from './index';

const visitAt = Date.UTC(2026, 9, 28, 1, 12) / 1000; // 08:12 in UTC+7

function routes(extra: Record<string, MockReply> = {}): Record<string, MockReply> {
  return {
    'GET /api/devices': { body: [litterSummary, feederSummary] },
    'GET /api/ble': { body: { accessories: [accessory] } },
    [`GET /api/devices/${litterSummary.id}`]: { body: litterDetail },
    [`GET /api/devices/${feederSummary.id}`]: { body: feederDetail },
    [`GET /api/devices/${litterSummary.id}/litter-automation`]: { body: noLitterAutomation },
    'GET /api/pets': {
      body: {
        pets: [
          {
            id: 1,
            name: 'Miso',
            device_ids_json: null,
            device_pet_ids_json: null,
            face_id: null,
            photo_path: null,
            weight: null,
            created_at: 0,
            faces: [],
          },
        ],
      },
    },
    'GET /api/timeline': request => {
      const date = new URL(request.url).searchParams.get('date');
      if (date) return { body: timeline(date) };
      return {
        body: timeline('2026-10-28', [
          {
            kind: 'visit',
            id: 1,
            related_event: 'e1',
            device_id: litterSummary.id,
            device_name: 'Purobot Ultra T6',
            ts: visitAt,
            display_ts: visitAt,
            pet_id: 1,
            event_type: 10,
            pet_name: 'Miso',
            pet_photo_url: null,
            label: null,
            event_kind: 'toilet_visit',
            duration_sec: 130,
            weight: 5410,
            bits: [],
            sub_events: [],
            media: {
              highlight_url: null,
              playback_url: null,
              preview_url: null,
              poster_url: null,
              waste: [],
              health: [],
              snapshot_url: null,
              video_pending: false,
            },
          },
        ]),
      };
    },
    ...extra,
  };
}

async function openLitterPanel() {
  renderWithProviders(<DevicesPage />);
  return screen.findByRole('region', { name: 'Purobot Ultra T6' });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW * 1000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DevicesPage', () => {
  it('lists devices with status, now and needs-you, accessories after their parent', async () => {
    mockApi(routes());
    renderWithProviders(<DevicesPage />);
    const table = await screen.findByRole('table', { name: 'All devices' });
    const rows = within(table).getAllByRole('row');
    expect(rows.map(r => r.textContent)).toEqual([
      expect.stringContaining('Device'),
      expect.stringContaining('Online · MQTT'),
      expect.stringContaining('EverSweet Max Cordless'),
      expect.stringContaining('Polling · heartbeat'),
    ]);
    await waitFor(() => {
      expect(within(table).getByText('N60 deodorizer in 3 days')).toBeInTheDocument();
    });
    expect(within(table).getByText('Idle')).toBeInTheDocument();
  });

  it('places a visit on the strip in the device zone, not the browser zone', async () => {
    mockApi(routes());
    renderWithProviders(<DevicesPage />);
    expect(await screen.findByRole('img', { name: /^08:12 · 2m · 5\.41 kg$/ })).toBeInTheDocument();
    expect(screen.getByText(/Wed 28 Oct · 1 litter-box visit/)).toBeInTheDocument();
  });

  it('asks before a command runs and lists destructive commands last', async () => {
    const calls = mockApi(
      routes({
        [`POST /api/devices/${litterSummary.id}/command`]: {
          body: { ok: true, delivered: 'mqtt', suffix: 'start', envelope: {} },
        },
      }),
    );
    const user = userEvent.setup();
    const panel = await openLitterPanel();
    const commands = await within(panel).findByRole('region', { name: 'Commands' });
    const names = within(commands)
      .getAllByRole('button')
      .map(b => b.textContent);
    expect(names).toEqual(['Clean Now', 'Dump Litter']);

    await user.click(within(commands).getByRole('button', { name: 'Clean Now' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Clean Now on the litter box?' });
    expect(calls.some(c => c.method === 'POST')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Clean Now' }));

    expect(
      await within(commands).findByText('Last command: Clean Now · Sent over MQTT'),
    ).toBeInTheDocument();
    const post = calls.find(c => c.method === 'POST');
    expect(await post?.json()).toEqual({ action: 'clean', transport: 'auto' });
  });

  it('keeps an unsent number edit across a collapse and refuses out-of-range values', async () => {
    const calls = mockApi(routes());
    const user = userEvent.setup();
    const panel = await openLitterPanel();
    const input = await within(panel).findByRole('spinbutton', { name: 'Clean Delay' });
    await user.clear(input);
    await user.type(input, '90');
    await user.click(within(panel).getByRole('button', { name: 'Set Clean Delay' }));
    expect(within(panel).getByText(/Must be between 1 and 60/)).toBeInTheDocument();
    expect(calls.some(c => c.method === 'POST')).toBe(false);

    const toggle = within(panel).getAllByRole('button', { expanded: true })[0]!;
    await user.click(toggle);
    expect(within(panel).queryByRole('spinbutton', { name: 'Clean Delay' })).toBeNull();
    await user.click(toggle);
    expect(within(panel).getByRole('spinbutton', { name: 'Clean Delay' })).toHaveValue(90);
    expect(within(panel).getByText(/Not sent yet/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('mp.devices.open') ?? '{}')).toMatchObject({
      [`d${litterSummary.id}:panel`]: true,
    });
  });

  it('copies the stream URL', async () => {
    mockApi(routes());
    const exec = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
    const user = userEvent.setup();
    const panel = await openLitterPanel();
    await user.click(await within(panel).findByRole('button', { name: 'Copy Camera stream URL' }));
    expect(exec).toHaveBeenCalledWith('copy');
    expect(within(panel).getByText('Copied')).toBeInTheDocument();
  });

  it('clears the timezone override when the box is emptied', async () => {
    const calls = mockApi(
      routes({
        [`POST /api/devices/${feederSummary.id}/timezone`]: {
          body: {
            ok: true,
            delivered: 'heartbeat-queue',
            effective: 7,
            override: null,
            reported: 7,
            locale: '',
            source: 'device',
          },
        },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<DevicesPage />);
    const panel = await screen.findByRole('region', { name: 'YumShare Dual-Hopper' });
    const box = await within(panel).findByRole('spinbutton', { name: 'Offset from UTC' });
    expect(box).toHaveValue(2);
    await user.clear(box);
    await user.click(within(panel).getByRole('button', { name: 'Set timezone offset' }));
    expect(
      await within(panel).findByText('Saved — applies on its next check-in'),
    ).toBeInTheDocument();
    const post = calls.find(c => c.method === 'POST');
    expect(await post?.json()).toEqual({ timezone: null });
  });

  it('refuses a sound over 2 MB before sending it', async () => {
    const calls = mockApi(
      routes({ [`GET /api/devices/${feederSummary.id}/sounds`]: { body: { sounds: [] } } }),
    );
    const user = userEvent.setup({ applyAccept: false });
    renderWithProviders(<DevicesPage />);
    const panel = await screen.findByRole('region', { name: 'YumShare Dual-Hopper' });
    await user.click(await within(panel).findByText('Custom sounds'));
    const input = await within(panel).findByLabelText(/Upload a sound/);
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.mp3', { type: 'audio/mpeg' });
    await user.upload(input, big);
    expect(within(panel).getByText('big.mp3 is larger than 2 MB')).toBeInTheDocument();
    expect(calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('shows an accessory as its own panel and polls it', async () => {
    const calls = mockApi(
      routes({ [`POST /api/ble/${accessory.petkit_id}/poll`]: { body: { ok: true, via: 1 } } }),
    );
    const user = userEvent.setup();
    renderWithProviders(<DevicesPage />);
    const panel = await screen.findByRole('region', { name: 'EverSweet Max Cordless' });
    expect(within(panel).getByText(/scan type for this model is a guess/)).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Read now' }));
    expect(await within(panel).findByText('Asked the relay for a reading')).toBeInTheDocument();
    expect(
      calls.some(
        c => c.method === 'POST' && c.url.endsWith(`/api/ble/${accessory.petkit_id}/poll`),
      ),
    ).toBe(true);
  });

  it('keeps a failed list inside its block with Retry', async () => {
    mockApi({
      'GET /api/devices': { status: 500, body: { error: { code: 'internal', message: 'Boom.' } } },
    });
    renderWithProviders(<DevicesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the devices: Boom.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
