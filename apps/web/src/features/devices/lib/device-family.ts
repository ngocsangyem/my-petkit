// Device families, by codename. Mirrors the type sets in the server's
// `utils/const.py` (DEVICE_TYPES_LITTER / _FEEDER / _WATER_FOUNTAIN / _PURIFIER).
import { i18n } from '@/i18n';

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

/** What the household calls one of these, in the active language. */
export function familyNoun(family: DeviceFamily): string {
  return i18n.t(`devices:family.${family}`);
}

/** One figure of a model block: an entity key and the label it gets. */
export interface FigureSpec {
  key: string;
  label: string;
  /** Words for a binary entity, off then on. */
  binary?: readonly [string, string];
}

/**
 * The figures a model block shows, by family, labelled in the active language. Only figures
 * whose entity the device actually publishes are drawn, so a model with fewer sensors gets
 * fewer cells rather than empty ones.
 */
export function figuresFor(family: DeviceFamily): readonly FigureSpec[] {
  switch (family) {
    case 'litter':
      return [
        { key: 'package_count', label: i18n.t('devices:figure.bagsLeft') },
        { key: 'litter_percent', label: i18n.t('devices:figure.litterLevel') },
        {
          key: 'waste_bin',
          label: i18n.t('devices:figure.wasteBin'),
          binary: [i18n.t('devices:figure.notFull'), i18n.t('devices:figure.full')],
        },
      ];
    case 'feeder':
      return [
        { key: 'food_in_bowl', label: i18n.t('devices:figure.inBowl') },
        { key: 'amount_eaten', label: i18n.t('devices:figure.eatenToday') },
        { key: 'total_dispensed', label: i18n.t('devices:figure.fedToday') },
        {
          key: 'food_low',
          label: i18n.t('devices:figure.hopper'),
          binary: [i18n.t('devices:figure.hasFood'), i18n.t('devices:figure.low')],
        },
      ];
    case 'fountain':
      return [
        { key: 'water_level', label: i18n.t('devices:figure.water') },
        { key: 'filter_percent', label: i18n.t('devices:figure.filter') },
        { key: 'drink_times', label: i18n.t('devices:figure.drinksToday') },
        { key: 'temperature', label: i18n.t('devices:figure.water') },
        {
          key: 'water_lack',
          label: i18n.t('devices:figure.waterLevel'),
          binary: [i18n.t('devices:figure.ok'), i18n.t('devices:figure.low')],
        },
      ];
    default:
      return [];
  }
}

/** Days-left consumables (entity keys), in the order the design lists them. */
export const CONSUMABLES = [
  'n60_spray_days',
  'n50_durability', // gitleaks:allow (an entity key, not a secret)
  'desiccant_days',
  'filter_days',
] as const;

export type ConsumableKey = (typeof CONSUMABLES)[number];

/** A consumable's name in the active language. */
export function consumableLabel(key: ConsumableKey): string {
  return i18n.t(`devices:consumable.${key}`);
}

/** A days-left bar is drawn against this many days: a fresh refill reads as full. */
export const CONSUMABLE_SCALE_DAYS = 30;

/** At or under this many days a consumable "needs you". */
export const CONSUMABLE_WARN_DAYS = 7;

/** Problem flags (entity keys) that, when on, are the thing a person needs to know first. */
export const PROBLEM_FLAGS = ['waste_bin', 'food_low', 'water_lack', 'replace_filter'] as const;

/** What an "on" problem flag means, in the active language. */
export function problemFlagText(flag: (typeof PROBLEM_FLAGS)[number]): string {
  return i18n.t(`devices:problem.${flag}`);
}

/** BLE accessory types that are fountains, for the day strip's fountain lane. */
export function isFountainType(type: string): boolean {
  return deviceFamily(type) === 'fountain';
}
