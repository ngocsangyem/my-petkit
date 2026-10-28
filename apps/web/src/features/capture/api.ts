import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';

/** Records shown from the end of a file, as the old panel did. */
export const TAIL_LIMIT = 60;

export const captureKeys = {
  list: ['capture', 'list'] as const,
  tail: (name: string) => ['capture', 'tail', name] as const,
};

export function useCaptureListing() {
  return useQuery({
    queryKey: captureKeys.list,
    queryFn: () => unwrap(api.GET('/api/capture')),
  });
}

/** The newest records of one file (secrets masked by the server in this view only). */
export function useCaptureTail(name: string | null) {
  return useQuery({
    queryKey: captureKeys.tail(name ?? ''),
    enabled: name !== null,
    queryFn: () =>
      unwrap(
        api.GET('/api/capture/{name}', {
          params: { path: { name: name ?? '' }, query: { limit: TAIL_LIMIT } },
        }),
      ),
  });
}

/** Delete one file. Irreversible: there is no second copy. */
export function useDeleteCapture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      unwrap(api.DELETE('/api/capture/{name}', { params: { path: { name } } })),
    onSuccess: (_data, name) => {
      queryClient.removeQueries({ queryKey: captureKeys.tail(name) });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: captureKeys.list }),
  });
}

/**
 * The raw, unmasked file. Fetched through the client rather than linked,
 * because it needs a fresh step-up and only the client can ask for it and
 * replay the request.
 */
export async function fetchCaptureFile(name: string): Promise<Blob> {
  return unwrap(
    api.GET('/api/capture/{name}/download', {
      params: { path: { name } },
      parseAs: 'blob',
    }),
  );
}
