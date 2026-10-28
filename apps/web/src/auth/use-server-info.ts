import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';

export const SERVER_INFO_KEY = ['info'] as const;

/**
 * `/api/info`: the server's facts, and the cheapest proof of a session. A 401
 * here is what sends the app to the sign-in screen.
 */
export function useServerInfo() {
  return useQuery({
    queryKey: SERVER_INFO_KEY,
    queryFn: () => unwrap(api.GET('/api/info')),
    retry: false,
    refetchInterval: 60_000,
  });
}
