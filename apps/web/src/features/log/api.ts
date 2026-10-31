import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { i18n } from '@/i18n';
import { api, unwrap } from '@/shared/api/client';

/** How many rows the live log keeps; also how many the backfill asks for. */
export const LOG_CAP = 600;

/** Lines per page of the device-log viewer (the server's own default window). */
export const DEVICE_LOG_PAGE = 500;

export const logKeys = {
  backfill: ['log', 'events'] as const,
  deviceLogs: ['log', 'device-logs'] as const,
  deviceLog: (rel: string, q: string, offset: number) =>
    ['log', 'device-log', rel, q, offset] as const,
};

/**
 * The hub's ring on load. The socket only replays its last 80 events, so this
 * is what fills the view after a reload; the stream keeps it current.
 */
export function useEventBackfill() {
  return useQuery({
    queryKey: logKeys.backfill,
    queryFn: () => unwrap(api.GET('/api/events', { params: { query: { limit: LOG_CAP } } })),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useDeviceLogList() {
  return useQuery({
    queryKey: logKeys.deviceLogs,
    queryFn: () => unwrap(api.GET('/api/devicelogs')),
  });
}

// `{path}` spans several segments, which an OpenAPI path parameter cannot say:
// the default serializer would percent-encode the slashes. Encode each segment
// and keep the slashes, as the contract asks.
function devicelogPath(url: string, params: Record<string, unknown>): string {
  const rel = typeof params.path === 'string' ? params.path : '';
  return url.replace('{path}', rel.split('/').map(encodeURIComponent).join('/'));
}

/** One window of a device log, filtered server-side by `q` (terms ANDed, never a regex). */
export function useDeviceLogWindow(rel: string | null, q: string, offset: number) {
  return useQuery({
    queryKey: logKeys.deviceLog(rel ?? '', q, offset),
    enabled: rel !== null,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      toWindow(
        await unwrap(
          api.GET('/api/devicelogs/{path}', {
            params: {
              path: { path: rel ?? '' },
              query: { q, offset, limit: DEVICE_LOG_PAGE },
            },
            pathSerializer: devicelogPath,
          }),
        ),
      ),
  });
}

export interface DeviceLogWindow {
  /** `[line number in the file, text]`. */
  lines: [number, string][];
  total: number;
  matched: number;
}

// The route answers JSON here and text only on the download branch; the
// generated type is the union of both, so the JSON shape is checked once.
function toWindow(data: unknown): DeviceLogWindow {
  if (typeof data !== 'object' || data === null || !('lines' in data)) {
    throw new Error(i18n.t('log:device.badWindow'));
  }
  const raw = data as { lines: unknown; total?: unknown; matched?: unknown };
  const lines = Array.isArray(raw.lines)
    ? raw.lines.flatMap((pair: unknown): [number, string][] =>
        Array.isArray(pair) && typeof pair[0] === 'number' && typeof pair[1] === 'string'
          ? [[pair[0], pair[1]]]
          : [],
      )
    : [];
  return {
    lines,
    total: typeof raw.total === 'number' ? raw.total : lines.length,
    matched: typeof raw.matched === 'number' ? raw.matched : lines.length,
  };
}

/**
 * The raw file. Fetched through the client rather than linked, because the
 * server wants a fresh step-up here and only the client can ask for it and
 * replay the request.
 */
export async function fetchDeviceLogFile(rel: string): Promise<Blob> {
  return unwrap(
    api.GET('/api/devicelogs/{path}', {
      params: { path: { path: rel }, query: { download: '1' } },
      pathSerializer: devicelogPath,
      parseAs: 'blob',
    }),
  );
}
