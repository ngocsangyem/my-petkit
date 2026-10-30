import type { BleAccessory, DeviceSummary } from '../api';

/** Devices and accessories in display order: each accessory follows the device that relays for it. */
export type PanelEntry =
  { kind: 'device'; device: DeviceSummary } | { kind: 'accessory'; accessory: BleAccessory };

export function panelOrder(
  devices: readonly DeviceSummary[],
  accessories: readonly BleAccessory[],
): PanelEntry[] {
  const out: PanelEntry[] = [];
  for (const device of devices) {
    out.push({ kind: 'device', device });
    for (const accessory of accessories.filter(a => a.link_with === device.id)) {
      out.push({ kind: 'accessory', accessory });
    }
  }
  for (const accessory of accessories.filter(a => !devices.some(d => d.id === a.link_with))) {
    out.push({ kind: 'accessory', accessory });
  }
  return out;
}

/** The key of a device page (`d<id>`) or an accessory page (`a<id>`), and of its open state. */
export const panelKey = (e: PanelEntry) =>
  e.kind === 'device' ? `d${e.device.id}` : `a${e.accessory.petkit_id}`;
