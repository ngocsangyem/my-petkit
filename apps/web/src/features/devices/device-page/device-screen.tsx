import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { errorMessage } from '@/shared/api/errors';
import { buttonClassName, ErrorBlock, NoticeCard, PageHeader, Skeleton } from '@/shared/ui';
import type { BleAccessory, DeviceDetail, PetWithFaces } from '../api';
import { type PanelEntry, panelKey } from '../components/device-panels';
import type { OpenState, SetOpen } from '../hooks/use-open-state';
import { type DeviceView, useDeviceLinks } from '../lib/device-view';
import { LivePage } from '../live/live-page';
import { SchedulesPage } from '../schedules/schedules-page';
import { AccessoryPage } from './accessory-page';
import { DevicePage } from './device-page';

interface DeviceScreenProps {
  view: DeviceView & { key: string };
  entries: readonly PanelEntry[];
  details: ReadonlyMap<number, UseQueryResult<DeviceDetail>>;
  pets: readonly PetWithFaces[];
  visitsByDevice: ReadonlyMap<number, number>;
  visitsKnown: boolean;
  isOpen: OpenState;
  setOpen: SetOpen;
  nowSeconds: number;
}

/** The page of one device or accessory, its live view or its schedules, by the view's key. */
export function DeviceScreen(props: DeviceScreenProps) {
  const { view, entries, details, isOpen, setOpen } = props;
  const { t } = useTranslation('devices');
  const links = useDeviceLinks();
  const entry = entries.find(e => panelKey(e) === view.key);
  const back = { to: links.home, label: t('home.title') };

  if (!entry) {
    return (
      <>
        <PageHeader title={t('family.other')} back={back} />
        <NoticeCard
          title={t('screen.goneTitle')}
          action={
            <Link className={buttonClassName('secondary')} to={links.home}>
              {t('screen.backHome')}
            </Link>
          }
        >
          {t('screen.goneBody')}
        </NoticeCard>
      </>
    );
  }

  if (entry.kind === 'accessory') {
    return <AccessoryPage accessory={entry.accessory} isOpen={isOpen} setOpen={setOpen} />;
  }

  const summary = entry.device;
  const query = details.get(summary.id);
  if (!query || query.isPending) {
    return (
      <>
        <PageHeader title={summary.name} back={back} />
        <div className="grid items-start gap-5 min-[901px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Skeleton height={360} />
          <Skeleton height={360} />
        </div>
      </>
    );
  }
  if (!query.data) {
    return (
      <>
        <PageHeader title={summary.name} back={back} />
        <ErrorBlock
          message={t('screen.loadFailed', { error: errorMessage(query.error) })}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </>
    );
  }

  const device = query.data;
  if (view.sub === 'live') return <LivePage device={device} />;
  if (view.sub === 'schedules')
    return <SchedulesPage device={device} nowSeconds={props.nowSeconds} />;
  const accessories = entries.flatMap(e => (e.kind === 'accessory' ? [e.accessory] : []));
  return (
    <DevicePage
      device={device}
      accessories={accessories satisfies BleAccessory[]}
      pets={props.pets}
      visitsToday={props.visitsKnown ? (props.visitsByDevice.get(device.id) ?? 0) : null}
      isOpen={isOpen}
      setOpen={setOpen}
      nowSeconds={props.nowSeconds}
    />
  );
}
