import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CaptionPill, Card, Icon } from '@/shared/ui';
import { useDeviceLinks } from '../lib/device-view';

/**
 * The way into a camera's live view: the dark live ground with a play button and a caption, then
 * one row saying how it streams. Nothing connects until the live view's own Watch.
 */
export function LiveLinkCard({ deviceKey, caption }: { deviceKey: string; caption: string }) {
  const { t } = useTranslation('devices');
  const links = useDeviceLinks();
  const to = links.device(deviceKey, 'live');
  return (
    <Card as="section" padding="none" aria-label={t('liveView')} className="overflow-hidden">
      <Link
        to={to}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block h-[220px] bg-live-ground text-live-text min-[901px]:h-[260px]"
      >
        <span className="absolute top-1/2 left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card text-foreground">
          <Icon name="play" size={18} />
        </span>
        <CaptionPill className="absolute top-3.5 left-3.5">{t('liveView')}</CaptionPill>
      </Link>
      <Link
        to={to}
        className="flex min-h-13 items-center gap-3 px-5 text-foreground no-underline hover:text-foreground"
      >
        <span className="min-w-0 flex-1 text-sm">{caption}</span>
        <Icon name="forward" size={16} className="text-muted-foreground" />
      </Link>
    </Card>
  );
}
