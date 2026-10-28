import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components, paths } from '@/api/schema';
import { api, unwrap } from '@/shared/api/client';

export type ClientToken = components['schemas']['AuthTokenInfo'];
export type Pairing =
  paths['/api/auth/pairing']['post']['responses'][200]['content']['application/json'];

export const tokenKeys = {
  list: ['tokens', 'list'] as const,
};

/** Live client tokens (never the token itself). `poll` refetches while a pairing code is shown. */
export function useClientTokens(poll: boolean) {
  return useQuery({
    queryKey: tokenKeys.list,
    queryFn: async () => (await unwrap(api.GET('/api/auth/tokens'))).tokens,
    refetchInterval: poll ? 5_000 : false,
  });
}

/** Revokes one client token; the phone holding it is signed out at once. */
export function useRevokeToken() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      unwrap(api.DELETE('/api/auth/tokens/{id}', { params: { path: { id } } })),
    onSettled: () => client.invalidateQueries({ queryKey: tokenKeys.list }),
  });
}

/** A single-use, five-minute pairing code (R3: the client asks for the password first). */
export function useCreatePairing() {
  return useMutation({
    mutationFn: () => unwrap(api.POST('/api/auth/pairing')),
  });
}
