import type { components } from '@/api/schema';
import { i18n } from '@/i18n';
import type { EntityLike } from '@/shared/format/format';

export type DeviceEntity = components['schemas']['DeviceEntity'];
export type BleEntity = components['schemas']['BleAccessoryEntity'];
/** The fields every entity has, device or accessory. */
export type AnyEntity = DeviceEntity | BleEntity;

/**
 * Which part of a device panel each Home Assistant component lands in. Declared
 * rather than implied by a chain of filters, so a component that gains no home
 * shows up in the "Not shown above" block instead of silently vanishing from the
 * panel while still being published to Home Assistant.
 *
 * - `time` and `text` sit with the schedules: "when does it flush" and "when is it
 *   quiet" are one question to the owner, so the schedules block renders them.
 * - `event` has no block of its own: it is momentary and keeps no value, so it is
 *   only listed under "Show every entity". What happened is the Timeline's job.
 */
export const ENTITY_SECTION: Readonly<Record<string, string>> = {
  sensor: 'state',
  binary_sensor: 'state',
  switch: 'controls',
  number: 'controls',
  select: 'controls',
  time: 'schedules',
  text: 'schedules',
  button: 'actions',
  event: 'entity-list-only',
  camera: 'camera',
  image: 'camera',
};

/**
 * Settings the AI block owns: what the NPU is asked to look for. They move there
 * only when the device HAS that block (`supports_ai`): a feeder shares
 * `pet_detection` with the fountain but has no on-device AI, and moving it
 * unconditionally would delete the switch rather than move it.
 */
export const AI_ENTITY_KEYS: readonly string[] = [
  'yowling_detection',
  'ph_detection',
  'pet_detection',
  'drink_detection',
  'vomit_detection',
];

/** Explanation shown under a control, only where the label is not enough; else undefined. */
export function entityHelp(key: string): string | undefined {
  switch (key) {
    case 'yowling_detection':
      return i18n.t('devices:entityHelp.yowlingDetection');
    case 'ph_detection':
      return i18n.t('devices:entityHelp.phDetection');
    case 'vomit_detection':
      return i18n.t('devices:entityHelp.vomitDetection');
    default:
      return undefined;
  }
}

/** `option_values` as a list; the contract allows an object, which no entity uses as a map. */
export function optionValues(entity: AnyEntity): readonly unknown[] | null {
  return Array.isArray(entity.option_values) ? entity.option_values : null;
}

/** The entity in the shape `formatEntityValue` reads. */
export function entityLike(entity: AnyEntity): EntityLike {
  return {
    value: entity.value,
    unit: entity.unit,
    options: entity.options,
    option_values: optionValues(entity),
    component: entity.component,
    device_class: entity.device_class,
  };
}

/** `config`/`diagnostic` entities sort last within their block, the way HA groups them. */
function byCategory(a: AnyEntity, b: AnyEntity): number {
  return (a.entity_category ? 1 : 0) - (b.entity_category ? 1 : 0);
}

/** A device's entities split into the blocks of its panel. */
export interface EntityGroups {
  sensors: DeviceEntity[];
  controls: DeviceEntity[];
  aiControls: DeviceEntity[];
  media: DeviceEntity[];
  unrouted: DeviceEntity[];
}

export function groupDeviceEntities(
  entities: readonly DeviceEntity[],
  supportsAi: boolean,
): EntityGroups {
  const section = (e: DeviceEntity) => ENTITY_SECTION[e.component];
  // Capability switches have their own block, and AI detections live in the AI
  // block; both are excluded from Controls or they would appear twice.
  const isAi = (e: DeviceEntity) => supportsAi && AI_ENTITY_KEYS.includes(e.key);
  const relocated = (e: DeviceEntity) => e.value_path.startsWith('capabilities.') || isAi(e);
  return {
    sensors: entities
      .filter(e => section(e) === 'state' && !e.key.startsWith('hall_'))
      .sort(byCategory),
    controls: entities.filter(e => section(e) === 'controls' && !relocated(e)).sort(byCategory),
    aiControls: entities.filter(e => section(e) === 'controls' && isAi(e)),
    media: entities.filter(e => section(e) === 'camera'),
    unrouted: entities.filter(e => section(e) === undefined),
  };
}

/** The entity with `key`, if the device publishes it. */
export function findEntity<E extends AnyEntity>(
  entities: readonly E[],
  key: string,
): E | undefined {
  return entities.find(e => e.key === key);
}

/** A number out of an entity value, or null. */
export function numericValue(entity: AnyEntity | undefined): number | null {
  if (!entity) return null;
  const v = entity.value;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Whether a binary entity reads "on" (same rule as the value formatter); null when unset. */
export function binaryOn(entity: AnyEntity | undefined): boolean | null {
  if (!entity || entity.value === null || entity.value === undefined) return null;
  const v = entity.value;
  return !(v === 0 || v === '0' || v === false);
}
