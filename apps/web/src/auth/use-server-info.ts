import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { ApiError } from '@/shared/api/errors';

export const SERVER_INFO_KEY = ['info'] as const;

/**
 * `/api/info`: the server's facts, and the cheapest proof of a session. A 401
 * here is what sends the app to the sign-in screen.
 */
export function useServerInfo() {
  return useQuery({
    queryKey: SERVER_INFO_KEY,
    queryFn: () => unwrap(api.GET('/api/info')),
    // A 401 is an answer; anything else may be a restart in progress.
    retry: (count, error) => !(error instanceof ApiError && error.status === 401) && count < 2,
    refetchInterval: 60_000,
  });
}
