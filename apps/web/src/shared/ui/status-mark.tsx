import './status-mark.css';

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

/** 8px dot plus words; the status word is the only colour in its row. Unknown is hollow. */
export function StatusMark({ status, label }: StatusMarkProps) {
  return (
    <span className={`ui-status ui-status--${status}`}>
      <span className="ui-status__dot" aria-hidden="true" />
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
}

/** The top bar's Live dot: green when live, hollow while connecting, red when offline. */
export function LiveIndicator({ state, label }: LiveIndicatorProps) {
  return (
    <span className={`ui-live ui-live--${state}`} role="status">
      <span className="ui-status__dot" aria-hidden="true" />
      {label ?? liveLabel(state)}
    </span>
  );
}
