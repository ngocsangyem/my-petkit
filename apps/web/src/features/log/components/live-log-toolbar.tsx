import { Chip, InlineField, LiveIndicator, SearchField, Select } from '@/shared/ui';
import { useStreamStatus } from '@/shared/ws/use-event-stream';
import { ALL, type LiveLogFilters } from '../hooks/use-live-log-filters';

/** Grep, the heartbeat and auto-scroll chips, kind and device filters, and the stream's state. */
export function LiveLogToolbar({ filters }: { filters: LiveLogFilters }) {
  const status = useStreamStatus();
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <SearchField
        className="min-w-[220px] flex-[1_1_240px]"
        aria-label="Filter the live log"
        placeholder="Filter lines, for example 100155021"
        mono
        autoComplete="off"
        spellCheck={false}
        value={filters.grep}
        onValueChange={filters.setGrep}
      />
      <Chip pressed={filters.hideHeartbeats} onPressedChange={filters.setHideHeartbeats}>
        Hide heartbeats
      </Chip>
      <Chip pressed={filters.autoscroll} onPressedChange={filters.setAutoscroll}>
        Auto-scroll
      </Chip>
      <InlineField label="Kind">
        <Select
          value={filters.kind}
          onChange={e => {
            filters.setKind(e.target.value);
          }}
          options={[
            { value: ALL, label: 'All kinds' },
            ...filters.kinds.map(k => ({ value: k, label: k })),
          ]}
        />
      </InlineField>
      <InlineField label="Device">
        <Select
          value={filters.device}
          onChange={e => {
            filters.setDevice(e.target.value);
          }}
          options={[
            { value: ALL, label: 'All devices' },
            ...filters.devices.map(d => ({ value: d, label: d })),
          ]}
        />
      </InlineField>
      <span className="ml-auto text-sm">
        <LiveIndicator state={status} />
      </span>
    </div>
  );
}
