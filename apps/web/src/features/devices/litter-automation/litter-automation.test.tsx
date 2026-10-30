import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { StepUpDialog } from '@/auth/step-up-dialog';
import { mockApi, type MockReply } from '@/test/mock-api';
import { renderWithProviders } from '@/test/render';
import { litterAutomation, litterSummary, noLitterAutomation } from '../devices-fixtures';
import type { LitterAutomation } from './litter-automation-api';
import { LitterAutomationSection } from './litter-automation-section';
import {
  autoPackStatusLine,
  checklistPasses,
  FORCE_CONTINUE_CHECKLIST,
  uncoveredBlockers,
} from './litter-automation-text';

const ID = litterSummary.id;
const VIEW = `GET /api/devices/${ID}/litter-automation`;
const FORCE = `POST /api/devices/${ID}/force-continue`;
const PUT = `PUT /api/devices/${ID}/auto-pack`;

function view(over: Partial<LitterAutomation> = {}): LitterAutomation {
  return { ...litterAutomation, ...over };
}

function render(routes: Record<string, MockReply>) {
  const calls = mockApi(routes);
  renderWithProviders(
    <>
      <LitterAutomationSection deviceId={ID} />
      <StepUpDialog />
    </>,
  );
  return calls;
}

const sent = (calls: Request[], method: string, suffix: string) =>
  calls.filter(c => c.method === method && new URL(c.url).pathname.endsWith(suffix));

async function passStepUp(user: ReturnType<typeof userEvent.setup>) {
  const stepUp = await screen.findByRole('dialog', { name: "Confirm it's you to continue?" });
  await user.type(within(stepUp).getByLabelText('Password'), 'secret');
  await user.click(within(stepUp).getByRole('button', { name: 'Continue' }));
}

describe('Force continue', () => {
  it('shows no button when the server does not offer it', async () => {
    const calls = render({
      [VIEW]: {
        body: view({
          forceContinue: {
            supported: true,
            offered: false,
            blockers: [{ reason: 'not_paused', message: 'The device is not paused.' }],
          },
        }),
      },
    });
    expect(await screen.findByRole('region', { name: 'Auto-pack' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Force continue' })).not.toBeInTheDocument();
    expect(screen.queryByText(/not offered/)).not.toBeInTheDocument();
    expect(sent(calls, 'GET', '/litter-automation')).toHaveLength(1);
  });

  it('says why when the box is paused but a guard refuses', async () => {
    render({
      [VIEW]: {
        body: view({
          forceContinue: {
            supported: true,
            offered: false,
            blockers: [{ reason: 'pet_in_box', message: 'The device reports a pet inside.' }],
          },
        }),
      },
    });
    expect(
      await screen.findByText(/Force continue is not offered: The device reports a pet inside\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Force continue' })).not.toBeInTheDocument();
  });

  it('renders nothing for a model that supports neither feature', async () => {
    const calls = render({ [VIEW]: { body: noLitterAutomation } });
    await waitFor(() => {
      expect(sent(calls, 'GET', '/litter-automation')).toHaveLength(1);
    });
    expect(screen.queryByRole('region', { name: 'Auto-pack' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Force continue' })).not.toBeInTheDocument();
  });

  it('asks for the password, then confirms, then sends', async () => {
    const user = userEvent.setup();
    const calls = render({
      [VIEW]: { body: view() },
      'POST /api/auth/step-up': { body: { ok: true } },
      [FORCE]: { body: { ok: true, delivered: 'mqtt', suffix: 'continue', envelope: {} } },
    });
    await user.click(await screen.findByRole('button', { name: 'Force continue' }));
    await passStepUp(user);

    const confirm = await screen.findByRole('alertdialog', { name: 'Continue cleaning now?' });
    expect(sent(calls, 'POST', '/force-continue')).toHaveLength(0);
    expect(confirm).toHaveTextContent(
      'The drum turns again. The box paused because it saw a cat near the entrance.',
    );
    for (const item of ['No pet in the box', 'No visit in progress', 'Lid closed, no fault']) {
      expect(within(confirm).getByText(item).parentElement).toHaveTextContent('(checked)');
    }
    expect(confirm).not.toHaveTextContent(/\d\s?g\b/);
    expect(within(confirm).getByRole('button', { name: 'Not now' })).toBeInTheDocument();

    await user.click(within(confirm).getByRole('button', { name: 'Continue cleaning' }));
    await waitFor(() => {
      expect(sent(calls, 'POST', '/force-continue')).toHaveLength(1);
    });
    const order = calls.map(c => new URL(c.url).pathname);
    expect(order.findIndex(p => p.endsWith('/auth/step-up'))).toBeLessThan(
      order.findIndex(p => p.endsWith('/force-continue')),
    );
  });

  it('sends nothing when the password prompt is cancelled', async () => {
    const user = userEvent.setup();
    const calls = render({ [VIEW]: { body: view() } });
    await user.click(await screen.findByRole('button', { name: 'Force continue' }));
    const stepUp = await screen.findByRole('dialog', { name: "Confirm it's you to continue?" });
    await user.click(within(stepUp).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(sent(calls, 'POST', '/force-continue')).toHaveLength(0);
  });

  it('shows the server sentence when a guard refuses at send time', async () => {
    const user = userEvent.setup();
    render({
      [VIEW]: { body: view() },
      'POST /api/auth/step-up': { body: { ok: true } },
      [FORCE]: {
        status: 409,
        body: {
          error: {
            code: 'visit_open',
            message: 'A pet entered in the last 10 minutes and has not left.',
          },
        },
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Force continue' }));
    await passStepUp(user);
    const confirm = await screen.findByRole('alertdialog', { name: 'Continue cleaning now?' });
    await user.click(within(confirm).getByRole('button', { name: 'Continue cleaning' }));
    const block = screen.getByRole('region', { name: 'Force continue' });
    expect(await within(block).findByRole('alert')).toHaveTextContent(
      'A pet entered in the last 10 minutes and has not left.',
    );
  });
  it('shows the server sentence when the command could not be sent', async () => {
    const user = userEvent.setup();
    render({
      [VIEW]: { body: view() },
      'POST /api/auth/step-up': { body: { ok: true } },
      [FORCE]: {
        status: 503,
        body: {
          error: {
            code: 'unavailable',
            message: 'The command could not be sent; nothing was queued.',
          },
        },
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Force continue' }));
    await passStepUp(user);
    const confirm = await screen.findByRole('alertdialog', { name: 'Continue cleaning now?' });
    await user.click(within(confirm).getByRole('button', { name: 'Continue cleaning' }));
    const block = screen.getByRole('region', { name: 'Force continue' });
    expect(await within(block).findByRole('alert')).toHaveTextContent(
      'The command could not be sent; nothing was queued.',
    );
  });

  it('unticks the pet row when presence is unknown and leaves liveness to its sentence', () => {
    const blockers = [
      { reason: 'presence_unknown', message: 'The device has not said whether a pet is inside.' },
      { reason: 'state_stale', message: 'No state report in the last 2 minutes.' },
    ] as const;
    expect(FORCE_CONTINUE_CHECKLIST.map(item => checklistPasses(item, blockers))).toEqual([
      false,
      true,
      true,
    ]);
    expect(uncoveredBlockers(blockers).map(b => b.reason)).toEqual(['state_stale']);
  });
});

describe('Auto-pack', () => {
  it('hides the threshold for a full bin and saves the full rule', async () => {
    const user = userEvent.setup();
    const calls = render({
      [VIEW]: { body: view() },
      [PUT]: async request => ({
        body: { rule: (await request.json()) as unknown, status: litterAutomation.autoPack.status },
      }),
    });
    const card = await screen.findByRole('region', { name: 'Auto-pack' });
    expect(within(card).getByText('Experimental')).toBeInTheDocument();
    expect(within(card).getByRole('spinbutton', { name: 'After' })).toHaveValue(5);
    expect(within(card).getByText('cleanings')).toBeInTheDocument();

    await user.selectOptions(within(card).getByLabelText('Pack'), 'bin_full');
    expect(within(card).queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(within(card).queryByLabelText('At')).not.toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Save rule' }));
    await waitFor(() => {
      expect(sent(calls, 'PUT', '/auto-pack')).toHaveLength(1);
    });
    expect(await sent(calls, 'PUT', '/auto-pack')[0]!.json()).toEqual({
      enabled: false,
      trigger: 'bin_full',
      cleanings: 5,
      at: '09:00',
      quietHours: { start: '22:00', end: '07:00' },
    });
  });

  it('refuses to save a threshold out of range', async () => {
    const user = userEvent.setup();
    render({ [VIEW]: { body: view() } });
    const card = await screen.findByRole('region', { name: 'Auto-pack' });
    const field = within(card).getByRole('spinbutton', { name: 'After' });
    await user.clear(field);
    await user.type(field, '51');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(within(card).getByRole('button', { name: 'Save rule' })).toBeDisabled();
  });

  it('asks before turning the rule on, then sends it enabled', async () => {
    const user = userEvent.setup();
    const calls = render({
      [VIEW]: { body: view() },
      [PUT]: async request => ({
        body: { rule: (await request.json()) as unknown, status: litterAutomation.autoPack.status },
      }),
    });
    const card = await screen.findByRole('region', { name: 'Auto-pack' });
    await user.click(within(card).getByRole('switch', { name: 'Pack automatically' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Turn on auto-pack?' });
    expect(dialog).toHaveTextContent('after every 5 cleanings, never between 22:00 and 07:00');
    expect(sent(calls, 'PUT', '/auto-pack')).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Turn on' }));
    await waitFor(() => {
      expect(sent(calls, 'PUT', '/auto-pack')).toHaveLength(1);
    });
    expect(await sent(calls, 'PUT', '/auto-pack')[0]!.json()).toMatchObject({ enabled: true });
    await waitFor(() => {
      expect(within(card).getByRole('switch', { name: 'Pack automatically' })).toBeChecked();
    });
  });

  it('says why the server turned the rule off', async () => {
    const status = litterAutomation.autoPack.status!;
    render({
      [VIEW]: {
        body: view({
          autoPack: {
            ...litterAutomation.autoPack,
            status: { ...status, disabledReason: 'pack_error: bag jammed', lastResult: 'failed' },
          },
        }),
      },
    });
    const card = await screen.findByRole('region', { name: 'Auto-pack' });
    expect(within(card).getByRole('status')).toHaveTextContent(
      'Turned off by the server because the box reported a packing error: bag jammed',
    );
  });

  it('says the bin rule waits for the bin to be emptied', () => {
    const rule = {
      ...litterAutomation.autoPack.rule!,
      enabled: true,
      trigger: 'bin_full' as const,
    };
    const status = { ...litterAutomation.autoPack.status!, awaitingBinClear: true };
    expect(autoPackStatusLine(rule, status)).toContain(
      'Waiting for the bin to be emptied before it counts again',
    );
  });
});
