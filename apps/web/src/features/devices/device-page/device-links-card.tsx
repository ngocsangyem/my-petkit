import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { copyText } from '@/shared/format/copy-text';
import { Card, Icon, type IconName, IconButton, StepUpPill } from '@/shared/ui';
import type { DeviceDetail } from '../api';
import { RemoveDevice } from '../components/remove-device';
import { useDeviceLinks } from '../lib/device-view';

const ROW =
  'flex min-h-13 w-full items-center gap-3 text-foreground no-underline [&+&]:border-t [&+&]:border-rule hover:text-foreground';

function RowIcon({ name }: { name: IconName }) {
  return <Icon name={name} size={18} className="flex-none text-muted-foreground" />;
}

function LinkRow({ to, icon, children }: { to: string; icon: IconName; children: ReactNode }) {
  return (
    <Link to={to} className={ROW}>
      <RowIcon name={icon} />
      {children}
      <Icon name="forward" size={16} className="flex-none text-muted-foreground" />
    </Link>
  );
}

interface DeviceLinksCardProps {
  device: DeviceDetail;
  rawOpen: boolean;
  onRawOpenChange: (open: boolean) => void;
}

/**
 * The foot of a device page: its patches (step-up), its id to copy, its log, the entities and
 * raw command for debugging, and removing it.
 */
export function DeviceLinksCard({ device, rawOpen, onRawOpenChange }: DeviceLinksCardProps) {
  const { t } = useTranslation('devices');
  const links = useDeviceLinks();
  const navigate = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <Card as="section" aria-label={t('links.tools')} className="flex flex-col py-2">
      <LinkRow to="/patchers" icon="wrench">
        <span className="flex-1">{t('links.patches')}</span>
        <StepUpPill>{t('links.stepUp')}</StepUpPill>
      </LinkRow>
      <div className={ROW}>
        <RowIcon name="key" />
        <span className="flex-1">{t('links.deviceId')}</span>
        <span className="font-mono text-sm text-muted-foreground">{device.id}</span>
        <IconButton
          icon="copy"
          variant="ghost"
          aria-label={t('links.copyId')}
          onClick={() => {
            void copyText(String(device.id)).then(ok => {
              setCopied(ok ? t('stream.copied') : t('links.copyFailed'));
            });
          }}
        />
        <span role="status" className="text-sm text-muted-foreground empty:hidden">
          {copied ?? ''}
        </span>
      </div>
      <LinkRow to="/log" icon="log">
        <span className="flex-1">{t('links.logs')}</span>
        <span className="text-sm text-muted-foreground">{t('links.logsHint')}</span>
      </LinkRow>
      <button
        type="button"
        aria-expanded={rawOpen}
        className={`${ROW} border-0 bg-transparent p-0 text-left`}
        onClick={() => {
          onRawOpenChange(!rawOpen);
        }}
      >
        <RowIcon name="file" />
        <span className="flex-1">{t('rawCard.title')}</span>
        <span className="text-sm text-muted-foreground">{t('links.forDebugging')}</span>
        <Icon
          name="chevron"
          size={16}
          className={rawOpen ? 'text-muted-foreground' : '-rotate-90 text-muted-foreground'}
        />
      </button>
      <RemoveDevice
        device={device}
        onRemoved={() => {
          void navigate(links.home);
        }}
      />
    </Card>
  );
}
