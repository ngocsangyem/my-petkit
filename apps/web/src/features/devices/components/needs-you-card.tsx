import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { cn } from 'cn';
import { Card, Icon } from '@/shared/ui';
import { useDeviceLinks } from '../lib/device-view';
import type { NeedsYouItem } from '../lib/needs-you';
import { DeviceArt } from './device-art';

interface NeedsYouCardProps {
  items: readonly NeedsYouItem[];
  /** Blocked cloud attempts this week; null when the count could not be read. */
  blocked: number | null;
  className?: string;
}

const ROW =
  'flex min-h-13 items-center gap-3 text-foreground no-underline [&+&]:border-t [&+&]:border-rule hover:text-foreground';

function Row({
  to,
  art,
  title,
  detail,
}: {
  to: string;
  art: ReactNode;
  title: string;
  detail: ReactNode;
}) {
  return (
    <Link to={to} className={ROW}>
      <span className="flex w-10 flex-none justify-center text-muted-foreground">{art}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{title}</span>
        <span className="text-sm">{detail}</span>
      </span>
      <Icon name="forward" size={16} className="flex-none text-muted-foreground" />
    </Link>
  );
}

/**
 * Home's "Needs you": a row per thing to act on, each opening its device, then the cloud guards'
 * week. Only what the device list, the details and the blocked log already say.
 */
export function NeedsYouCard({ items, blocked, className }: NeedsYouCardProps) {
  const { t } = useTranslation('devices');
  const headingId = useId();
  const links = useDeviceLinks();
  return (
    <Card as="section" aria-labelledby={headingId} className={cn('flex flex-col gap-1', className)}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 id={headingId}>{t('needsYou.title')}</h2>
        <span className="text-sm text-muted-foreground">{items.length}</span>
      </div>
      <div className="flex flex-col">
        {items.length === 0 && (
          <div className={ROW}>
            <span className="flex w-10 flex-none justify-center text-positive">
              <Icon name="check" size={20} />
            </span>
            <span className="font-medium">{t('needsYou.nothing')}</span>
          </div>
        )}
        {items.map(item => (
          <Row
            key={item.id}
            to={links.device(item.row.key)}
            art={<DeviceArt type={item.row.type} entities={item.row.entities} size={40} />}
            title={item.title}
            detail={
              <span
                className={item.tone === 'negative' ? 'text-negative' : 'text-muted-foreground'}
              >
                {item.detail}
              </span>
            }
          />
        ))}
        {blocked !== null && (
          <Row
            to="/setup"
            art={<Icon name="shield" size={20} />}
            title={blocked ? t('needsYou.blocked', { count: blocked }) : t('needsYou.noneBlocked')}
            detail={<span className="text-muted-foreground">{t('needsYou.cloudGuards')}</span>}
          />
        )}
      </div>
    </Card>
  );
}
