import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { serverUrl } from '@/shared/api/base-path';
import { errorMessage } from '@/shared/api/errors';
import {
  buttonClassName,
  EmptyState,
  ErrorBlock,
  Icon,
  LitterBoxDrawing,
  PageHeader,
  Skeleton,
} from '@/shared/ui';
import {
  type DeviceDetail,
  type PetWithFaces,
  useBleAccessories,
  useBlockedAttempts,
  useDeviceDetails,
  useDeviceList,
  usePets,
  useRecentSessions,
} from './api';
import { DayStripCard } from './components/day-strip-card';
import { panelKey, panelOrder } from './components/device-panels';
import { DeviceScreen } from './device-page/device-screen';
import { HomeView } from './home/home-view';
import { PendingEditsProvider } from './hooks/pending-edits';
import { useLiveRefresh } from './hooks/use-live-refresh';
import { useNowSeconds } from './hooks/use-now';
import { useOpenState } from './hooks/use-open-state';
import { useOverview } from './hooks/use-overview';
import { useDeviceView } from './lib/device-view';
import { deviceZone } from './lib/device-zone';
import { findEntity, numericValue } from './lib/entity-sections';
import { blockedThisWeek, needsYou } from './lib/needs-you';

const NO_PETS: readonly PetWithFaces[] = [];

/** Home's loading state: grey bars at the final size of each block, no shimmer. */
function HomeSkeleton() {
  const { t } = useTranslation('devices');
  return (
    <>
      <PageHeader title={t('home.title')} />
      <div className="grid grid-cols-2 gap-3 min-[901px]:grid-cols-4 min-[901px]:gap-4">
        <Skeleton height={214} />
        <Skeleton height={214} />
        <div className="col-span-2">
          <Skeleton height={214} />
        </div>
      </div>
      <Skeleton height={232} />
      <Skeleton height={200} />
    </>
  );
}

/**
 * The household's devices. Home with no device named; otherwise that device's page, its live
 * view or its schedules (see lib/device-view.ts). Every view shares the queries below, so moving
 * between them never reloads, and an edit typed on a device page survives going back to Home.
 */
export function DevicesPage() {
  const { t } = useTranslation('devices');
  useLiveRefresh();
  const view = useDeviceView();
  const nowSeconds = useNowSeconds();
  const list = useDeviceList();
  const ble = useBleAccessories();
  const blocked = useBlockedAttempts();
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

  if (list.isPending) return <HomeSkeleton />;
  if (list.error) {
    return (
      <>
        <PageHeader title={t('home.title')} />
        <ErrorBlock
          message={t('page.loadDevicesFailed', { error: errorMessage(list.error) })}
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
        />
      </>
    );
  }

  if (!devices.length && !accessories.length) {
    return (
      <>
        <PageHeader title={t('home.title')} finding={t('empty.finding')} />
        <EmptyState
          title={t('empty.title')}
          art={<LitterBoxDrawing level={0} size={120} />}
          action={
            <Link className={buttonClassName('primary')} to="/provision">
              <Icon name="plus" size={16} />
              {t('home.addDevice')}
            </Link>
          }
        >
          {t('empty.body')}
        </EmptyState>
      </>
    );
  }

  if (view.key) {
    return (
      <PendingEditsProvider key="devices">
        <DeviceScreen
          view={{ key: view.key, sub: view.sub }}
          entries={entries}
          details={overview.detailById}
          pets={pets.data ?? NO_PETS}
          visitsByDevice={overview.visitsByDevice}
          visitsKnown={!recent.isPending && !recent.error}
          isOpen={isOpen}
          setOpen={setOpen}
          nowSeconds={nowSeconds}
        />
      </PendingEditsProvider>
    );
  }

  const details = new Map<number, DeviceDetail>();
  for (const [id, q] of overview.detailById) if (q.data) details.set(id, q.data);
  const needs = needsYou({
    devices,
    details,
    rows: overview.rows,
    zoneOf: id => deviceZone(details.get(id)?.timezoneInfo),
    nowSeconds,
  });
  const fed = devices.reduce<number | null>((sum, d) => {
    const grams = numericValue(findEntity(details.get(d.id)?.entities ?? [], 'total_dispensed'));
    return grams === null ? sum : (sum ?? 0) + grams;
  }, null);

  return (
    <PendingEditsProvider key="devices">
      <HomeView
        rows={overview.rows}
        needs={needs}
        blocked={blocked.data ? blockedThisWeek(blocked.data, nowSeconds) : null}
        pets={pets.data ?? NO_PETS}
        sessions={recent.sessions}
        zone={overview.homeZone}
        nowSeconds={nowSeconds}
        reporting={devices.filter(d => d.online).length}
        deviceCount={devices.length + accessories.length}
        today={
          <DayStripCard
            strip={overview.strip}
            zone={overview.homeZone}
            nowSeconds={nowSeconds}
            fedGrams={fed}
            loading={recent.isPending || pets.isPending || detailQueries.some(q => q.isPending)}
            error={
              recent.error || pets.error
                ? t('page.loadTodayFailed', { error: errorMessage(recent.error ?? pets.error) })
                : null
            }
            onRetry={() => {
              recent.refetch();
              void pets.refetch();
            }}
          />
        }
      />
      {ble.error && (
        <ErrorBlock
          message={t('page.loadBleFailed', { error: errorMessage(ble.error) })}
          onRetry={() => void ble.refetch()}
        />
      )}
    </PendingEditsProvider>
  );
}
