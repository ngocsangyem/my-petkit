import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { historyDates, type PetDay } from '../pet-history-model';
import { PetWeightChartCard } from './pet-weight-chart-card';

/** Fourteen days ending 2026-10-31, weighed only on the given ones (index into the span). */
function days(weighed: ReadonlyMap<number, number>): PetDay[] {
  return historyDates('2026-10-31').map((date, i) => ({
    date,
    visits: weighed.has(i) ? 1 : 0,
    weightG: weighed.get(i) ?? null,
  }));
}

describe('PetWeightChartCard', () => {
  it('places a reading at its calendar day, so a gap in the readings keeps its width', () => {
    // Weighed on the first and the seventh of fourteen days: the latest reading sits 6/13 of the
    // way along the date axis, not at its right edge as it would by counting readings.
    const { container } = render(
      <PetWeightChartCard
        name="Miso"
        days={days(
          new Map([
            [0, 5400],
            [6, 5440],
          ]),
        )}
        registeredG={null}
        isPending={false}
      />,
    );
    expect(screen.getByRole('img', { name: /Miso's weight over 14 days/ })).toBeInTheDocument();
    const dot = container.querySelector<HTMLElement>('span.bg-data');
    expect(dot).not.toBeNull();
    expect(Number.parseFloat(dot?.style.left ?? '')).toBeCloseTo((6 / 13) * 100, 3);
  });
});
