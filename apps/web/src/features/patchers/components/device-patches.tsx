import { useId, useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { EmptyBlock, ErrorBlock, Skeleton } from '@/shared/ui';
import { usePatcherStatus, type DeviceSummary, type PatcherId } from '../api';
import type { PatcherProgress } from '../hooks/use-patcher-progress';
import { runKey } from '../patcher-model';
import { PatchActionPanel } from './patch-action-panel';
import { PatchTable } from './patch-table';

interface DevicePatchesProps {
  device: DeviceSummary;
  progress: PatcherProgress;
}

/** The patches of one device: the table, then the step-up panel for the picked one. */
export function DevicePatches({ device, progress }: DevicePatchesProps) {
  const status = usePatcherStatus(device.id);
  const titleId = useId();
  const [picked, setPicked] = useState<{ id: PatcherId; action: 'apply' | 'remove' } | null>(null);

  if (status.isPending) return <Skeleton height={336} />;
  if (status.isError) {
    return (
      <ErrorBlock
        message={`Patch status could not be read. ${errorMessage(status.error)}`}
        onRetry={() => void status.refetch()}
        retrying={status.isFetching}
      />
    );
  }
  if (!status.data.supported) {
    return (
      <EmptyBlock>
        Patchers are only available for the Linux models (T5, T6, T7, D4H, D4SH, W7H). This device
        uses a different platform.
      </EmptyBlock>
    );
  }

  const ip = status.data.device_ip;
  const patchers = Object.values(status.data.patchers);
  const current = picked ? patchers.find(p => p.id === picked.id) : undefined;
  const linesOf = (patcherId: string) => progress.lines.get(runKey(device.id, patcherId));

  return (
    <>
      <section className="patchers-list" aria-labelledby={titleId}>
        <div className="patchers-list__head">
          <h2 id={titleId} className="patchers-list__title">
            Patches
          </h2>
          <span className="patchers-muted">
            {ip ? (
              <>
                The server reaches this device at <span className="patchers-mono">{ip}</span>.
              </>
            ) : (
              'Device IP unknown: wait for a state report before patching.'
            )}
          </span>
        </div>
        <PatchTable
          patchers={patchers}
          linesOf={linesOf}
          selected={picked?.id ?? null}
          onPick={(p, action) => {
            setPicked({ id: p.id, action });
          }}
        />
      </section>
      {current && picked && (
        <PatchActionPanel
          key={`${current.id}:${picked.action}`}
          deviceId={device.id}
          deviceName={device.name}
          deviceIp={ip}
          patcher={current}
          action={picked.action}
          lines={linesOf(current.id) ?? []}
          note={progress.note}
          onSwitch={action => {
            setPicked({ id: current.id, action });
          }}
          onClose={() => {
            setPicked(null);
          }}
        />
      )}
    </>
  );
}
