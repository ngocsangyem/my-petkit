import { useId } from 'react';
import { Link } from 'react-router';
import { Card, Icon } from '@/shared/ui';
import type { DeviceDetail } from '../api';
import { useDeviceLinks } from '../lib/device-view';
import type { ForceContinueController } from '../litter-automation/force-continue-block';
import { LitterAutomationSection } from '../litter-automation/litter-automation-section';

interface AutomationCardProps {
  device: DeviceDetail;
  /** Litter boxes: force continue and auto-pack. */
  litter: boolean;
  force: ForceContinueController;
}

/**
 * What the device does on its own: a litter box's force continue and auto-pack, and the way into
 * the schedules it runs on its own clock.
 */
export function AutomationCard({ device, litter, force }: AutomationCardProps) {
  const headingId = useId();
  const links = useDeviceLinks();
  const schedules = device.schedules;
  if (!litter && !schedules.length) return null;
  return (
    <Card as="section" aria-labelledby={headingId} className="flex flex-col gap-1 pt-4 pb-2">
      <h2 id={headingId} className="mb-1">
        Automation
      </h2>
      {litter && <LitterAutomationSection deviceId={device.id} force={force} />}
      {schedules.length > 0 && (
        <Link
          to={links.device(`d${device.id}`, 'schedules')}
          className="flex min-h-13 items-center gap-3 border-t border-rule text-foreground no-underline first:border-t-0 hover:text-foreground"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span>Schedules</span>
            <span className="text-xs text-muted-foreground">
              {schedules.map(s => s.name).join(', ')}
            </span>
          </span>
          <Icon name="forward" size={16} className="flex-none text-muted-foreground" />
        </Link>
      )}
    </Card>
  );
}
