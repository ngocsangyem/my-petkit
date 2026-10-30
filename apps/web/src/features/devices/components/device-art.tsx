import {
  type DrawingLevel,
  FeederDrawing,
  FountainDrawing,
  LitterBoxDrawing,
  SprayDrawing,
} from '@/shared/ui';
import { deviceFamily } from '../lib/device-family';
import { type AnyEntity, binaryOn, findEntity, numericValue } from '../lib/entity-sections';

// A binary "has food / low" or "water OK / low" has no percentage. It is drawn at a
// level that reads as the state it reports (well filled, nearly empty) and never
// printed as a number; an unreported flag draws an empty vessel.
const ENOUGH = 70;
const LOW = 15;

function flagLevel(entity: AnyEntity | undefined): DrawingLevel {
  const low = binaryOn(entity);
  if (low === null) return null;
  return low ? LOW : ENOUGH;
}

/** A percentage entity when published, otherwise the low flag, otherwise empty. */
function level(entities: readonly AnyEntity[], percentKey: string, lowKey: string): DrawingLevel {
  const percent = numericValue(findEntity(entities, percentKey));
  return percent ?? flagLevel(findEntity(entities, lowKey));
}

/** The level a drawing shows for a device family, read from the device's own entities. */
export function drawingLevels(type: string, entities: readonly AnyEntity[]): DrawingLevel[] {
  switch (deviceFamily(type)) {
    case 'litter':
      return [numericValue(findEntity(entities, 'litter_percent'))];
    case 'feeder': {
      const first = level(entities, 'food_percent', 'food_low');
      const second = findEntity(entities, 'food_low_2') ?? findEntity(entities, 'food2_low');
      return second ? [first, flagLevel(second)] : [first];
    }
    case 'fountain':
      return [level(entities, 'water_level', 'water_lack')];
    default:
      return [];
  }
}

interface DeviceArtProps {
  /** Codename, e.g. `t6`, `d4sh`, `k3`. */
  type: string;
  entities: readonly AnyEntity[];
  /** A dual-hopper feeder draws two windows even before the second level is known. */
  dual?: boolean;
  size?: number;
  /** Accessible name; without it the drawing is decorative. */
  title?: string;
  className?: string;
}

/** The line drawing of a device at its real state; null for a family with no drawing. */
export function DeviceArt({ type, entities, dual, size, title, className }: DeviceArtProps) {
  const family = deviceFamily(type);
  const levels = drawingLevels(type, entities);
  const frame = { size, title, className };
  switch (family) {
    case 'litter':
      return <LitterBoxDrawing level={levels[0]} {...frame} />;
    case 'feeder': {
      const shown = dual && levels.length < 2 ? [levels[0] ?? null, null] : levels;
      return <FeederDrawing levels={shown.length ? shown : [null]} {...frame} />;
    }
    case 'fountain':
      return <FountainDrawing level={levels[0]} {...frame} />;
    case 'purifier':
      return <SprayDrawing {...frame} />;
    default:
      return null;
  }
}
