import { useState } from 'react';
import { SectionCard, Tabs, usePersistedState } from '@/shared/ui';
import { DeferredFeedPanel } from './components/deferred-feed-panel';
import { ScheduleEditor } from './components/schedule-editor';
import type { DeviceDetail, ScheduleDraft } from './schedule-model';

/** The tab id of the one-off feeds, an id no schedule target uses (targets are camel-case wire field names). */
const ONE_OFF = '__one-off';

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
  const targets = device.schedules;
  // Working copies by target, so a background refresh of the device cannot
  // throw away rows somebody just added; the server value shows until an edit.
  const [drafts, setDrafts] = useState<ReadonlyMap<string, ScheduleDraft>>(new Map());
  const [stored, setSelected] = usePersistedState(`devices.${device.id}.schedule-tab`, '');
  const feed = targets.find(t => t.kind === 'feed');

  const tabs = targets.map(t => ({
    id: t.target,
    label: drafts.has(t.target) ? `${t.name} (unsaved)` : t.name,
  }));
  if (device.is_feeder) tabs.push({ id: ONE_OFF, label: 'One-off feeds' });
  const first = tabs[0];
  if (!first) return null;
  const selected = tabs.some(t => t.id === stored) ? stored : first.id;
  const target = targets.find(t => t.target === selected);

  return (
    <SectionCard title="Schedules">
      <Tabs label="Schedules" tabs={tabs} selected={selected} onSelect={setSelected}>
        {target ? (
          <ScheduleEditor
            deviceId={device.id}
            target={target}
            draft={drafts.get(target.target)}
            onDraft={draft => {
              setDrafts(prev => {
                const next = new Map(prev);
                if (draft) next.set(target.target, draft);
                else next.delete(target.target);
                return next;
              });
            }}
          />
        ) : (
          <DeferredFeedPanel
            deviceId={device.id}
            dual={feed?.dual ?? false}
            offset={device.timezoneInfo.effective}
          />
        )}
      </Tabs>
      <p className="text-sm text-muted-foreground">
        The device runs these on its own clock, in its own time zone. Nothing is set for you: an
        empty schedule does not restrict the device. A period that ends before it starts runs
        through midnight, which is how PetKit's own app writes quiet hours.
      </p>
    </SectionCard>
  );
}
