import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CollapsiblePanel } from './collapsible-panel';
import { ConfirmDialog } from './confirm-dialog';
import { minuteToPercent, spanAt } from './day-strip-geometry';
import { FigureContainer } from './figure-container';
import { parseNumberInput } from './form-controls';
import { HouseholdDayStrip, petSlot, type DayStripLane } from './household-day-strip';
import { ratioPercent } from './ratio-bar';
import { StatusMark } from './status-mark';

describe('FigureContainer', () => {
  it('prints a real zero as 0 and a missing value as a muted em dash', () => {
    render(
      <FigureContainer
        cells={[
          { label: 'Bags left', value: 0 },
          { label: 'Litter level', value: null, unit: '%' },
          { label: 'Bin', value: undefined, missingText: 'Not reported' },
        ]}
      />,
    );
    const zero = screen.getByText('Bags left').nextElementSibling;
    expect(zero).toHaveTextContent(/^0$/);
    const missing = screen.getByText('Litter level').nextElementSibling;
    expect(missing).toHaveClass('ui-figures__missing');
    expect(missing).toHaveTextContent('—');
    expect(missing).not.toHaveTextContent('%');
    expect(screen.getByText('Not reported')).toHaveClass('ui-figures__missing');
  });

  it('keeps the unit beside a present value', () => {
    render(<FigureContainer cells={[{ label: 'Litter level', value: 62, unit: '%' }]} />);
    expect(screen.getByText('Litter level').nextElementSibling).toHaveTextContent('62 %');
  });
});

describe('StatusMark', () => {
  it.each([
    ['online', 'Online · MQTT'],
    ['polling', 'Polling · heartbeat'],
    ['offline', 'Offline'],
    ['unknown', 'Unknown'],
  ] as const)('labels %s as "%s"', (status, label) => {
    const { container } = render(<StatusMark status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass(`ui-status--${status}`);
  });

  it('accepts a custom label', () => {
    render(<StatusMark status="online" label="Online · HTTP" />);
    expect(screen.getByText('Online · HTTP')).toBeInTheDocument();
  });
});

function DialogHarness({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Clean now
      </button>
      <ConfirmDialog
        open={open}
        title="Clean the litter box now?"
        confirmLabel="Clean"
        onConfirm={() => {
          onConfirm();
          setOpen(false);
        }}
        onCancel={() => {
          onCancel();
          setOpen(false);
        }}
      >
        The drum turns once.
      </ConfirmDialog>
    </>
  );
}

describe('ConfirmDialog', () => {
  it('confirms, labels itself with the question, and returns focus to the opener', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<DialogHarness onConfirm={onConfirm} onCancel={onCancel} />);
    const opener = screen.getByRole('button', { name: 'Clean now' });
    await user.click(opener);
    const dialog = screen.getByRole('alertdialog', { name: 'Clean the litter box now?' });
    // Modal: everything outside the dialog is hidden from assistive tech.
    expect(opener.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(dialog).toHaveAccessibleDescription('The drum turns once.');
    await user.click(within(dialog).getByRole('button', { name: 'Clean' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it('cancels with the Cancel button', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<DialogHarness onConfirm={onConfirm} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Clean now' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancels on Escape and traps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<DialogHarness onConfirm={onConfirm} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Clean now' }));
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Clean' });
    await waitFor(() => expect(cancel).toHaveFocus());
    await user.tab();
    expect(confirm).toHaveFocus();
    // Base UI wraps the popup in focus guards that send focus back around.
    await user.tab();
    await waitFor(() => expect(cancel).toHaveFocus());
    await user.tab({ shift: true });
    await waitFor(() => expect(confirm).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('ignores Escape and disables its buttons while busy', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        busy
        title="Pack waste?"
        confirmLabel="Pack"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      >
        Seals the bag.
      </ConfirmDialog>,
    );
    await user.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pack' })).toBeDisabled();
  });
});

describe('CollapsiblePanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('remembers its open state across a remount', async () => {
    const user = userEvent.setup();
    const panel = (
      <CollapsiblePanel title="Debug info" storageKey="test.debug.open">
        <span>raw state</span>
      </CollapsiblePanel>
    );
    const first = render(panel);
    const toggle = screen.getByRole('button', { name: 'Debug info' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('raw state')).toBeVisible();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    first.unmount();

    render(panel);
    expect(screen.getByRole('button', { name: 'Debug info' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByText('raw state')).not.toBeVisible();
  });

  it('falls back to its default when the stored value is not a boolean', () => {
    window.localStorage.setItem('mp.test.bad', JSON.stringify('yes'));
    render(
      <CollapsiblePanel title="Bad" storageKey="test.bad" defaultOpen={false}>
        body
      </CollapsiblePanel>,
    );
    expect(screen.getByRole('button', { name: 'Bad' })).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('HouseholdDayStrip', () => {
  it('maps minutes since midnight to x%', () => {
    expect(minuteToPercent(0)).toBe(0);
    expect(minuteToPercent(720)).toBe(50);
    expect(minuteToPercent(1440)).toBe(100);
    expect(minuteToPercent(887)).toBeCloseTo(61.597, 3);
    expect(minuteToPercent(-30)).toBe(0);
    expect(minuteToPercent(2000)).toBe(100);
    expect(minuteToPercent(Number.NaN)).toBe(0);
    expect(spanAt(600, 300).width).toBe('0%');
  });

  it('places visits, meals, the fountain spans and the now line', () => {
    const lanes: DayStripLane[] = [
      {
        kind: 'pet',
        id: 'p0',
        name: 'Cat A',
        petIndex: 0,
        visits: [{ minute: 360, title: '06:00 visit' }],
      },
      {
        kind: 'feeder',
        id: 'f',
        name: 'Feeder',
        meals: [{ minute: 1080, fed: false, title: '18:00 planned' }],
      },
      {
        kind: 'fountain',
        id: 'w',
        name: 'Fountain',
        spans: [
          { start: 0, end: 360, state: 'reporting', title: 'Reporting' },
          { start: 360, end: 720, state: 'no-report', title: 'No report' },
        ],
      },
    ];
    const { container } = render(<HouseholdDayStrip label="Today" lanes={lanes} nowMinute={720} />);
    expect(screen.getByRole('img', { name: '06:00 visit' })).toHaveStyle({ left: '25%' });
    const meal = screen.getByRole('img', { name: '18:00 planned' });
    expect(meal).toHaveStyle({ left: '75%' });
    expect(meal).not.toHaveClass('ui-strip__meal--fed');
    expect(screen.getByRole('img', { name: 'Reporting' })).toHaveStyle({
      left: '0%',
      width: '25%',
    });
    expect(screen.getByRole('img', { name: 'No report' })).toHaveStyle({
      left: '25%',
      width: '25%',
    });
    const nowLines = container.querySelectorAll<HTMLElement>('.ui-strip__now');
    expect(nowLines).toHaveLength(3);
    nowLines.forEach(line => {
      expect(line).toHaveStyle({ left: '50%' });
    });
    expect(screen.getByText('12:00')).toHaveClass('ui-strip__now-label');
  });

  it('draws no now line for a past day and cycles pet inks by index', () => {
    const { container } = render(
      <HouseholdDayStrip
        label="Yesterday"
        lanes={[{ kind: 'pet', id: 'p2', name: 'Cat C', petIndex: 2, visits: [{ minute: 60 }] }]}
      />,
    );
    expect(container.querySelector('.ui-strip__now')).toBeNull();
    expect(screen.getByRole('img', { name: 'Visit at 01:00' })).toHaveClass(
      `ui-pet-ink-${petSlot(2)}`,
    );
  });
});

describe('value helpers', () => {
  it('clamps ratio bars and parses number inputs', () => {
    expect(ratioPercent(35, 65)).toBeCloseTo(53.85, 2);
    expect(ratioPercent(80, 65)).toBe(100);
    expect(ratioPercent(null, 65)).toBe(0);
    expect(ratioPercent(5, 0)).toBe(0);
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('0')).toBe(0);
    expect(parseNumberInput('abc')).toBeNull();
  });
});
