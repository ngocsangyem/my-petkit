import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { renderWithProviders } from '@/test/render';
import { DeviceSchedules } from './index';
import { clockToMin, formatOffset, minToClock, secToClock } from './schedule-clock';
import type { DeviceDetail, ScheduleTarget } from './schedule-model';
import { validateDraft } from './schedule-model';

function device(schedules: ScheduleTarget[], extra: Partial<DeviceDetail> = {}): DeviceDetail {
  return {
    id: 42,
    type: 't5',
    name: 'Litter box',
    sn: 'SN1',
    mac: 'aa',
    firmware: '1.0',
    online: true,
    mqtt_connected: true,
    is_camera: false,
    is_feeder: false,
    supports_ai: false,
    pk: 'pk',
    dn: 'dn',
    last_heartbeat: null,
    last_state_report: null,
    last_seen: null,
    last_mqtt: null,
    mqtt_subscriptions: [],
    mqtt_delivery: null,
    queue: 0,
    http_count: 0,
    mqtt_count: 0,
    ble: [],
    state: null,
    settings: {},
    config: {},
    diag: {},
    streams: {},
    schedules,
    entities: [],
    actions: [],
    timezoneInfo: {
      effective: 7,
      override: null,
      reported: 7,
      locale: 'Asia/Saigon',
      source: 'locale',
    },
    logInfo: { log_upload_enabled: false, reason: '' },
    ...extra,
  } as DeviceDetail;
}

const delivered = { ok: true, delivered: 'mqtt', suffix: 'property.set', envelope: {} };

async function postedBody(calls: Request[], path: string): Promise<unknown> {
  const call = calls.find(c => c.method === 'POST' && c.url.endsWith(path));
  if (!call) throw new Error(`no POST to ${path}`);
  return call.json();
}

describe('schedule clocks', () => {
  it('converts minutes and feeder seconds without losing the day boundary', () => {
    expect(minToClock(0)).toBe('00:00');
    expect(minToClock(1439)).toBe('23:59');
    expect(minToClock(1441)).toBe('');
    expect(clockToMin('07:30')).toBe(450);
    expect(clockToMin('24:00')).toBeNull();
    expect(secToClock(46560)).toBe('12:56');
    expect(formatOffset(5.75)).toBe('UTC+5:45');
    expect(formatOffset(-3)).toBe('UTC-3');
  });

  it('refuses what the server refuses', () => {
    expect(validateDraft({ kind: 'ranges', value: [[1320, 420]] })).toBeNull();
    expect(validateDraft({ kind: 'ranges', value: [[0, 1441]] })).not.toBeNull();
    expect(validateDraft({ kind: 'weekly', value: [{ enable: 1, rpt: '', time: [] }] })).toMatch(
      /day/,
    );
    expect(
      validateDraft({ kind: 'points', value: [{ id: 1, repeats: '1', time: 1440, type: 0 }] }),
    ).not.toBeNull();
    expect(
      validateDraft({
        kind: 'feed',
        value: { schedule: [{ re: '1', it: [{ id: 1, t: 60, a1: 256, a2: 0 }] }] },
      }),
    ).toMatch(/255/);
  });
});

describe('DeviceSchedules', () => {
  it('renders nothing for a device with no schedules', () => {
    mockApi({});
    const { container } = renderWithProviders(<DeviceSchedules device={device([])} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('edits a range list and saves the minutes as the wire form', async () => {
    const calls = mockApi({ 'POST /api/devices/42/schedule': { body: delivered } });
    renderWithProviders(
      <DeviceSchedules
        device={device([
          {
            target: 'distrubMultiRange',
            name: 'Cleaning Do Not Disturb',
            kind: 'ranges',
            value: [
              [0, 1440],
              [1320, 420],
            ],
          },
        ])}
      />,
    );
    expect(screen.getByText('All day', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('next day')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('period 2 start'), { target: { value: '21:30' } });
    await userEvent.click(screen.getByRole('button', { name: 'Remove period 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Cleaning Do Not Disturb' }));

    expect(await screen.findByRole('status')).toHaveTextContent('sent to the device');
    expect(await postedBody(calls, '/schedule')).toEqual({
      target: 'distrubMultiRange',
      value: [[1290, 420]],
    });
  });

  it('blocks a weekly entry with no days and discards back to the server value', async () => {
    mockApi({});
    renderWithProviders(
      <DeviceSchedules
        device={device([
          {
            target: 'cameraMultiNew',
            name: 'Shooting Period',
            kind: 'weekly',
            value: [{ enable: 1, rpt: '2', time: [[480, 1020]] }],
          },
        ])}
      />,
    );
    const days = screen.getByRole('group', { name: 'Days of entry 1' });
    await userEvent.click(within(days).getByLabelText('Mon'));
    expect(screen.getByRole('button', { name: 'Save Shooting Period' })).toBeDisabled();
    expect(screen.getByText('Pick at least one day for each entry.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(within(days).getByLabelText('Mon')).toBeChecked();
  });

  it('adds a deodorizing time without touching the cleaning entries', async () => {
    const calls = mockApi({ 'POST /api/devices/42/schedule': { body: delivered } });
    renderWithProviders(
      <DeviceSchedules
        device={device([
          {
            target: 'schedule',
            name: 'Scheduled Cleaning & Deodorizing',
            kind: 'points',
            value: [{ id: 110969, repeats: '1,7', time: 600, type: 0 }],
          },
        ])}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add periodic deodorizing time' }));
    await userEvent.click(screen.getByRole('button', { name: /^Save/ }));
    await screen.findByRole('status');
    expect(await postedBody(calls, '/schedule')).toEqual({
      target: 'schedule',
      value: [
        { id: 110969, repeats: '1,7', time: 600, type: 0 },
        { id: 110970, repeats: '1,2,3,4,5,6,7', time: 0, type: 1 },
      ],
    });
  });

  it('edits feeder meals in seconds and keeps the one-off feeds it does not own', async () => {
    const calls = mockApi({
      'POST /api/devices/42/schedule': { body: { ...delivered, delivered: 'heartbeat-queue' } },
    });
    const deferred = [{ id: 'd_20261030_61500', a1: 1, a2: 0, fire_at: 1_793_351_100 }];
    renderWithProviders(
      <DeviceSchedules
        device={device(
          [
            {
              target: 'feed_schedule',
              name: 'Feeding Schedule',
              kind: 'feed',
              dual: true,
              value: {
                schedule: [{ re: '1,2', it: [{ id: 'n_46560', t: 46560, a1: 1, a2: 2 }] }],
                deferred,
                v: 2,
              },
            },
          ],
          { is_feeder: true },
        )}
      />,
    );
    expect(screen.getByRole('region', { name: 'Meal set 1' })).toHaveTextContent('12:56');
    await userEvent.click(screen.getByRole('button', { name: 'Edit meal 1 of set 1' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit meal' });
    const time = within(sheet).getByLabelText('Meal 1 of set 1 time');
    expect(time).toHaveValue('12:56');
    fireEvent.change(time, { target: { value: '13:00' } });
    const hopper2 = within(sheet).getByLabelText('Hopper 2');
    await userEvent.clear(hopper2);
    await userEvent.type(hopper2, '3');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit meal' })).toBeNull();
    });
    expect(screen.getByRole('region', { name: 'Meal set 1' })).toHaveTextContent('13:00');
    await userEvent.click(screen.getByRole('button', { name: 'Save Feeding Schedule' }));

    expect(await screen.findByRole('status')).toHaveTextContent('next poll');
    expect(await postedBody(calls, '/schedule')).toEqual({
      target: 'feed_schedule',
      value: {
        schedule: [{ re: '1,2', it: [{ id: 'n_46560', t: 46800, a1: 1, a2: 3 }] }],
        deferred,
        v: 2,
      },
    });
  });

  it('reports a refused save inside the editor and keeps the edit', async () => {
    mockApi({
      'POST /api/devices/42/schedule': {
        status: 400,
        body: { error: 'not a valid ranges schedule' },
      },
    });
    renderWithProviders(
      <DeviceSchedules
        device={device([
          { target: 'lightMultiRange', name: 'Screen Period', kind: 'ranges', value: [] },
        ])}
      />,
    );
    expect(screen.getByText(/Nothing here restricts the device/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add period' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Screen Period' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not a valid ranges schedule');
    expect(screen.getByText('All day', { selector: 'span' })).toBeInTheDocument();
  });
});

describe('one-off feeds', () => {
  const feeder = device(
    [
      {
        target: 'feed_schedule',
        name: 'Feeding Schedule',
        kind: 'feed',
        dual: true,
        value: { schedule: [] },
      },
    ],
    { is_feeder: true, name: 'Kitchen feeder' },
  );

  it('lists feeds on the device clock, adds and deletes one', async () => {
    // 2026-10-30 17:05 at UTC+7 is 10:05 UTC.
    const fireAt = Date.UTC(2026, 9, 30, 10, 5) / 1000;
    const calls = mockApi({
      'GET /api/devices/42/deferred-feed': {
        body: { deferred: [{ id: 'd_20261030_61500', a1: 2, a2: 1, fire_at: fireAt }] },
      },
      'POST /api/devices/42/deferred-feed': {
        body: { ok: true, feed: { id: 'd_20261231_28800', a1: 1, a2: 0, fire_at: fireAt } },
      },
      'DELETE /api/devices/42/deferred-feed/d_20261030_61500': { body: { ok: true } },
    });
    renderWithProviders(<DeviceSchedules device={feeder} />);
    await userEvent.click(screen.getByRole('tab', { name: 'One-off feeds' }));

    expect(await screen.findByText(/17:05/)).toBeInTheDocument();
    expect(screen.getByText('Hopper 1: 2, Hopper 2: 1')).toBeInTheDocument();
    expect(screen.getByText(/UTC\+7/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Schedule feed' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a date and a time.');

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-12-31' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '08:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Schedule feed' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Feed scheduled.');
    expect(await postedBody(calls, '/deferred-feed')).toEqual({
      date: '2026-12-31',
      time: '08:00',
      a1: 1,
      a2: 0,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(calls.some(c => c.method === 'DELETE')).toBe(true);
    });
  });

  it('shows a refused one-off feed and a failed list with Retry', async () => {
    mockApi({
      'GET /api/devices/42/deferred-feed': { status: 500, body: { error: 'boom' } },
    });
    renderWithProviders(<DeviceSchedules device={feeder} />);
    await userEvent.click(screen.getByRole('tab', { name: 'One-off feeds' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows the server refusal of a time in the past', async () => {
    mockApi({
      'GET /api/devices/42/deferred-feed': { body: { deferred: [] } },
      'POST /api/devices/42/deferred-feed': { status: 400, body: { error: 'time is in the past' } },
    });
    renderWithProviders(<DeviceSchedules device={feeder} />);
    await userEvent.click(screen.getByRole('tab', { name: 'One-off feeds' }));
    expect(await screen.findByText('No one-off feeds scheduled.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '00:01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Schedule feed' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('time is in the past');
  });
});
