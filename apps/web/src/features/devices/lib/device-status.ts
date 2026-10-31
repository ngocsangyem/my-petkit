import type { components } from '@/api/schema';
import { i18n } from '@/i18n';
import { formatEntityValue } from '@/shared/format/format';
import type { DeviceStatus } from '@/shared/ui';
import {
  CONSUMABLES,
  CONSUMABLE_WARN_DAYS,
  type ConsumableKey,
  type DeviceFamily,
  PROBLEM_FLAGS,
  consumableLabel,
  deviceFamily,
  problemFlagText,
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
      ? { status: 'unknown', label: i18n.t('devices:status.unknown') }
      : { status: 'offline', label: i18n.t('devices:status.offline') };
  }
  return d.mqtt_connected
    ? { status: 'online', label: i18n.t('devices:status.onlineMqtt') }
    : { status: 'polling', label: i18n.t('devices:status.polling') };
}

/**
 * An accessory has no session and no heartbeat queue: everything reaches it over
 * Bluetooth through its parent. Without that parent on the network it is not
 * idle, it is unaddressable, so the parent's state decides.
 */
export function accessoryStatus(a: Accessory): { status: DeviceStatus; label: string } {
  if (!a.link_with || !a.parent_name) {
    return { status: 'unknown', label: i18n.t('devices:status.noParent') };
  }
  if (!a.parent_online) return { status: 'offline', label: i18n.t('devices:status.offline') };
  return a.last_seen
    ? { status: 'online', label: i18n.t('devices:status.onlineBluetooth') }
    : { status: 'unknown', label: i18n.t('devices:status.neverReported') };
}

/** One "needs you" fact, coloured by how bad it is. */
export interface Attention {
  text: string;
  tone: 'negative' | 'warning';
}

/** "06:10" today, else "2026-10-27", in the device's zone (or the ISO date without one). */
function sinceWhen(at: number, zone: DeviceZone | null, nowSeconds: number): string {
  if (!zone) return new Date(at * 1000).toISOString().slice(0, 10);
  return localDateKey(at, zone) === localDateKey(nowSeconds, zone)
    ? localClock(at, zone)
    : localDateKey(at, zone);
}

/** Days-left consumables that are running low, worst first. */
export function lowConsumables(
  detail: Detail,
): { key: ConsumableKey; label: string; days: number }[] {
  const out: { key: ConsumableKey; label: string; days: number }[] = [];
  for (const key of CONSUMABLES) {
    const days = numericValue(findEntity(detail.entities, key));
    if (days !== null && days <= CONSUMABLE_WARN_DAYS) {
      out.push({ key, label: consumableLabel(key), days });
    }
  }
  return out.sort((a, b) => a.days - b.days);
}

/** "Filter in 3 days" (or "… runs out in 3 days" with `runsOut`), "Filter used up". */
export function consumableText(label: string, days: number, runsOut = false): string {
  if (days <= 0) return i18n.t('devices:consumable.usedUp', { label });
  return runsOut
    ? i18n.t('devices:consumable.runsOutIn', { label, count: days })
    : i18n.t('devices:consumable.inDays', { label, count: days });
}

/**
 * What is wrong with a device beyond running low: silent, an error, a problem flag. Null when
 * nothing is; consumables are left to {@link lowConsumables}.
 */
export function problemFor(
  d: Pick<Summary, 'online' | 'last_heartbeat' | 'last_state_report' | 'last_seen' | 'last_mqtt'>,
  detail: Detail | undefined,
  zone: DeviceZone | null,
  nowSeconds: number,
): Attention | null {
  const last = lastReport(d);
  if (!d.online && last !== null) {
    return {
      text: i18n.t('devices:problem.noReportSince', { when: sinceWhen(last, zone, nowSeconds) }),
      tone: 'negative',
    };
  }
  if (!detail) return null;
  const error = findEntity(detail.entities, 'error');
  if (error && typeof error.value === 'string' && error.value.trim() !== '') {
    return { text: error.value, tone: 'negative' };
  }
  for (const flag of PROBLEM_FLAGS) {
    if (binaryOn(findEntity(detail.entities, flag))) {
      return { text: problemFlagText(flag), tone: 'warning' };
    }
  }
  return null;
}

/** The first thing a person needs to act on for this device, or null. */
export function attentionFor(
  d: Summary,
  detail: Detail | undefined,
  zone: DeviceZone | null,
  nowSeconds: number,
): Attention | null {
  const problem = problemFor(d, detail, zone, nowSeconds);
  if (problem || !detail) return problem;
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
  if (family === 'feeder' && nextMeal) return i18n.t('devices:now.nextMeal', { clock: nextMeal });
  const status = findEntity(detail.entities, 'device_status');
  const text =
    status && status.value !== null && status.value !== undefined
      ? formatEntityValue(entityLike(status)).text
      : null;
  if (family === 'litter' && zone) {
    const raw = findEntity(detail.entities, 'last_clean')?.value;
    const cleaned = typeof raw === 'number' || typeof raw === 'string' ? epochSeconds(raw) : null;
    if (cleaned !== null) {
      const clock = localClock(cleaned, zone);
      return text
        ? i18n.t('devices:now.statusCleaned', { status: capitalise(text), clock })
        : i18n.t('devices:now.cleaned', { clock });
    }
  }
  return text ? capitalise(text) : null;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
