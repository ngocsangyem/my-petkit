// One frame of `GET /api/ws` (packages/contracts/ws-events.md). `kind` is an
// open set: an unknown kind is kept, never an error.
export interface HubEvent {
  seq: number;
  ts: number;
  kind: string;
  device_id: number | string | null;
  summary: string;
  detail?: unknown;
}

export interface PingFrame {
  kind: 'ping';
  ts: number;
}

export function parseFrame(data: unknown): HubEvent | PingFrame | null {
  if (typeof data !== 'string') return null;
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return null; // one malformed frame must not take the stream down
  }
  if (typeof value !== 'object' || value === null) return null;
  const frame = value as Record<string, unknown>;
  if (frame.kind === 'ping' && typeof frame.ts === 'number') return { kind: 'ping', ts: frame.ts };
  if (typeof frame.kind !== 'string' || typeof frame.ts !== 'number') return null;
  return {
    seq: typeof frame.seq === 'number' ? frame.seq : 0,
    ts: frame.ts,
    kind: frame.kind,
    device_id:
      typeof frame.device_id === 'number' || typeof frame.device_id === 'string'
        ? frame.device_id
        : null,
    summary: typeof frame.summary === 'string' ? frame.summary : '',
    detail: frame.detail,
  };
}
