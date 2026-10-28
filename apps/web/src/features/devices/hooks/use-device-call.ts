import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { errorMessage } from '@/shared/api/errors';

/** The answer to the last thing a block did: one sentence, good or bad. */
export interface Feedback {
  text: string;
  tone: 'ok' | 'error';
}

/**
 * Runs one write at a time for a block, keeps its answer for the block's status
 * line, and refreshes the queries the write could have changed. Failures are
 * shown, never thrown: every call ends in a sentence.
 */
export function useDeviceCall() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const run = useCallback(
    async (call: () => Promise<string>, refresh: readonly QueryKey[]): Promise<boolean> => {
      setBusy(true);
      let ok = false;
      try {
        setFeedback({ text: await call(), tone: 'ok' });
        ok = true;
      } catch (error) {
        setFeedback({ text: errorMessage(error), tone: 'error' });
      } finally {
        setBusy(false);
        await Promise.all(refresh.map(queryKey => queryClient.invalidateQueries({ queryKey })));
      }
      return ok;
    },
    [queryClient],
  );

  return { busy, feedback, run, say: setFeedback };
}
