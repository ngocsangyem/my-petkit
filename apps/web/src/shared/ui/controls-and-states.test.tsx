import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { CaptionPill } from './caption-pill';
import { Chip, Segmented } from './chips-and-segmented';
import { PageHeader, StatusWord } from './page-heading';
import { EmptyState, ErrorBlock, NoticeCard } from './state-blocks';
import { Stepper } from './stepper';

function StepperHarness({ start }: { start: number | null }) {
  const [value, setValue] = useState<number | null>(start);
  return <Stepper label="Portions" value={value} onValueChange={setValue} min={1} max={3} />;
}

describe('Stepper', () => {
  it('steps within its bounds and disables the button at each end', async () => {
    const user = userEvent.setup();
    render(<StepperHarness start={2} />);
    const group = screen.getByRole('group', { name: 'Portions' });
    const down = within(group).getByRole('button', { name: 'Decrease portions' });
    const up = within(group).getByRole('button', { name: 'Increase portions' });
    await user.click(up);
    expect(within(group).getByRole('status')).toHaveTextContent('3');
    expect(up).toBeDisabled();
    await user.click(down);
    await user.click(down);
    expect(within(group).getByRole('status')).toHaveTextContent('1');
    expect(down).toBeDisabled();
  });

  it('shows a dash for a missing value and starts from the minimum', async () => {
    const user = userEvent.setup();
    render(<StepperHarness start={null} />);
    expect(screen.getByRole('status')).toHaveTextContent('—');
    expect(screen.getByRole('button', { name: 'Decrease portions' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Increase portions' }));
    expect(screen.getByRole('status')).toHaveTextContent('1');
  });
});

describe('Chip and Segmented', () => {
  it('toggles a chip with aria-pressed', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [on, setOn] = useState(false);
      return (
        <Chip pressed={on} onPressedChange={setOn}>
          Light visits
        </Chip>
      );
    }
    render(<Harness />);
    const chip = screen.getByRole('button', { name: 'Light visits' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps exactly one segment chosen', async () => {
    const user = userEvent.setup();
    const options = [
      { id: 'server', label: 'Server' },
      { id: 'device', label: 'Device logs' },
    ] as const;
    function Harness() {
      const [value, setValue] = useState<'server' | 'device'>('server');
      return <Segmented label="Log source" options={options} value={value} onChange={setValue} />;
    }
    render(<Harness />);
    const group = screen.getByRole('group', { name: 'Log source' });
    await user.click(within(group).getByRole('button', { name: 'Device logs' }));
    expect(within(group).getByRole('button', { name: 'Device logs' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Clicking the chosen segment again does not leave the control empty.
    await user.click(within(group).getByRole('button', { name: 'Device logs' }));
    expect(within(group).getByRole('button', { name: 'Device logs' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(group).getByRole('button', { name: 'Server' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('PageHeader', () => {
  it('renders the back link, title, status, finding and actions', () => {
    render(
      <MemoryRouter>
        <PageHeader
          title="Litter box"
          back={{ to: '/devices', label: 'Home' }}
          status={
            <StatusWord tone="positive" dot>
              Online · MQTT
            </StatusWord>
          }
          finding={
            <>
              <StatusWord tone="positive">Idle and clean.</StatusWord> Cleaned at 14:05.
            </>
          }
          actions={<button type="button">Clean now</button>}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/devices');
    expect(screen.getByRole('heading', { level: 1, name: 'Litter box' })).toBeInTheDocument();
    expect(screen.getByText('Online · MQTT')).toBeInTheDocument();
    expect(screen.getByText(/Cleaned at 14:05/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clean now' })).toBeInTheDocument();
  });
});

describe('state blocks', () => {
  it('keeps an error inside its block with a Retry button', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(<ErrorBlock message="Could not load today's visits." onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent("Could not load today's visits.");
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('heads an empty state and a notice with their titles', () => {
    render(
      <>
        <EmptyState title="Add your first device" action={<a href="#/provision">Add a device</a>}>
          Keep this computer near a litter box.
        </EmptyState>
        <NoticeCard title="Can't reach your server">Retrying.</NoticeCard>
        <CaptionPill>Live view</CaptionPill>
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Add your first device' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a device' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent("Can't reach your server");
    expect(screen.getByText('Live view')).toBeInTheDocument();
  });
});
