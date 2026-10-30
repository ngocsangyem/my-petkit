import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HubEvent } from '@/shared/ws/hub-event';
import { renderWithProviders } from '@/test/render';
import { mockApi, type MockReply } from '@/test/mock-api';
import { DAY, DEVICES, PETS, SESSIONS, day, session } from './timeline-fixtures';
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
  it('shows the day: summary, strip lanes, chips with counts and sessions', async () => {
    routes();
    renderWithProviders(<TimelinePage />);
    expect(
      await screen.findByRole('heading', { name: 'Miso used the litter box' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Miso used the litter box once and Mochi once\./)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Today at home/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All 3' })).toHaveAttribute('aria-pressed', 'true');
    const chips = screen.getByRole('group', { name: 'Filter by kind' });
    expect(within(chips).getByRole('button', { name: 'Toileting 2' })).toBeInTheDocument();
    // A chip with nothing in it is hidden unless selected.
    expect(within(chips).queryByRole('button', { name: /Faults/ })).not.toBeInTheDocument();
    const events = screen.getByRole('region', { name: 'Events' });
    const miso = within(events).getAllByRole('button', { name: /Miso used the litter box/ })[0]!;
    expect(within(miso).getByText('1 min 55 s')).toBeInTheDocument();
    expect(within(miso).getByText('5.43 kg')).toBeInTheDocument();
    expect(screen.getAllByText('Assembling video…').length).toBeGreaterThan(0);
    expect(within(events).getByText('Meal dispensed')).toBeInTheDocument();
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

    const byDevice = screen.getByRole('group', { name: 'Filter by device' });
    await user.click(within(byDevice).getByRole('button', { name: 'Litter box' }));
    const byCat = screen.getByRole('group', { name: 'Filter by cat' });
    await user.click(within(byCat).getByRole('button', { name: 'Mochi' }));
    await waitFor(() => {
      const last = timelineCalls(calls).find(
        q => q.get('filter') === 'toileting' && q.get('pet') === '2',
      );
      expect(last?.get('device')).toBe('10000001');
    });
    expect(within(byCat).getByRole('button', { name: 'Mochi' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // "All" lets go of the kind, the cat and the device at once.
    await user.click(screen.getByRole('button', { name: /^All/ }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true');
    });
    expect(within(byCat).getByRole('button', { name: 'Mochi' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    const last = timelineCalls(calls).at(-1);
    expect(last?.get('filter')).toBe('all');
    expect(last?.get('pet')).toBeNull();
    expect(last?.get('device')).toBeNull();
  });

  it('narrows to the visits nobody was recognised in, and asks who it was', async () => {
    const unknown = session({ id: 601, pet_id: null, pet_name: null, pet_source: null });
    routes({ 'GET /api/timeline': { body: day({ sessions: [unknown, ...SESSIONS] }) } });
    const user = userEvent.setup();
    renderWithProviders(<TimelinePage />);
    const chip = await screen.findByRole('button', { name: 'Not recognised 1' });
    await user.click(chip);
    const events = screen.getByRole('region', { name: 'Events' });
    await waitFor(() => {
      expect(within(events).queryByText('Meal dispensed')).not.toBeInTheDocument();
    });
    expect(within(events).getAllByRole('button', { name: /Litter-box visit/ })).toHaveLength(1);

    await user.click(within(events).getByRole('button', { name: 'Who was it?' }));
    expect(await screen.findByRole('dialog', { name: /^Who used the box at/ })).toBeInTheDocument();
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

  it('shows how a visit was matched: by weight as a pill, an unrecognised one in words', async () => {
    const unknown = session({ id: 601, pet_id: null, pet_name: null, pet_source: null });
    routes({ 'GET /api/timeline': { body: day({ sessions: [unknown, ...SESSIONS] }) } });
    renderWithProviders(<TimelinePage />);
    const mochi = await screen.findByRole('button', { name: /Mochi used the litter box/ });
    expect(within(mochi).getByText('by weight')).toBeInTheDocument();
    const visit = screen.getAllByRole('button', { name: /Litter-box visit/ })[0]!;
    expect(within(visit).getByText('not recognised')).toBeInTheDocument();
  });

  it('offers light visits as their own chip with their count', async () => {
    const calls = routes({
      'GET /api/timeline': { body: day({ counts: { ...day().counts, passing: 2 } }) },
    });
    const user = userEvent.setup();
    renderWithProviders(<TimelinePage />);
    await screen.findByRole('heading', { name: 'Miso used the litter box' });
    await user.click(screen.getByRole('button', { name: 'Light visits 2' }));
    await waitFor(() => {
      expect(timelineCalls(calls).some(q => q.get('filter') === 'passing')).toBe(true);
    });
  });
});

async function putBody(calls: Request[]): Promise<unknown> {
  const call = calls.find(c => c.method === 'PUT');
  expect(call, 'PUT /api/timeline/{id}/pet').toBeDefined();
  return call ? ((await call.clone().json()) as unknown) : undefined;
}

describe('Change cat', () => {
  const unrecognised = session({
    id: 601,
    pet_id: null,
    pet_name: null,
    pet_photo_url: null,
    pet_source: null,
    weight: 3900,
    unbound_pet_ref: 7301552,
  });
  const saved = { updated: 2, pet_id: 2, pet_source: 'manual', passing: false, pet: null };

  async function openSheet(sessions = SESSIONS, over: Record<string, MockReply> = {}) {
    const calls = routes({
      'GET /api/timeline': { body: day({ sessions }) },
      [`PUT /api/timeline/${String(sessions[0]?.id)}/pet`]: { body: saved },
      ...over,
    });
    const user = userEvent.setup();
    renderWithProviders(<TimelinePage />);
    await user.click(await screen.findByRole('button', { name: 'Change cat' }));
    return {
      calls,
      user,
      dialog: await screen.findByRole('dialog', { name: /^Who used the box at/ }),
    };
  }

  it('lists the cats nearest weight first and saves another cat with its weight', async () => {
    const { calls, user, dialog } = await openSheet();
    expect(within(dialog).getAllByRole('radio')).toHaveLength(3);
    expect(within(dialog).getByText('5.43 kg registered · closest weight')).toBeInTheDocument();
    expect(within(dialog).getByText('3.86 kg registered')).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: /^Miso/ })).toBeChecked();
    expect(within(dialog).getByText(/Nothing is sent to the litter box\./)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('radio', { name: /^Mochi/ }));
    const weight = within(dialog).getByRole('switch', { name: "Use this for Mochi's weight" });
    expect(
      within(dialog).getByText('Updates the registered weight to 5.43 kg.'),
    ).toBeInTheDocument();
    // The session has no reported identity, so the identity option is not offered.
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(weight);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await putBody(calls)).toEqual({
      pet_id: 2,
      passing: false,
      use_weight: true,
      apply_to_ref: false,
    });
    expect(
      await screen.findByText('Assigned to Mochi; registered weight now 5.43 kg'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
    });
  });

  it('asks before choosing on an unrecognised visit and can bind its identity', async () => {
    const { calls, user, dialog } = await openSheet([unrecognised, ...SESSIONS]);
    expect(
      within(dialog).getByText('The camera did not recognise the cat. The scale read 3.90 kg.'),
    ).toBeInTheDocument();
    const radios = within(dialog).getAllByRole('radio');
    expect(radios.some(r => r.getAttribute('aria-checked') === 'true')).toBe(false);
    expect(within(dialog).getByText('3.86 kg registered · closest weight')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.click(within(dialog).getByRole('radio', { name: /^Mochi/ }));
    await user.click(
      within(dialog).getByRole('checkbox', {
        name: 'Also use for later visits with this identity',
      }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await putBody(calls)).toEqual({
      pet_id: 2,
      passing: false,
      use_weight: false,
      apply_to_ref: true,
    });
  });

  it('marks a visit as just passing without any option', async () => {
    const { calls, user, dialog } = await openSheet([unrecognised, ...SESSIONS]);
    await user.click(within(dialog).getByRole('radio', { name: 'No cat, just passing' }));
    expect(within(dialog).queryByRole('switch')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await putBody(calls)).toEqual({
      pet_id: null,
      passing: true,
      use_weight: false,
      apply_to_ref: false,
    });
    expect(await screen.findByText('Marked as just passing')).toBeInTheDocument();
  });

  it('keeps a refusal inside the sheet', async () => {
    const { user, dialog } = await openSheet(SESSIONS, {
      'PUT /api/timeline/501/pet': {
        status: 400,
        body: {
          error: {
            code: 'implausible_weight',
            message: 'The scale reading is not a plausible cat weight.',
          },
        },
      },
    });
    await user.click(within(dialog).getByRole('switch', { name: "Use this for Miso's weight" }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'The scale reading is not a plausible cat weight.',
    );
    expect(dialog).toBeInTheDocument();
  });
});
