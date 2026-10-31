import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { errorMessage } from '@/shared/api/errors';
import { Card, EmptyBlock, ErrorBlock, RiskNotice, Skeleton } from '@/shared/ui';
import { usePatcherStatus, type DeviceSummary, type PatcherId } from '../api';
import type { PatcherProgress } from '../hooks/use-patcher-progress';
import { runKey } from '../patcher-model';
import { PatchActionPanel } from './patch-action-panel';
import { PatchList } from './patch-list';

interface DevicePatchesProps {
  device: DeviceSummary;
  progress: PatcherProgress;
}

/** The patches of one device: the list on the left, the picked patch's step-up card on the right. */
export function DevicePatches({ device, progress }: DevicePatchesProps) {
  const { t } = useTranslation('patchers');
  const status = usePatcherStatus(device.id);
  const [picked, setPicked] = useState<{ id: PatcherId; action: 'apply' | 'remove' } | null>(null);

  if (status.isPending) return <Skeleton height={336} />;
  if (status.isError) {
    return (
      <ErrorBlock
        message={t('statusFailed', { error: errorMessage(status.error) })}
        onRetry={() => void status.refetch()}
        retrying={status.isFetching}
      />
    );
  }
  if (!status.data.supported) {
    return <EmptyBlock>{t('unsupported')}</EmptyBlock>;
  }

  const ip = status.data.device_ip;
  const patchers = Object.values(status.data.patchers);
  const current = picked ? patchers.find(p => p.id === picked.id) : undefined;
  const linesOf = (patcherId: string) => progress.lines.get(runKey(device.id, patcherId));

  return (
    <div className="grid grid-cols-1 items-start gap-5 min-[901px]:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <Card as="section" padding="none" aria-label={t('patchesOfDevice')} className="px-3 py-2">
        <p className="px-2.5 py-2 text-sm text-muted-foreground">
          {ip ? (
            <Trans
              t={t}
              i18nKey="reachesAt"
              values={{ ip }}
              components={{ ip: <span className="font-mono text-xs" /> }}
            />
          ) : (
            t('ipUnknown')
          )}
        </p>
        <PatchList
          patchers={patchers}
          deviceName={device.name}
          linesOf={linesOf}
          selected={picked?.id ?? null}
          onPick={(p, action) => {
            setPicked({ id: p.id, action });
          }}
        />
      </Card>
      {current && picked ? (
        <PatchActionPanel
          key={`${current.id}:${picked.action}`}
          deviceId={device.id}
          deviceName={device.name}
          deviceType={device.type}
          deviceFirmware={device.firmware}
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
      ) : (
        <Card className="flex flex-col gap-4">
          <RiskNotice>{t('risk')}</RiskNotice>
          <p className="text-muted-foreground">{t('pick')}</p>
        </Card>
      )}
    </div>
  );
}
