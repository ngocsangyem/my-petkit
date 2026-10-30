import { describe, expect, it } from 'vitest';
import type { AnyEntity } from '../lib/entity-sections';
import { drawingLevels } from './device-art';

const entity = (key: string, value: unknown) => ({ key, value }) as unknown as AnyEntity;

describe('drawing levels', () => {
  it('reads both hoppers of a dual feeder as 0 empty, 2 has food', () => {
    expect(drawingLevels('d4sh', [entity('hopper1_level', 2), entity('hopper2_level', 0)])).toEqual(
      [70, 0],
    );
  });

  it('falls back to the food-low flag for a single hopper without a level', () => {
    expect(drawingLevels('d4h', [entity('food_low', 1)])).toEqual([15]);
    expect(drawingLevels('d4h', [entity('hopper_level', 2)])).toEqual([70]);
    expect(drawingLevels('d4h', [])).toEqual([null]);
  });

  it('reads whichever water-lack flag a fountain model publishes', () => {
    expect(drawingLevels('w5', [entity('w5_water_missing', 0)])).toEqual([70]);
    expect(drawingLevels('ctw3', [entity('ctw3_water_lack', 1)])).toEqual([15]);
    expect(drawingLevels('w7h', [])).toEqual([null]);
  });

  it('draws the litter percentage as reported', () => {
    expect(drawingLevels('t6', [entity('litter_percent', 62)])).toEqual([62]);
  });
});
