import { useCallback, useMemo } from 'react';
import { Link } from 'react-router';
import { serverUrl } from '@/shared/api/base-path';
import { errorMessage } from '@/shared/api/errors';
import { buttonClassName, EmptyBlock, ErrorBlock, PageHeading, Skeleton } from '@/shared/ui';
import {
  type PetWithFaces,
  useBleAccessories,
  useDeviceDetails,
  useDeviceList,
  usePets,
  useRecentSessions,
} from './api';
import { DayStripCard } from './components/day-strip-card';
import { DevicePanels, panelKey, panelOrder } from './components/device-panels';
import { DeviceTable } from './components/device-table';
import { PendingEditsProvider } from './hooks/pending-edits';
import { useLiveRefresh } from './hooks/use-live-refresh';
import { useNowSeconds } from './hooks/use-now';
import { useOpenState } from './hooks/use-open-state';
import { useOverview } from './hooks/use-overview';
import { findEntity, numericValue } from './lib/entity-sections';
import './devices.css';

const NO_PETS: readonly PetWithFaces[] = [];

/** The household's devices: today's strip, the device list, then a panel per device. */
export function DevicesPage() {
  useLiveRefresh();
  const nowSeconds = useNowSeconds();
  const list = useDeviceList();
  const ble = useBleAccessories();
  const devices = useMemo(() => list.data ?? [], [list.data]);
  const accessories = useMemo(() => ble.data ?? [], [ble.data]);
  const detailQueries = useDeviceDetails(devices.map(d => d.id));
  const recent = useRecentSessions();
  const pets = usePets();
  const avatarFor = useCallback((pet: PetWithFaces) => {
    const face = pet.faces[0];
    return face ? <img src={serverUrl(face.url)} alt="" /> : undefined;
  }, []);

  const overview = useOverview({
    devices,
    accessories,
    detailQueries,
    sessions: recent.sessions,
    pets: pets.data ?? NO_PETS,
    nowSeconds,
    avatarFor,
  });
  const entries = panelOrder(devices, accessories);
  const [isOpen, setOpen] = useOpenState(list.data && ble.data ? entries.map(panelKey) : null);

  if (list.isPending) {
    return (
      <>
        <PageHeading title="Devices" />
        <Skeleton height={176} />
        <Skeleton height={240} />
      </>
    );
  }
  if (list.error) {
    return (
      <>
        <PageHeading title="Devices" />
        <ErrorBlock
          message={`Could not load the devices: ${errorMessage(list.error)}`}
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
        />
      </>
    );
  }

  const addDevice = (
    <Link className={buttonClassName('primary')} to="/provision">
      Add a device
    </Link>
  );
  if (!devices.length && !accessories.length) {
    return (
      <>
        <PageHeading title="Devices" actions={addDevice} />
        <EmptyBlock action={<Link to="/provision">Open Provision</Link>}>
          No devices connected yet. Provision one over Bluetooth, or point its API server address at
          this app.
        </EmptyBlock>
      </>
    );
  }

  const reporting = devices.filter(d => d.online).length;
  const offline = overview.rows.find(
    r => r.attention?.tone === 'negative' && r.key.startsWith('d'),
  );
  const fed = devices.reduce<number | null>((sum, d) => {
    const grams = numericValue(
      findEntity(overview.detailById.get(d.id)?.data?.entities ?? [], 'total_dispensed'),
    );
    return grams === null ? sum : (sum ?? 0) + grams;
  }, null);

  return (
    <PendingEditsProvider>
      <div className="devices-page">
        <PageHeading
          title="Devices"
          aside={`${devices.length} ${devices.length === 1 ? 'device' : 'devices'} · ${reporting} reporting`}
          finding={
            offline?.attention ? (
              <>
                <span className="devices-negative">
                  {offline.name}: {offline.attention.text}
                </span>
                .
              </>
            ) : undefined
          }
          actions={addDevice}
        />
        <DayStripCard
          strip={overview.strip}
          zone={overview.homeZone}
          nowSeconds={nowSeconds}
          fedGrams={fed}
          loading={recent.isPending || pets.isPending || detailQueries.some(q => q.isPending)}
          error={
            recent.error || pets.error
              ? `Could not load today: ${errorMessage(recent.error ?? pets.error)}`
              : null
          }
          onRetry={() => {
            recent.refetch();
            void pets.refetch();
          }}
        />
        {ble.error && (
          <ErrorBlock
            message={`Could not load the Bluetooth accessories: ${errorMessage(ble.error)}`}
            onRetry={() => void ble.refetch()}
          />
        )}
        <DeviceTable rows={overview.rows} />
        <DevicePanels
          entries={entries}
          details={overview.detailById}
          pets={pets.data ?? NO_PETS}
          visitsByDevice={overview.visitsByDevice}
          visitsKnown={!recent.isPending && !recent.error}
          isOpen={isOpen}
          setOpen={setOpen}
        />
      </div>
    </PendingEditsProvider>
  );
}
