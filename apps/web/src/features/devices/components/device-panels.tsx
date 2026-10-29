import type { UseQueryResult } from '@tanstack/react-query';
import { errorMessage } from '@/shared/api/errors';
import { relativeTime } from '@/shared/format/format';
import { ErrorBlock, Skeleton, StatusMark } from '@/shared/ui';
import type { BleAccessory, DeviceDetail, DeviceSummary, PetWithFaces } from '../api';
import type { OpenState, SetOpen } from '../hooks/use-open-state';
import { accessoryStatus, deviceStatus } from '../lib/device-status';
import { epochSeconds, lastReport } from '../lib/timestamps';
import { AccessoryPanelBody } from './accessory-panel-body';
import { DevicePanelBody } from './device-panel-body';
import { PanelFrame } from './panel-parts';

/** Panels in display order: each accessory follows the device that relays for it. */
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

/** The anchor id of a panel, for links from the device list. */
export const panelKey = (e: PanelEntry) =>
  e.kind === 'device' ? `d${e.device.id}` : `a${e.accessory.petkit_id}`;

interface DevicePanelsProps {
  entries: readonly PanelEntry[];
  details: ReadonlyMap<number, UseQueryResult<DeviceDetail>>;
  pets: readonly PetWithFaces[];
  visitsByDevice: ReadonlyMap<number, number>;
  visitsKnown: boolean;
  isOpen: OpenState;
  setOpen: SetOpen;
}

function DeviceBody({
  query,
  ...rest
}: { query: UseQueryResult<DeviceDetail> | undefined } & Omit<
  Parameters<typeof DevicePanelBody>[0],
  'device'
>) {
  if (!query || query.isPending) return <Skeleton height={240} />;
  if (query.error && !query.data) {
    return (
      <ErrorBlock
        message={`Could not load this device: ${errorMessage(query.error)}`}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  return <DevicePanelBody device={query.data} {...rest} />;
}

/** One collapsible panel per device and per accessory; open state is remembered. */
export function DevicePanels({
  entries,
  details,
  pets,
  visitsByDevice,
  visitsKnown,
  isOpen,
  setOpen,
}: DevicePanelsProps) {
  return (
    <div className="devices-panels">
      {entries.map(entry => {
        const key = panelKey(entry);
        const open = isOpen(`${key}:panel`, true);
        const onOpenChange = (next: boolean) => {
          setOpen(`${key}:panel`, next);
        };
        if (entry.kind === 'device') {
          const d = entry.device;
          const s = deviceStatus(d);
          return (
            <PanelFrame
              key={key}
              id={`device-${key}`}
              title={d.name}
              open={open}
              onOpenChange={onOpenChange}
              summary={
                <>
                  <StatusMark status={s.status} label={s.label} /> · {d.type.toUpperCase()} · #
                  {d.id} · {d.entities} entities · {d.queue} queued · {relativeTime(lastReport(d))}
                </>
              }
            >
              {() => (
                <DeviceBody
                  query={details.get(d.id)}
                  pets={pets}
                  visitsToday={visitsKnown ? (visitsByDevice.get(d.id) ?? 0) : null}
                  isOpen={isOpen}
                  setOpen={setOpen}
                />
              )}
            </PanelFrame>
          );
        }
        const a = entry.accessory;
        const s = accessoryStatus(a);
        return (
          <PanelFrame
            key={key}
            id={`device-${key}`}
            title={a.name}
            open={open}
            onOpenChange={onOpenChange}
            summary={
              <>
                <StatusMark status={s.status} label={s.label} /> · {a.ble_type.toUpperCase()} · #
                {a.petkit_id} · {a.parent_name ? `relayed by ${a.parent_name}` : 'no parent'} ·{' '}
                {a.entities.length} entities ·{' '}
                {a.last_seen ? relativeTime(epochSeconds(a.last_seen)) : 'never reported'}
              </>
            }
          >
            {() => <AccessoryPanelBody accessory={a} isOpen={isOpen} setOpen={setOpen} />}
          </PanelFrame>
        );
      })}
    </div>
  );
}
