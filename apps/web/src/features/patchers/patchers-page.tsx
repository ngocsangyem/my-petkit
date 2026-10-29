import { errorMessage } from '@/shared/api/errors';
import {
  EmptyBlock,
  ErrorBlock,
  PageHeading,
  RiskNotice,
  Select,
  Skeleton,
  StepUpPill,
  usePersistedState,
} from '@/shared/ui';
import { usePatcherDevices, usePatcherStatus, type DeviceSummary, type PatcherStatus } from './api';
import { DevicePatches } from './components/device-patches';
import { usePatcherProgress } from './hooks/use-patcher-progress';

function deviceLabel(d: DeviceSummary): string {
  return `${d.name} · ${d.type.toUpperCase()} · #${d.id}`;
}

/** "Root changes on the device itself · 2 of 6 patches applied". */
function finding(status: PatcherStatus | undefined): string {
  const base = 'Root changes on the device itself';
  if (!status?.supported) return base;
  const all = Object.values(status.patchers);
  const applied = all.filter(p => p.applied || p.greyed).length;
  return `${base} · ${applied} of ${all.length} patches applied`;
}

/** Root patches on the device itself: status per device, apply or remove, live progress. */
export function PatchersPage() {
  const devices = usePatcherDevices();
  const progress = usePatcherProgress();
  const [chosen, setChosen] = usePersistedState<number | null>('patchers.device', null);

  const list = devices.data ?? [];
  const device = list.find(d => d.id === chosen) ?? list[0];
  // The same cache entry the device's table reads: no second request.
  const status = usePatcherStatus(device ? device.id : null);

  const picker =
    list.length > 1 && device ? (
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Device
        <Select
          options={list.map(d => ({ value: String(d.id), label: deviceLabel(d) }))}
          value={String(device.id)}
          onChange={e => {
            setChosen(Number(e.target.value));
          }}
        />
      </label>
    ) : undefined;

  return (
    <>
      <PageHeading
        title="Patchers"
        badge={<StepUpPill />}
        finding={finding(status.data)}
        actions={picker}
      />
      <RiskNotice>
        Each patch runs shell commands on the device as root, at your own risk: it can brick the
        device and leaves it outside its warranty. Patches live only on the writable /system
        partition; the read-only /app partition is never modified. Removing a patch deletes its
        files from /system and reboots, and with none left the device is back on stock firmware.
      </RiskNotice>
      {devices.isPending ? (
        <Skeleton height={280} />
      ) : devices.isError ? (
        <ErrorBlock
          message={`Devices could not be loaded. ${errorMessage(devices.error)}`}
          onRetry={() => void devices.refetch()}
          retrying={devices.isFetching}
        />
      ) : !device ? (
        <EmptyBlock>
          No devices connected. Connect a device first, then come back to patch it.
        </EmptyBlock>
      ) : (
        <DevicePatches key={device.id} device={device} progress={progress} />
      )}
    </>
  );
}
