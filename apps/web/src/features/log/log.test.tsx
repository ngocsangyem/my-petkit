import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HubEvent } from '@/shared/ws/hub-event';
import { mockApi } from '@/test/mock-api';
import { renderWithProviders } from '@/test/render';
import { LogPage } from './log-page';

// The stream is the app's one socket; here its listeners are captured so a
// test can deliver frames the way the server would.
const listeners = new Set<(event: HubEvent) => void>();
vi.mock('@/shared/ws/use-event-stream', async () => {
  const { useEffect, useRef } = await import('react');
  return {
    useStreamStatus: () => 'live',
    useHubEvents: (handler: (event: HubEvent) => void) => {
      const latest = useRef(handler);
      latest.current = handler;
      useEffect(() => {
        const l = (e: HubEvent) => {
          latest.current(e);
        };
        listeners.add(l);
        return () => {
          listeners.delete(l);
        };
      }, []);
    },
  };
});

const emit = (e: HubEvent) => {
  act(() => {
    listeners.forEach(l => {
      l(e);
    });
  });
};

const ts = 1_761_700_000;
const fixtures: HubEvent[] = [
  { seq: 1, ts, kind: 'http', device_id: 100234567, summary: 'POST /6/t6/dev_heartbeat -> 200' },
  {
    seq: 2,
    ts: ts + 1,
    kind: 'http',
    device_id: 100234567,
    summary: 'POST /6/t6/dev_state_report -> 200',
    detail: { method: 'POST', path: '/6/t6/dev_state_report', status: 200, req_body: '{"a":1}' },
  },
  { seq: 3, ts: ts + 2, kind: 'connect', device_id: null, summary: 'MQTT session ended' },
];

const listing = {
  dir: '/data/devlogs',
  reason: '',
  enabled_devices: [100234567],
  files: [
    {
      rel: '100234567/2026 10/devRun.log',
      name: 'devRun.log',
      device: 100234567,
      size: 4096,
      mtime: ts,
    },
  ],
  total_bytes: 4096,
};

const windowOf = (q: string, offset: number) => ({
  lines: [
    [offset + 1, `boot ok ${q}`],
    [offset + 2, 'wifi connected <b>'],
  ],
  total: 1200,
  matched: q ? 2 : 1200,
  offset,
  limit: 500,
  size: 4096,
});

function routes() {
  return mockApi({
    'GET /api/events': { body: fixtures },
    'GET /api/devicelogs': { body: listing },
    'GET /api/devicelogs/100234567/2026%2010/devRun.log': req => {
      const u = new URL(req.url);
      if (u.searchParams.get('download')) return { body: 'raw log' };
      return {
        body: windowOf(u.searchParams.get('q') ?? '', Number(u.searchParams.get('offset'))),
      };
    },
  });
}

// jsdom has no object URLs; the saved blob is read back from this spy.
const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:x');

beforeEach(() => {
  listeners.clear();
  createObjectURL.mockClear();
  Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
});

describe('LogPage live log', () => {
  it('backfills from /api/events, hides heartbeats by default, and appends live events once', async () => {
    routes();
    renderWithProviders(<LogPage />);
    const log = await screen.findByRole('log', { name: 'Live log' });
    expect(await within(log).findByText('POST /6/t6/dev_state_report -> 200')).toBeInTheDocument();
    expect(within(log).queryByText('POST /6/t6/dev_heartbeat -> 200')).toBeNull();
    expect(screen.getByText(/Hiding 1 heartbeats/)).toBeInTheDocument();

    emit({ seq: 4, ts: ts + 3, kind: 'cmd', device_id: 100234567, summary: '-> mqtt: feed' });
    emit({ seq: 4, ts: ts + 3, kind: 'cmd', device_id: 100234567, summary: '-> mqtt: feed' });
    expect(within(log).getAllByText('-> mqtt: feed')).toHaveLength(1);
    expect(screen.getByText(/^4 events\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Hide heartbeats' }));
    expect(within(log).getByText('POST /6/t6/dev_heartbeat -> 200')).toBeInTheDocument();
  });

  it('expands a row to its detail and filters by grep', async () => {
    routes();
    renderWithProviders(<LogPage />);
    const toggle = await screen.findByRole('button', { name: /dev_state_report -> 200/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/── Request body ──/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter the live log' }), {
      target: { value: 'session' },
    });
    const log = screen.getByRole('log', { name: 'Live log' });
    expect(within(log).getByText('MQTT session ended')).toBeInTheDocument();
    expect(within(log).queryByText(/dev_state_report/)).toBeNull();
  });

  it('downloads what is on screen and clears without the replay bringing rows back', async () => {
    routes();
    renderWithProviders(<LogPage />);
    await screen.findByRole('button', { name: /dev_state_report -> 200/ });
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(await screen.findByText('Saved 2 rows')).toBeInTheDocument();
    const blob = createObjectURL.mock.calls[0]![0];
    const text = await blob.text();
    expect(text).toContain('dev_state_report');
    expect(text).not.toContain('dev_heartbeat');

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    emit(fixtures[2]!);
    expect(screen.getByText('Nothing has been heard yet.')).toBeInTheDocument();
  });
});

describe('LogPage device logs', () => {
  it('reads the newest file with its slashes kept, greps on the server and pages by offset', async () => {
    const calls = routes();
    renderWithProviders(<LogPage />);
    expect(await screen.findByText('1200 lines · showing 1–2')).toBeInTheDocument();
    expect(screen.getByText('wifi connected <b>')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('501')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the device log' }), {
      target: { value: 'boot' },
    });
    expect(await screen.findByText('2 of 1200 lines')).toBeInTheDocument();
    expect(screen.getAllByText('boot', { selector: 'mark' })).toHaveLength(2);
    const reads = calls.filter(r => r.url.includes('/api/devicelogs/'));
    expect(reads.at(-1)?.url).toContain('/api/devicelogs/100234567/2026%2010/devRun.log?');
    expect(new URL(reads.at(-1)!.url).searchParams.get('offset')).toBe('0');
  });

  it('downloads the raw file through the API client', async () => {
    const calls = routes();
    renderWithProviders(<LogPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Download devRun.log' }));
    await waitFor(() => {
      expect(calls.some(r => new URL(r.url).searchParams.get('download') === '1')).toBe(true);
    });
    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalled();
    });
  });

  it('says why there is nothing to show', async () => {
    mockApi({
      'GET /api/events': { body: [] },
      'GET /api/devicelogs': {
        body: { ...listing, files: [], reason: 'no_bucket_endpoint', enabled_devices: [] },
      },
    });
    renderWithProviders(<LogPage />);
    expect(
      await screen.findByText(/Cannot collect: this app has no bucket address/),
    ).toBeInTheDocument();
  });
});
