import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SERVER_INFO_KEY, useServerInfo } from '@/auth/use-server-info';
import { api, unwrap } from '@/shared/api/client';
import { BLOCKED_LIMIT, type RetentionCaps } from './retention-and-blocked-model';
import type { SettingsDraft } from './setup-model';

// The Setup screen reads `/api/info` (settings, upstreams, counters and the
// connection facts in one request), `/api/retention` and `/api/blocked`.

export const setupKeys = {
  retention: ['setup', 'retention'] as const,
  blocked: (reveal: boolean) => ['setup', 'blocked', reveal] as const,
  blockedAll: ['setup', 'blocked'] as const,
};

/** `/api/info`, shared with the shell (same query key, same cache entry). */
export const useSetupInfo = useServerInfo;

export function useRetention() {
  return useQuery({
    queryKey: setupKeys.retention,
    queryFn: async () => (await unwrap(api.GET('/api/retention'))).retention,
  });
}

/**
 * Newest-first blocked attempts; `reveal` shows payloads unmasked and needs a
 * step-up. A revealed list is fetched once, when asked for, and never again in
 * the background: a refetch after the grant lapsed would pop the password
 * dialog up unprompted, and users must only ever type it into one they opened.
 */
export function useBlocked(reveal: boolean) {
  return useQuery({
    queryKey: setupKeys.blocked(reveal),
    ...(reveal ? { staleTime: Infinity, refetchOnWindowFocus: false, refetchInterval: false } : {}),
    queryFn: () =>
      unwrap(
        api.GET('/api/blocked', {
          params: {
            query: reveal ? { limit: BLOCKED_LIMIT, reveal: '1' } : { limit: BLOCKED_LIMIT },
          },
        }),
      ),
  });
}

/**
 * Saves a batch of settings in one request. The server validates the whole
 * batch before applying any of it, so a refusal leaves every setting as it was.
 */
export function useSaveSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (draft: SettingsDraft) => unwrap(api.POST('/api/settings', { body: draft })),
    onSettled: () => client.invalidateQueries({ queryKey: SERVER_INFO_KEY }),
  });
}

export type RetentionPatch = Partial<
  Record<keyof RetentionCaps, { max_mb?: number | null; max_days: number | null }>
>;

export function useSaveRetention() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: RetentionPatch) =>
      (await unwrap(api.POST('/api/retention', { body }))).retention,
    onSuccess: retention => {
      client.setQueryData(setupKeys.retention, retention);
    },
  });
}
