import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { i18n } from '@/i18n';
import { buttonClassName, Icon, PageHeader, StatusWord } from '@/shared/ui';
import type { PetWithFaces, TimelineSession } from '../api';
import { NeedsYouCard } from '../components/needs-you-card';
import type { DeviceRow } from '../hooks/use-overview';
import type { DeviceZone } from '../lib/device-zone';
import type { NeedsYouItem } from '../lib/needs-you';
import { DeviceCard } from './device-card';
import { PetCard, petDay } from './pet-card';
import type { ReactNode } from 'react';

interface HomeViewProps {
  rows: readonly DeviceRow[];
  needs: readonly NeedsYouItem[];
  blocked: number | null;
  pets: readonly PetWithFaces[];
  sessions: readonly TimelineSession[];
  zone: DeviceZone | null;
  nowSeconds: number;
  reporting: number;
  deviceCount: number;
  /** The day strip card, built by the page (it owns the loading and error states). */
  today: ReactNode;
}

/** The one finding sentence: the worst thing first, in its colour; or that all is well. */
function finding(needs: readonly NeedsYouItem[]): ReactNode {
  const [first, ...rest] = needs;
  if (!first) return <StatusWord tone="positive">{i18n.t('devices:home.allFine')}</StatusWord>;
  const lead =
    first.tone === 'negative'
      ? i18n.t('devices:home.lead', { title: first.title })
      : i18n.t('devices:home.leadWithDetail', { title: first.title, detail: first.detail });
  return (
    <>
      <StatusWord tone={first.tone}>{lead}</StatusWord>{' '}
      {rest.length === 0
        ? i18n.t('devices:home.restFine')
        : i18n.t('devices:home.more', { count: rest.length })}
    </>
  );
}

/** Home: cats and what needs you, the devices drawn at their levels, then today's strip. */
export function HomeView(props: HomeViewProps) {
  const { t } = useTranslation('devices');
  const { rows, needs, pets, sessions, zone, nowSeconds } = props;
  return (
    <>
      <PageHeader
        title={t('home.title')}
        finding={finding(needs)}
        actions={
          <>
            <Link className={buttonClassName('secondary')} to="/timeline">
              <Icon name="timeline" size={16} />
              {t('home.timeline')}
            </Link>
            <Link className={buttonClassName('primary')} to="/provision">
              <Icon name="plus" size={16} />
              {t('home.addDevice')}
            </Link>
          </>
        }
      />
      <section
        aria-label={t('home.catsAndAttention')}
        className="grid grid-cols-2 gap-3 min-[901px]:grid-cols-4 min-[901px]:gap-4"
      >
        {pets.length > 0 && (
          <ul aria-label={t('home.cats')} className="contents">
            {pets.map(p => (
              <PetCard key={p.id} pet={p} day={petDay(p, sessions, zone, nowSeconds)} />
            ))}
          </ul>
        )}
        <NeedsYouCard items={needs} blocked={props.blocked} className="col-span-2" />
      </section>
      <div className="-mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2>{t('home.devices')}</h2>
        <span className="text-sm text-muted-foreground">
          {t('home.reporting', { total: props.deviceCount, reporting: props.reporting })}
        </span>
      </div>
      <ul
        aria-label={t('home.devices')}
        className="m-0 grid list-none grid-cols-2 gap-3 p-0 min-[901px]:grid-cols-4 min-[901px]:gap-4"
      >
        {rows.map(r => (
          <DeviceCard key={r.key} row={r} />
        ))}
      </ul>
      {props.today}
    </>
  );
}
