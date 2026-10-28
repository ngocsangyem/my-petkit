import type { components } from '@/api/schema';
import { formatEntityValue } from '@/shared/format/format';
import type { DeviceStatus } from '@/shared/ui';
import {
  CONSUMABLES,
  CONSUMABLE_WARN_DAYS,
  type DeviceFamily,
  PROBLEM_FLAGS,
  deviceFamily,
} from './device-family';
import { type DeviceZone, localClock, localDateKey } from './device-zone';
import { binaryOn, entityLike, findEntity, numericValue } from './entity-sections';
import { epochSeconds, lastReport } from './timestamps';

type Summary = components['schemas']['DeviceSummary'];
type Detail = components['schemas']['DeviceDetail'];
type Accessory = components['schemas']['BleAccessory'];

/** Status mark of a device: which transport a command will take, or why none will. */
export function deviceStatus(d: Summary | Detail): { status: DeviceStatus; label: string } {
  if (!d.online) {
    return lastReport(d) === null
      ? { status: 'unknown', label: 'Unknown' }
      : { status: 'offline', label: 'Offline' };
  }
  return d.mqtt_connected
    ? { status: 'online', label: 'Online · MQTT' }
    : { status: 'polling', label: 'Polling · heartbeat' };
}

/**
 * An accessory has no session and no heartbeat queue: everything reaches it over
 * Bluetooth through its parent. Without that parent on the network it is not
 * idle, it is unaddressable, so the parent's state decides.
 */
export function accessoryStatus(a: Accessory): { status: DeviceStatus; label: string } {
  if (!a.link_with || !a.parent_name) return { status: 'unknown', label: 'No parent' };
  if (!a.parent_online) return { status: 'offline', label: 'Offline' };
  return a.last_seen
    ? { status: 'online', label: 'Online · Bluetooth' }
    : { status: 'unknown', label: 'Never reported' };
}

/** One "needs you" fact, coloured by how bad it is. */
export interface Attention {
  text: string;
  tone: 'negative' | 'warning';
}

/** "since 06:10" today, else "since 2026-10-27", in the device's zone (or ISO date). */
function sinceText(at: number, zone: DeviceZone | null, nowSeconds: number): string {
  if (!zone) return `since ${new Date(at * 1000).toISOString().slice(0, 10)}`;
  return localDateKey(at, zone) === localDateKey(nowSeconds, zone)
    ? `since ${localClock(at, zone)}`
    : `since ${localDateKey(at, zone)}`;
}

/** Days-left consumables that are running low, worst first. */
export function lowConsumables(detail: Detail): { label: string; days: number }[] {
  const out: { label: string; days: number }[] = [];
  for (const c of CONSUMABLES) {
    const days = numericValue(findEntity(detail.entities, c.key));
    if (days !== null && days <= CONSUMABLE_WARN_DAYS) out.push({ label: c.label, days });
  }
  return out.sort((a, b) => a.days - b.days);
}

export function consumableText(label: string, days: number): string {
  if (days <= 0) return `${label} used up`;
  return `${label} in ${days} ${days === 1 ? 'day' : 'days'}`;
}

/** The first thing a person needs to act on for this device, or null. */
export function attentionFor(
  d: Summary,
  detail: Detail | undefined,
  zone: DeviceZone | null,
  nowSeconds: number,
): Attention | null {
  const last = lastReport(d);
  if (!d.online && last !== null) {
    return { text: `No report ${sinceText(last, zone, nowSeconds)}`, tone: 'negative' };
  }
  if (!detail) return null;
  const error = findEntity(detail.entities, 'error');
  if (error && typeof error.value === 'string' && error.value.trim() !== '') {
    return { text: error.value, tone: 'negative' };
  }
  for (const flag of PROBLEM_FLAGS) {
    if (binaryOn(findEntity(detail.entities, flag.key)))
      return { text: flag.text, tone: 'warning' };
  }
  const low = lowConsumables(detail)[0];
  return low ? { text: consumableText(low.label, low.days), tone: 'warning' } : null;
}

/** "Idle, cleaned 14:05" style line for the device list. */
export function nowText(
  detail: Detail | undefined,
  zone: DeviceZone | null,
  nextMeal: string | null,
): string | null {
  if (!detail) return null;
  const family: DeviceFamily = deviceFamily(detail.type);
  if (family === 'feeder' && nextMeal) return `Next meal ${nextMeal}`;
  const status = findEntity(detail.entities, 'device_status');
  const text =
    status && status.value !== null && status.value !== undefined
      ? formatEntityValue(entityLike(status)).text
      : null;
  if (family === 'litter' && zone) {
    const raw = findEntity(detail.entities, 'last_clean')?.value;
    const cleaned = typeof raw === 'number' || typeof raw === 'string' ? epochSeconds(raw) : null;
    if (cleaned !== null) {
      const at = `cleaned ${localClock(cleaned, zone)}`;
      return text ? `${capitalise(text)}, ${at}` : capitalise(at);
    }
  }
  return text ? capitalise(text) : null;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
