import { cn } from 'cn';

/** Reachability of a device as the server sees it. */
export type DeviceStatus = 'online' | 'polling' | 'offline' | 'unknown';

/** Default words per status, as on the design sheet. */
export function statusLabel(status: DeviceStatus): string {
  switch (status) {
    case 'online':
      return 'Online · MQTT';
    case 'polling':
      return 'Polling · heartbeat';
    case 'offline':
      return 'Offline';
    case 'unknown':
      return 'Unknown';
  }
}

/** Props for {@link StatusMark}. */
export interface StatusMarkProps {
  status: DeviceStatus;
  /** Overrides the default words, e.g. "Online · HTTP". */
  label?: string;
}

const STATUS_INK: Record<DeviceStatus, string> = {
  online: 'text-positive',
  polling: 'text-chart-2',
  offline: 'text-negative',
  unknown: 'text-muted-foreground',
};

/** The 8px dot, drawn in `currentColor`; `hollow` leaves only its ring. */
function Dot({ hollow, className }: { hollow?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'size-2 flex-none rounded-full border-[1.5px] border-current',
        hollow ? 'bg-transparent' : 'bg-current',
        className,
      )}
      aria-hidden="true"
    />
  );
}

/**
 * 8px dot plus words; the status word is the only colour in its row. Unknown is hollow. The
 * `ui-status ui-status--<status>` classes stay as hooks for tests and screen-level selectors.
 */
export function StatusMark({ status, label }: StatusMarkProps) {
  return (
    <span
      className={cn(
        `ui-status ui-status--${status}`,
        'inline-flex items-center gap-1.5 whitespace-nowrap',
        STATUS_INK[status],
      )}
    >
      <Dot hollow={status === 'unknown'} />
      {label ?? statusLabel(status)}
    </span>
  );
}

/** State of the browser's live connection to the server. */
export type LiveState = 'live' | 'connecting' | 'offline';

function liveLabel(state: LiveState): string {
  switch (state) {
    case 'live':
      return 'Live';
    case 'connecting':
      return 'Connecting';
    case 'offline':
      return 'Offline';
  }
}

/** Props for {@link LiveIndicator}. */
export interface LiveIndicatorProps {
  state: LiveState;
  label?: string;
  /** Overrides the muted label colour and size, e.g. ink in the sidebar foot. */
  className?: string;
}

const LIVE_DOT: Record<LiveState, string> = {
  live: 'text-positive',
  connecting: 'text-muted-foreground',
  offline: 'text-negative',
};

/**
 * The Live dot of the sidebar foot: green when live, hollow while connecting, red when offline. The label
 * stays muted; only the dot carries the state.
 */
export function LiveIndicator({ state, label, className }: LiveIndicatorProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap text-muted-foreground',
        className,
      )}
      data-state={state}
      role="status"
    >
      <Dot hollow={state === 'connecting'} className={LIVE_DOT[state]} />
      {label ?? liveLabel(state)}
    </span>
  );
}
