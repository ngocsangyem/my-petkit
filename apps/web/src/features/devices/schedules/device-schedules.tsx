import { useTranslation } from 'react-i18next';
import { usePersistedState } from '@/shared/ui';
import { usePendingDraft } from '../hooks/pending-edits';
import { DeferredFeedPanel } from './components/deferred-feed-panel';
import { ScheduleEditor } from './components/schedule-editor';
import { SegmentTabs } from './components/segment-tabs';
import type { DeviceDetail, ScheduleDraft } from './schedule-model';

/** The tab id of the one-off feeds, an id no schedule target uses (targets are camel-case wire field names). */
const ONE_OFF = '__one-off';

const NO_DRAFTS: ReadonlyMap<string, ScheduleDraft> = new Map();

export interface DeviceSchedulesProps {
  device: DeviceDetail;
}

/**
 * The schedules a device runs on its own clock, one tab per schedule the
 * server says it has (`device.schedules`), plus one-off feeds on a feeder.
 * Renders nothing for a device with neither.
 */
export function DeviceSchedules({ device }: DeviceSchedulesProps) {
  // Working copies live per device, so a different device never inherits them.
  return <SchedulesCard key={device.id} device={device} />;
}

function SchedulesCard({ device }: DeviceSchedulesProps) {
  const { t } = useTranslation('devices');
  const targets = device.schedules;
  // Working copies by target, so a background refresh of the device cannot
  // throw away rows somebody just added; the server value shows until an edit.
  // Held above the page, so going back to Home and returning keeps them too.
  const [held, setDrafts] = usePendingDraft<ReadonlyMap<string, ScheduleDraft>>(
    `schedules:${device.id}`,
  );
  const drafts = held ?? NO_DRAFTS;
  const [stored, setSelected] = usePersistedState(`devices.${device.id}.schedule-tab`, '');
  const feed = targets.find(t => t.kind === 'feed');

  const tabs = targets.map(s => ({
    id: s.target,
    label: drafts.has(s.target) ? t('schedules.unsaved', { name: s.name }) : s.name,
  }));
  if (device.is_feeder) tabs.push({ id: ONE_OFF, label: t('automation.oneOffFeeds') });
  const first = tabs[0];
  if (!first) return null;
  const selected = tabs.some(tab => tab.id === stored) ? stored : first.id;
  const target = targets.find(s => s.target === selected);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <SegmentTabs
        label={t('automation.schedules')}
        tabs={tabs}
        selected={selected}
        onSelect={setSelected}
      >
        {target ? (
          <ScheduleEditor
            deviceId={device.id}
            target={target}
            draft={drafts.get(target.target)}
            onDraft={draft => {
              const next = new Map(drafts);
              if (draft) next.set(target.target, draft);
              else next.delete(target.target);
              setDrafts(next.size ? next : undefined);
            }}
          />
        ) : (
          <DeferredFeedPanel
            deviceId={device.id}
            dual={feed?.dual ?? false}
            offset={device.timezoneInfo.effective}
          />
        )}
      </SegmentTabs>
      <p className="text-xs text-muted-foreground">{t('schedules.note')}</p>
    </div>
  );
}
