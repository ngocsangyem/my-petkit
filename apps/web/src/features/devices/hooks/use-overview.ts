import type { UseQueryResult } from '@tanstack/react-query';
import { type ReactNode, useMemo } from 'react';
import { i18n, useLocale } from '@/i18n';
import type { DeviceStatus } from '@/shared/ui';
import type {
  BleAccessory,
  DeviceDetail,
  DeviceSummary,
  PetWithFaces,
  TimelineSession,
} from '../api';
import { buildStrip, type StripModel } from '../lib/day-strip-lanes';
import { deviceFamily } from '../lib/device-family';
import {
  accessoryStatus,
  type Attention,
  attentionFor,
  deviceStatus,
  nowText,
} from '../lib/device-status';
import { type DeviceZone, deviceZone, localDateKey, minuteOfDay } from '../lib/device-zone';
import { nextMealClock, todaysMeals } from '../lib/feed-plan';
import type { AnyEntity } from '../lib/entity-sections';
import { epochSeconds, lastReport } from '../lib/timestamps';

/** One device or accessory of Home, already worked out. */
export interface DeviceRow {
  /** `d<id>` or `a<id>`: the device page's key. */
  key: string;
  kind: 'device' | 'accessory';
  name: string;
  /** Codename, for the drawing. */
  type: string;
  model: string;
  id: string;
  status: { status: DeviceStatus; label: string };
  now: string | null;
  attention: Attention | null;
  lastReport: number | null;
  /** True while the device reports over MQTT (false on the heartbeat or for an accessory). */
  mqtt: boolean;
  /** The relay of an accessory, by name. */
  parentName: string | null;
  /** Entities whose values the drawing reads; empty until the detail has loaded. */
  entities: readonly AnyEntity[];
}

interface OverviewInput {
  devices: readonly DeviceSummary[];
  accessories: readonly BleAccessory[];
  detailQueries: readonly UseQueryResult<DeviceDetail>[];
  sessions: readonly TimelineSession[];
  pets: readonly PetWithFaces[];
  nowSeconds: number;
  avatarFor: (pet: PetWithFaces) => ReactNode;
}

export interface Overview {
  detailById: Map<number, UseQueryResult<DeviceDetail>>;
  rows: DeviceRow[];
  /** Null until some device has said which zone it lives in. */
  strip: StripModel | null;
  homeZone: DeviceZone | null;
  visitsByDevice: Map<number, number>;
}

/** Everything the overview derives from the device list, details, sessions and pets. */
export function useOverview(input: OverviewInput): Overview {
  const { devices, accessories, detailQueries, sessions, pets, nowSeconds, avatarFor } = input;
  // Rows and lanes carry translated, locale-formatted text: a language change rebuilds them.
  const locale = useLocale();
  return useMemo(() => {
    const detailById = new Map<number, UseQueryResult<DeviceDetail>>();
    const details = new Map<number, DeviceDetail>();
    devices.forEach((d, i) => {
      const q = detailQueries[i];
      if (!q) return;
      detailById.set(d.id, q);
      if (q.data) details.set(d.id, q.data);
    });
    const zones = new Map<number, DeviceZone>();
    for (const [id, detail] of details) {
      const z = deviceZone(detail.timezoneInfo);
      if (z) zones.set(id, z);
    }
    const zoneOf = (id: number) => zones.get(id) ?? null;
    // The axis and the now line use the first device's zone: in a household
    // every device normally shares one. Each mark is placed in its own device's zone.
    const homeZone = devices.map(d => zones.get(d.id)).find(z => z !== undefined) ?? null;

    const visitsByDevice = new Map<number, number>();
    for (const s of sessions) {
      if (s.kind !== 'visit' || s.device_id === null) continue;
      const zone = zones.get(s.device_id);
      const at = s.display_ts ?? s.ts;
      if (!zone || at === null || localDateKey(at, zone) !== localDateKey(nowSeconds, zone))
        continue;
      visitsByDevice.set(s.device_id, (visitsByDevice.get(s.device_id) ?? 0) + 1);
    }

    const rows: DeviceRow[] = [];
    for (const d of devices) {
      const detail = details.get(d.id);
      const zone = zoneOf(d.id);
      const next =
        detail && zone && deviceFamily(d.type) === 'feeder'
          ? nextMealClock(todaysMeals(detail, zone, nowSeconds), minuteOfDay(nowSeconds, zone))
          : null;
      rows.push({
        key: `d${d.id}`,
        kind: 'device',
        name: d.name,
        type: d.type,
        mqtt: d.online && d.mqtt_connected,
        parentName: null,
        entities: detail?.entities ?? [],
        model: d.type.toUpperCase(),
        id: String(d.id),
        status: deviceStatus(d),
        now: nowText(detail, zone, next),
        attention: attentionFor(d, detail, zone, nowSeconds),
        lastReport: lastReport(d),
      });
      for (const a of accessories.filter(x => x.link_with === d.id)) rows.push(accessoryRow(a));
    }
    for (const a of accessories.filter(x => !devices.some(d => d.id === x.link_with))) {
      rows.push(accessoryRow(a));
    }

    const strip = homeZone
      ? buildStrip({
          devices,
          details,
          accessories,
          sessions,
          pets,
          zoneOf,
          homeZone,
          nowSeconds,
          avatarFor,
        })
      : null;
    return { detailById, rows, strip, homeZone, visitsByDevice };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `locale` is read through i18n inside
  }, [devices, accessories, detailQueries, sessions, pets, nowSeconds, avatarFor, locale]);
}

function accessoryRow(a: BleAccessory): DeviceRow {
  return {
    key: `a${a.petkit_id}`,
    kind: 'accessory',
    name: a.name,
    type: a.ble_type,
    mqtt: false,
    parentName: a.parent_name || null,
    entities: a.entities,
    model: a.parent_name
      ? i18n.t('devices:overview.relayedBy', {
          type: a.ble_type.toUpperCase(),
          parent: a.parent_name,
        })
      : a.ble_type.toUpperCase(),
    id: String(a.petkit_id),
    status: accessoryStatus(a),
    now: null,
    attention:
      !a.link_with || !a.parent_name
        ? { text: i18n.t('devices:overview.noParent'), tone: 'warning' }
        : null,
    lastReport: epochSeconds(a.last_seen),
  };
}
