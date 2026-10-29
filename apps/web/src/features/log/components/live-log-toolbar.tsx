import { InlineField, LiveIndicator, SearchField, Select, Switch } from '@/shared/ui';
import { useStreamStatus } from '@/shared/ws/use-event-stream';
import { ALL, type LiveLogFilters } from '../hooks/use-live-log-filters';

/** Grep, kind and device filters, the two switches, and the stream's state. */
export function LiveLogToolbar({ filters }: { filters: LiveLogFilters }) {
  const status = useStreamStatus();
  return (
    <div className="log-toolbar">
      <SearchField
        className="log-toolbar__grep"
        aria-label="Filter the live log"
        placeholder="grep"
        mono
        autoComplete="off"
        spellCheck={false}
        value={filters.grep}
        onValueChange={filters.setGrep}
      />
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
      <Switch
        small
        label="Hide heartbeats"
        checked={filters.hideHeartbeats}
        onCheckedChange={filters.setHideHeartbeats}
      />
      <Switch
        small
        label="Auto-scroll"
        checked={filters.autoscroll}
        onCheckedChange={filters.setAutoscroll}
      />
      <span className="log-toolbar__live">
        <LiveIndicator state={status} />
      </span>
    </div>
  );
}
