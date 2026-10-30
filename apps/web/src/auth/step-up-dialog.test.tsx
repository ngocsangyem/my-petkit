import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { promptForCredential } from '@/shared/api/credential-prompt';
import { mockApi } from '@/test/mock-api';
import { StepUpDialog } from './step-up-dialog';

describe('StepUpDialog', () => {
  it('asks for the password and resolves true once the server grants the step-up', async () => {
    const user = userEvent.setup();
    const calls = mockApi({ 'POST /api/auth/step-up': { body: { ok: true } } });
    render(<StepUpDialog />);
    const answer = promptForCredential('step-up');
    const dialog = await screen.findByRole('dialog', { name: "Confirm it's you to continue?" });
    const confirm = within(dialog).getByRole('button', { name: 'Continue' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Password'), 'secret');
    await user.click(confirm);
    await expect(answer).resolves.toBe(true);
    expect(calls.filter(c => c.url.endsWith('/api/auth/step-up'))).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps the dialog open with the error when the password is refused', async () => {
    const user = userEvent.setup();
    mockApi({
      'POST /api/auth/step-up': {
        status: 403,
        body: { error: { code: 'bad_password', message: 'Wrong password.' } },
      },
    });
    render(<StepUpDialog />);
    const answer = promptForCredential('step-up');
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Password'), 'nope{Enter}');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Wrong password.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Settle the shared prompt so the next test starts with none pending.
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await expect(answer).resolves.toBe(false);
  });

  it('resolves false on Cancel', async () => {
    const user = userEvent.setup();
    render(<StepUpDialog />);
    const answer = promptForCredential('step-up');
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await expect(answer).resolves.toBe(false);
  });
});
