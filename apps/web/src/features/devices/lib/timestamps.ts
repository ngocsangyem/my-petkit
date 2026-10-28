// Device timestamps arrive "as stored by the device model": epoch seconds as a
// float, 0 for never, and in principle an ISO string. One reader for all of them.

type Stamp = number | string | null | undefined;

/** Epoch seconds, or null for never / unparseable. Millisecond epochs are scaled down. */
export function epochSeconds(value: Stamp): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(n)) {
    if (n <= 0) return null;
    return n > 1e12 ? n / 1000 : n;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed / 1000 : null;
}

/** The latest of several stamps, or null when none is set. */
export function latestStamp(...values: Stamp[]): number | null {
  let best: number | null = null;
  for (const v of values) {
    const s = epochSeconds(v);
    if (s !== null && (best === null || s > best)) best = s;
  }
  return best;
}

interface Reporting {
  last_heartbeat: Stamp;
  last_state_report: Stamp;
  last_seen: Stamp;
  last_mqtt: Stamp;
}

/**
 * When the device last said anything. A device on MQTT stops polling the HTTP
 * heartbeat, so the heartbeat alone would make the healthiest device look stale:
 * every channel counts, MQTT included.
 */
export function lastReport(d: Reporting): number | null {
  return latestStamp(d.last_heartbeat, d.last_state_report, d.last_seen, d.last_mqtt);
}
