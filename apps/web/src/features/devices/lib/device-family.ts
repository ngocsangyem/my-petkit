// Device families, by codename. Mirrors the type sets in the server's
// `utils/const.py` (DEVICE_TYPES_LITTER / _FEEDER / _WATER_FOUNTAIN / _PURIFIER).

export type DeviceFamily = 'litter' | 'feeder' | 'fountain' | 'purifier' | 'other';

const FAMILIES: Readonly<Record<string, DeviceFamily>> = {
  t3: 'litter',
  t4: 'litter',
  t5: 'litter',
  t6: 'litter',
  t7: 'litter',
  feeder: 'feeder',
  feedermini: 'feeder',
  d3: 'feeder',
  d4: 'feeder',
  d4s: 'feeder',
  d4h: 'feeder',
  d4sh: 'feeder',
  w4: 'fountain',
  w5: 'fountain',
  ctw2: 'fountain',
  ctw3: 'fountain',
  w7h: 'fountain',
  k2: 'purifier',
  k3: 'purifier',
};

export function deviceFamily(type: string): DeviceFamily {
  return FAMILIES[type.toLowerCase()] ?? 'other';
}

/** What the household calls one of these. */
export const FAMILY_NOUN: Readonly<Record<DeviceFamily, string>> = {
  litter: 'Litter box',
  feeder: 'Feeder',
  fountain: 'Water fountain',
  purifier: 'Air purifier',
  other: 'Device',
};

/** One figure of a model block: an entity key and the label it gets. */
export interface FigureSpec {
  key: string;
  label: string;
  /** Words for a binary entity, off then on. */
  binary?: readonly [string, string];
}

/**
 * The figures a model block shows, by family. Only figures whose entity the
 * device actually publishes are drawn, so a model with fewer sensors gets fewer
 * cells rather than empty ones.
 */
export const FIGURES: Readonly<Record<DeviceFamily, readonly FigureSpec[]>> = {
  litter: [
    { key: 'package_count', label: 'Bags left' },
    { key: 'litter_percent', label: 'Litter level' },
    { key: 'waste_bin', label: 'Waste bin', binary: ['Not full', 'Full'] },
  ],
  feeder: [
    { key: 'food_in_bowl', label: 'In the bowl' },
    { key: 'amount_eaten', label: 'Eaten today' },
    { key: 'total_dispensed', label: 'Fed today' },
    { key: 'food_low', label: 'Hopper', binary: ['Has food', 'Low'] },
  ],
  fountain: [
    { key: 'water_level', label: 'Water' },
    { key: 'filter_percent', label: 'Filter' },
    { key: 'drink_times', label: 'Drinks today' },
    { key: 'temperature', label: 'Water' },
    { key: 'water_lack', label: 'Water level', binary: ['OK', 'Low'] },
  ],
  purifier: [],
  other: [],
};

/** A consumable counted in days left. */
export interface ConsumableSpec {
  key: string;
  label: string;
}

/** Days-left consumables, in the order the design lists them. */
export const CONSUMABLES: readonly ConsumableSpec[] = [
  { key: 'n60_spray_days', label: 'N60 deodorizer' },
  { key: 'n50_durability', label: 'N50 deodorant' }, // gitleaks:allow (an entity key, not a secret)
  { key: 'desiccant_days', label: 'Desiccant' },
  { key: 'filter_days', label: 'Filter' },
];

/** A days-left bar is drawn against this many days: a fresh refill reads as full. */
export const CONSUMABLE_SCALE_DAYS = 30;

/** At or under this many days a consumable "needs you". */
export const CONSUMABLE_WARN_DAYS = 7;

/** Problem flags that, when on, are the thing a person needs to know first. */
export const PROBLEM_FLAGS: readonly { key: string; text: string }[] = [
  { key: 'waste_bin', text: 'Waste bin full' },
  { key: 'food_low', text: 'Food low' },
  { key: 'water_lack', text: 'Water low' },
  { key: 'replace_filter', text: 'Replace the filter' },
];

/** BLE accessory types that are fountains, for the day strip's fountain lane. */
export function isFountainType(type: string): boolean {
  return deviceFamily(type) === 'fountain';
}
