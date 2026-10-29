import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/errors';

// A refusal (4xx) will not change on a retry; a dropped connection might.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: (count, error) =>
        count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      refetchOnWindowFocus: true,
    },
  },
});
