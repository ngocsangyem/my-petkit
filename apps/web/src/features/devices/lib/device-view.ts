import { useLocation, useSearchParams } from 'react-router';

/**
 * Which part of the Devices screen is shown. Everything lives on the one `devices` route: Home
 * when no device is named, otherwise a device page (`?device=d<id>` for a device, `a<id>` for a
 * Bluetooth accessory), its live view or its schedules. A search parameter rather than a route,
 * so a reload or a shared link reopens the same page and the route table stays as it is.
 */
export type DeviceSubview = 'live' | 'schedules';

export interface DeviceView {
  /** `d<id>` or `a<id>`, or null on Home. */
  key: string | null;
  sub: DeviceSubview | null;
}

const SUBVIEWS: readonly DeviceSubview[] = ['live', 'schedules'];

/** Only a well-formed key is read; anything else is Home. */
function parseKey(raw: string | null): string | null {
  return raw && /^[ad]\d+$/.test(raw) ? raw : null;
}

export function useDeviceView(): DeviceView {
  const [params] = useSearchParams();
  const key = parseKey(params.get('device'));
  const raw = params.get('view');
  const sub = key && SUBVIEWS.find(s => s === raw);
  return { key, sub: sub || null };
}

/** Links within the Devices screen, relative to wherever it is mounted. */
export function useDeviceLinks() {
  const { pathname } = useLocation();
  return {
    home: pathname,
    device: (key: string, sub?: DeviceSubview) =>
      `${pathname}?device=${encodeURIComponent(key)}${sub ? `&view=${sub}` : ''}`,
  };
}

/**
 * True when the schedules view has something to show: a schedule the server says the device has,
 * or a feeder's one-off feeds, which every feeder takes even with no schedule of its own.
 */
export const hasSchedulesView = (d: { schedules: readonly unknown[]; is_feeder: boolean }) =>
  d.schedules.length > 0 || d.is_feeder;

export const deviceKeyOf = (id: number) => `d${id}`;
export const accessoryKeyOf = (id: number) => `a${id}`;
