import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HubEvent } from '@/shared/ws/hub-event';
import { renderWithProviders } from '@/test/render';
import { mockApi, type MockReply } from '@/test/mock-api';
import { DAY, DEVICES, PETS, day } from './timeline-fixtures';
import { TimelinePage } from './index';

const hub: { handler: ((e: HubEvent) => void) | null } = { handler: null };
vi.mock('@/shared/ws/use-event-stream', () => ({
  useHubEvents: (handler: (e: HubEvent) => void) => {
    hub.handler = handler;
  },
}));

const DETAIL = {
  event: {
    id: 501,
    event_uid: 'ep-1:10',
    event_type: '10',
    event_kind: 'toilet_visit',
    label: 'Pet left',
    ts: 1,
    created_at: 1,
    source: 'mqtt',
    device_id: 10000001,
    device_type: 't5',
    pet_id: 1,
    pet_ref: 77,
    pet_name: 'Miso',
    pet_photo_url: null,
    score: 912,
    related_event: 'ep-1',
    parent_event: null,
  },
  code: {
    code: '10',
    label: 'Pet left the box',
    kind: 'toilet_visit',
    grade: 'confirmed',
    role: 'primary',
    detail: false,
    firmware: 'report_pet_out',
    note: '',
  },
  decoded: [
    {
      key: 'weight',
      label: 'Weight',
      raw: 5430,
      text: '5.43 kg',
      grade: 'inferred',
      note: '',
      epoch: false,
    },
  ],
  content: { weight: 5430 },
  state: { sandPercent: 40 },
};

function routes(over: Record<string, MockReply> = {}) {
  return mockApi({
    'GET /api/devices': { body: DEVICES },
    'GET /api/pets': { body: { pets: PETS } },
    'GET /api/timeline': { body: day() },
    'GET /api/timeline/501': { body: DETAIL },
    ...over,
  });
}

function timelineCalls(calls: Request[]): URLSearchParams[] {
  return calls
    .map(r => new URL(r.url))
    .filter(u => u.pathname.endsWith('/api/timeline'))
    .map(u => u.searchParams);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 28, 15, 0, 0) });
  hub.handler = null;
  // jsdom has no media stack; the lazy player only needs these to exist.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TimelinePage', () => {
  it('shows the day: summary, strip lanes, figures, chips with counts and sessions', async () => {
    routes();
    renderWithProviders(<TimelinePage />);
    expect(
      await screen.findByRole('heading', { name: 'Miso used the litter box' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Miso used the litter box once and Mochi once\./)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Today at home/ })).toBeInTheDocument();
    const chips = screen.getByRole('group', { name: 'Filter by kind' });
    expect(within(chips).getByRole('button', { name: 'All 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(chips).getByRole('button', { name: 'Toileting 2' })).toBeInTheDocument();
    // A chip with nothing in it is hidden unless selected.
    expect(within(chips).queryByRole('button', { name: /Faults/ })).not.toBeInTheDocument();
    expect(screen.getByText('1 min 55 s')).toBeInTheDocument();
    expect(screen.getByText('5.43 kg', { selector: 'button > span' })).toBeInTheDocument();
    expect(screen.getAllByText('Assembling video…').length).toBeGreaterThan(0);
    expect(screen.getByText('Meal dispensed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled();
  });

  it('filters by kind, keeping counts, and narrows by device and cat', async () => {
    const calls = routes();
    const user = userEvent.setup();
    renderWithProviders(<TimelinePage />);
    await screen.findByRole('heading', { name: 'Miso used the litter box' });

    await user.click(screen.getByRole('button', { name: 'Toileting 2' }));
    await waitFor(() => {
      expect(timelineCalls(calls).some(q => q.get('filter') === 'toileting')).toBe(true);
    });

    await user.selectOptions(screen.getByLabelText('Device'), '10000001');
    await user.selectOptions(screen.getByLabelText('Cat'), '2');
    await waitFor(() => {
      const last = timelineCalls(calls).at(-1);
      expect(last?.get('device')).toBe('10000001');
      expect(last?.get('pet')).toBe('2');
      expect(last?.get('filter')).toBe('toileting');
    });
  });

  it('moves between days on the local calendar', async () => {
    const calls = routes();
    const user = userEvent.setup();
    renderWithProviders(<TimelinePage />);
    await screen.findByRole('heading', { name: 'Miso used the litter box' });
    expect(timelineCalls(calls)[0]?.get('date')).toBe(DAY);

    await user.click(screen.getByRole('button', { name: 'Previous day' }));
    await waitFor(() => {
      expect(timelineCalls(calls).some(q => q.get('date') === '2026-10-27')).toBe(true);
    });
    expect(screen.getByRole('button', { name: 'Next day' })).toBeEnabled();
  });

  it('opens the waste gallery with the true count and steps through it', async () => {
    routes();
    const user = userEvent.setup();
    renderWithProviders(<TimelinePage />);
    const tile = await screen.findByRole('button', { name: 'Check waste, 2 pictures' });
    await user.click(tile);
    const dialog = await screen.findByRole('dialog', { name: 'Check waste' });
    expect(within(dialog).getByText('1 of 2')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Next picture' }));
    expect(within(dialog).getByText('2 of 2')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(tile).toHaveFocus();
    });
  });

  it('selecting a session with a clip shows the player and its sources', async () => {
    routes();
    const user = userEvent.setup();
    renderWithProviders(<TimelinePage />);
    await user.click(await screen.findByRole('button', { name: /Mochi used the litter box/ }));
    const video = await screen.findByLabelText('Clip video');
    expect(video.getAttribute('src')).toContain('api/media/T5%20%23SN-1/Clips/c.mp4');
    expect(screen.getByRole('button', { name: 'Timelapse' })).toBeInTheDocument();
  });

  it('loads Debug info for an event only when it is opened', async () => {
    const calls = routes();
    const user = userEvent.setup();
    renderWithProviders(<TimelinePage />);
    await screen.findByRole('heading', { name: 'Miso used the litter box' });
    const detailCalls = () => calls.filter(r => r.url.includes('/api/timeline/501')).length;
    expect(detailCalls()).toBe(0);

    await user.click(screen.getByText('Debug info'));
    const event = screen.getAllByText('Miso used the litter box', { selector: 'button' })[0];
    await user.click(event!);
    expect(await screen.findByText('Pet left the box')).toBeInTheDocument();
    expect(screen.getByText('report_pet_out')).toBeInTheDocument();
    expect(screen.getByText('confirmed')).toBeInTheDocument();
    expect(screen.getByText('mqtt')).toBeInTheDocument();
    expect(detailCalls()).toBe(1);
  });

  it('refreshes on media and event hub frames, debounced', async () => {
    const calls = routes();
    renderWithProviders(<TimelinePage />);
    await screen.findByRole('heading', { name: 'Miso used the litter box' });
    const before = timelineCalls(calls).length;
    act(() => {
      hub.handler?.({ seq: 1, ts: 1, kind: 'http', device_id: 1, summary: '' });
      hub.handler?.({ seq: 2, ts: 1, kind: 'media', device_id: 1, summary: '' });
      hub.handler?.({ seq: 3, ts: 1, kind: 'event', device_id: 1, summary: '' });
    });
    await waitFor(() => {
      expect(timelineCalls(calls).length).toBe(before + 1);
    });
  });

  it('keeps an error inside the list with Retry, and shows an empty day plainly', async () => {
    routes({ 'GET /api/timeline': { status: 500, body: { error: 'boom' } } });
    const user = userEvent.setup();
    renderWithProviders(<TimelinePage />);
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);

    routes({
      'GET /api/timeline': {
        body: day({ sessions: [], counts: { ...day().counts, all: 0, toileting: 0, feeding: 0 } }),
      },
    });
    await user.click(screen.getAllByRole('button', { name: 'Retry' })[0]!);
    expect(await screen.findByText('No activity on this day.')).toBeInTheDocument();
  });
});
