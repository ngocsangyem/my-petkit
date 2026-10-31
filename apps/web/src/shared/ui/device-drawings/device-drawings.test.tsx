import { render, screen } from '@testing-library/react';
import { levelFraction } from './drawing-frame';
import { FeederDrawing } from './feeder-drawing';
import { FountainDrawing } from './fountain-drawing';
import { LitterBoxDrawing } from './litter-box-drawing';
import { SprayDrawing } from './spray-drawing';

/** The filled shapes of one part ("litter", "food", "water") inside a named drawing. */
function parts(name: string, part: string): Element[] {
  return Array.from(screen.getByRole('img', { name }).querySelectorAll(`[data-part="${part}"]`));
}

describe('levelFraction', () => {
  it('clamps to 0..1 and reads missing or non-finite as no level', () => {
    expect(levelFraction(62)).toBe(0.62);
    expect(levelFraction(0)).toBe(0);
    expect(levelFraction(140)).toBe(1);
    expect(levelFraction(-5)).toBe(0);
    expect(levelFraction(null)).toBeNull();
    expect(levelFraction(undefined)).toBeNull();
    expect(levelFraction(Number.NaN)).toBeNull();
  });
});

describe('device drawings', () => {
  it('fills the litter box drum to its level and leaves it empty when the level is missing', () => {
    render(
      <>
        <LitterBoxDrawing level={62} title="Litter 62%" />
        <LitterBoxDrawing level={null} title="Litter unknown" />
      </>,
    );
    const [litter] = parts('Litter 62%', 'litter');
    // 82 - 64 * 0.62 * 0.6 = 58.192
    expect(litter).toHaveAttribute('y', '58.2');
    expect(parts('Litter unknown', 'litter')).toHaveLength(0);
  });

  it('draws one window per hopper, each filled to its own level', () => {
    render(
      <>
        <FeederDrawing levels={[70, 35]} title="Dual feeder" />
        <FeederDrawing levels={[undefined, 100]} title="Left hopper unknown" />
        <FeederDrawing levels={[50]} title="Single feeder" />
      </>,
    );
    const heights = parts('Dual feeder', 'food').map(el => el.getAttribute('height'));
    expect(heights).toEqual(['23.8', '11.9']);
    expect(parts('Left hopper unknown', 'food')).toHaveLength(1);
    const [single] = parts('Single feeder', 'food');
    expect(single).toHaveAttribute('width', '40');
    expect(single).toHaveAttribute('height', '17.0');
  });

  it('fills the fountain tank to its water level and draws no water when it is missing', () => {
    render(
      <>
        <FountainDrawing level={40} title="Water 40%" />
        <FountainDrawing level={undefined} title="Water unknown" />
      </>,
    );
    expect(parts('Water 40%', 'water')[0]).toHaveAttribute('y', '62.0');
    expect(parts('Water unknown', 'water')).toHaveLength(0);
  });

  it('is decorative without a title and named with one', () => {
    const { container } = render(<SprayDrawing size={40} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    render(<SprayDrawing title="Pura Air spray" />);
    expect(screen.getByRole('img', { name: 'Pura Air spray' })).toHaveAttribute('width', '104');
  });
});
