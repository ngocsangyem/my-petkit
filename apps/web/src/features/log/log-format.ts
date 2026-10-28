import type { LogLevel } from '@/shared/ui';
import { formatTime } from '@/shared/format/format';
import type { HubEvent } from '@/shared/ws/hub-event';

// How a hub event reads as text: the expanded row, the copied entry and the
// downloaded file all use these, so a pasted entry looks like what was on screen.

type Detail = Record<string, unknown>;

function isRecord(value: unknown): value is Detail {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/** A JSON string re-indented; anything that is not JSON comes back as it was. */
export function pretty(value: unknown): string {
  const text = str(value);
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function keyedLines(record: unknown, sep: string): string[] {
  if (!isRecord(record)) return [];
  return Object.entries(record).map(([k, v]) => k + sep + str(v));
}

// An MQTT frame: who it was between, which way it went, and what was in it.
// The summary line only has room for the tail of the topic, so the full one is
// repeated here.
function mqttDetailText(dt: Detail): string {
  const lines = [str(dt.direction)];
  if (dt.client) lines.push('client: ' + str(dt.client));
  if (dt.origin) lines.push('origin: ' + str(dt.origin));
  lines.push(str(dt.topic));
  if (dt.payload) lines.push('', '── Payload ──', pretty(dt.payload));
  return lines.join('\n');
}

function proxyLines(p: Detail): string[] {
  const err = isRecord(p.error) ? p.error : null;
  const lines = [
    '',
    '── Proxied to the real cloud ──',
    str(p.upstream),
    'status ' + str(p.status) + (err ? `  ·  error ${str(err.code)} ${str(err.msg)}` : ''),
    'served to the device: ' +
      (p.served === 'upstream' ? 'the cloud’s reply' : 'OUR reply (upstream unusable)'),
  ];
  if (Array.isArray(p.redactions) && p.redactions.length) {
    lines.push('redacted: ' + p.redactions.map(str).join(', '));
  }
  if (p.upstream_body) lines.push('', '── What the cloud sent ──', pretty(p.upstream_body));
  return lines;
}

/** The expanded body of one entry. Empty when the event carries no detail. */
export function detailText(detail: unknown): string {
  if (detail === null || detail === undefined || detail === '') return '';
  if (isRecord(detail) && detail.topic) return mqttDetailText(detail);
  // Not every entry is an HTTP exchange: a redaction detail has no method or
  // status, and "undefined undefined → undefined" is worse than the object.
  if (!isRecord(detail) || !detail.method) return JSON.stringify(detail, null, 2);
  const lines = [`${str(detail.method)} ${str(detail.path)} → ${str(detail.status)}`];
  const headers = keyedLines(detail.headers, ': ');
  if (headers.length) lines.push('', '── Request headers ──', ...headers);
  const query = keyedLines(detail.query, ' = ');
  if (query.length) lines.push('', '── Query ──', ...query);
  if (detail.req_body) lines.push('', '── Request body ──', pretty(detail.req_body));
  if (isRecord(detail.proxy)) lines.push(...proxyLines(detail.proxy));
  if (detail.resp_body) lines.push('', '── Sent to the device ──', pretty(detail.resp_body));
  return lines.join('\n');
}

// A heartbeat is not its own event kind: it is an `http` row whose summary
// names the endpoint. The row filter and the download share this one test.
export function isHeartbeat(e: HubEvent): boolean {
  return e.kind === 'http' && e.summary.includes('heartbeat');
}

/** Stable identity of an event: `seq` restarts with the server, `ts` does not. */
export function eventKey(e: HubEvent): string {
  return `${e.seq}:${e.ts}`;
}

/** The device column: the id, or `server` for an unattributed event. */
export function deviceText(e: HubEvent): string {
  return e.device_id === null ? 'server' : String(e.device_id);
}

/**
 * Severity for the row's left edge. The hub has no levels, so it is derived:
 * a 5xx answer or a blocked command is an error, a 4xx or a rewrite a warning.
 */
export function levelOf(e: HubEvent): LogLevel {
  const status = isRecord(e.detail) ? Number(e.detail.status) : NaN;
  if (e.kind === 'blocked' || status >= 500) return 'error';
  if (e.kind === 'redact' || status >= 400) return 'warn';
  return 'info';
}

/** One entry as plain text: a header line, then the expanded body if any. */
export function entryText(e: HubEvent): string {
  const head = `[${formatTime(e.ts)}] ${e.kind}${e.device_id !== null ? ' #' + String(e.device_id) : ''} — ${e.summary}`;
  const body = detailText(e.detail);
  return body ? head + '\n' + body : head;
}

/** Several entries, separated the way the old panel's download was. */
export function entriesText(rows: readonly HubEvent[]): string {
  return rows.map(entryText).join('\n\n' + '─'.repeat(70) + '\n\n');
}
