import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { HubEvent } from '@/shared/ws/hub-event';
import { mockApi } from '@/test/mock-api';
import { renderWithProviders } from '@/test/render';
import type { DeviceSummary, PatcherEntry, PatcherStatus } from './api';
import { firstParagraph, isFinalLine, normaliseDescription, patcherIdOf } from './patcher-model';
import { PatchersPage } from './patchers-page';

// The page's hub listener, captured so a test can play `patcher` events into it.
const hub = vi.hoisted(() => ({ handler: null as ((event: HubEvent) => void) | null }));
vi.mock('@/shared/ws/use-event-stream', () => ({
  useHubEvents: (handler: (event: HubEvent) => void) => {
    hub.handler = handler;
  },
}));

function emit(summary: string, deviceId = 101) {
  act(() => {
    hub.handler?.({ seq: 1, ts: 1, kind: 'patcher', device_id: deviceId, summary });
  });
}

function device(id: number, name: string, type: string): DeviceSummary {
  return {
    id,
    type,
    name,
    sn: '',
    mac: '',
    firmware: '',
    online: true,
    mqtt_connected: false,
    is_camera: true,
    is_feeder: false,
    supports_ai: false,
    pk: '',
    dn: '',
    last_heartbeat: null,
    last_state_report: null,
    last_seen: null,
    last_mqtt: null,
    mqtt_subscriptions: [],
    mqtt_delivery: null,
    queue: 0,
    http_count: 0,
    mqtt_count: 0,
    entities: 0,
    ble: [],
  };
}

function entry(
  id: PatcherEntry['id'],
  name: string,
  extra: Partial<PatcherEntry> = {},
): PatcherEntry {
  return {
    id,
    name,
    description: `${name} first paragraph.\\n\\nSecond paragraph.`,
    status: 'not applied',
    applied: false,
    unavailable: '',
    greyed: false,
    needs_bytes: 2_200_000,
    ...extra,
  };
}

const STATUS: PatcherStatus = {
  supported: true,
  device_ip: '192.168.1.42',
  patchers: {
    cacert: entry('cacert', 'CA Certificate', { applied: true, status: 'applied' }),
    ssh: entry('ssh', 'Persistent SSH Access', { needs_pubkey: true, ssh_pubkey: '' }),
  },
};

const DEVICES = [device(101, 'Litter box', 't6'), device(202, 'Feeder', 'd4')];

describe('PatchersPage', () => {
  it('shows the status of each patch and how many are applied', async () => {
    mockApi({
      'GET /api/devices': { body: DEVICES },
      'GET /api/devices/101/patcher': { body: STATUS },
    });
    renderWithProviders(<PatchersPage />);
    expect(await screen.findByText('CA Certificate')).toBeInTheDocument();
    expect(
      screen.getByText('Root changes on the device itself · 1 of 2 patches applied'),
    ).toBeInTheDocument();
    expect(screen.getByText('Applied')).toBeInTheDocument();
    expect(screen.getByText('Not applied')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove CA Certificate…' })).toBeInTheDocument();
    expect(screen.getByText('192.168.1.42')).toBeInTheDocument();
  });

  it('says a non-Linux device cannot be patched', async () => {
    mockApi({
      'GET /api/devices': { body: DEVICES },
      'GET /api/devices/202/patcher': { body: { patchers: {}, device_ip: '', supported: false } },
    });
    localStorage.setItem('mp.patchers.device', '202');
    renderWithProviders(<PatchersPage />);
    expect(await screen.findByText(/only available for the Linux models/)).toBeInTheDocument();
  });

  it('says so when no device is connected', async () => {
    mockApi({ 'GET /api/devices': { body: [] } });
    renderWithProviders(<PatchersPage />);
    expect(await screen.findByText(/No devices connected/)).toBeInTheDocument();
  });

  it('applies SSH with the key, follows its progress and re-reads the status at the end', async () => {
    let statusReads = 0;
    const calls = mockApi({
      'GET /api/devices': { body: DEVICES },
      'GET /api/devices/101/patcher': () => {
        statusReads += 1;
        return { body: STATUS };
      },
      'POST /api/devices/101/patcher': { body: { ok: true, patcher: 'ssh', action: 'apply' } },
    });
    const user = userEvent.setup();
    renderWithProviders(<PatchersPage />);

    await user.click(await screen.findByRole('button', { name: 'Apply Persistent SSH Access…' }));
    expect(
      screen.getByRole('heading', { name: 'Apply Persistent SSH Access to Litter box?' }),
    ).toBeInTheDocument();
    const final = screen.getByRole('button', { name: 'Apply Persistent SSH Access' });
    expect(final).toBeDisabled(); // no key yet

    await user.type(screen.getByLabelText('SSH public key'), 'ssh-ed25519 AAAAC3 me@laptop');
    await user.click(final);

    await waitFor(() => {
      expect(calls.some(c => c.method === 'POST')).toBe(true);
    });
    expect(await calls.find(c => c.method === 'POST')?.json()).toEqual({
      patcher: 'ssh',
      action: 'apply',
      pubkey: 'ssh-ed25519 AAAAC3 me@laptop',
    });

    emit('[ssh] apply started');
    emit('[cacert] FAILED: unrelated'); // another patcher's run: not in this log
    emit('[ssh] something on another device', 202);
    const log = screen.getByRole('log', { name: 'Progress' });
    expect(log).toHaveTextContent('[ssh] apply started');
    expect(log).not.toHaveTextContent('unrelated');
    expect(log).not.toHaveTextContent('another device');
    expect(screen.getByText('Running…')).toBeInTheDocument();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const before = statusReads;
      emit('[ssh] done - device will reboot, patch active on next boot');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_100);
      });
      await waitFor(() => {
        expect(statusReads).toBeGreaterThan(before);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('writes a refused start into the log', async () => {
    mockApi({
      'GET /api/devices': { body: DEVICES },
      'GET /api/devices/101/patcher': { body: STATUS },
      'POST /api/devices/101/patcher': {
        status: 400,
        body: { error: 'device IP not known - wait for a state_report' },
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<PatchersPage />);
    await user.click(await screen.findByRole('button', { name: 'Remove CA Certificate…' }));
    await user.click(screen.getByRole('button', { name: 'Remove CA Certificate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not removed: device IP not known');
    expect(screen.getByRole('log', { name: 'Progress' })).toHaveTextContent('ERROR: device IP');
  });

  it('blocks Apply while the device IP is unknown', async () => {
    mockApi({
      'GET /api/devices': { body: [DEVICES[0]] },
      'GET /api/devices/101/patcher': { body: { ...STATUS, device_ip: '' } },
    });
    const user = userEvent.setup();
    renderWithProviders(<PatchersPage />);
    await user.click(await screen.findByRole('button', { name: 'Apply Persistent SSH Access…' }));
    expect(screen.getAllByText(/Device IP unknown/).length).toBeGreaterThan(0);
    await user.type(screen.getByLabelText('SSH public key'), 'ssh-rsa AAAA');
    expect(screen.getByRole('button', { name: 'Apply Persistent SSH Access' })).toBeDisabled();
  });
});

describe('patcher model', () => {
  it('routes lines by their [patcher] prefix', () => {
    expect(patcherIdOf('[mqtt] starting temp httpd on device...')).toBe('mqtt');
    expect(patcherIdOf('no prefix')).toBeNull();
  });

  it('knows the last line of a run', () => {
    expect(isFinalLine('[ssh] done - device will reboot')).toBe(true);
    expect(isFinalLine('[ssh] FAILED: boom')).toBe(true);
    expect(isFinalLine('[ssh] removal queued - device will reboot')).toBe(true);
    expect(isFinalLine('[ssh] uploading app_init.sh')).toBe(false);
  });

  it('turns a literal \\n into a real line break', () => {
    expect(normaliseDescription('a\\nb')).toBe('a\nb');
    expect(firstParagraph('one\\n\\ntwo')).toBe('one');
  });
});
