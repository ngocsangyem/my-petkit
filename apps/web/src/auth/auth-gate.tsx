import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { onSignedOut } from '@/shared/api/credential-prompt';
import { ApiError, errorMessage } from '@/shared/api/errors';
import { eventStream } from '@/shared/ws/event-stream';
import { ErrorBlock, Skeleton } from '@/shared/ui';
import { SignInScreen } from './sign-in-screen';
import { StepUpDialog } from './step-up-dialog';
import { SERVER_INFO_KEY, useServerInfo } from './use-server-info';

/**
 * Renders the app only for a signed-in principal (a session, a token, or Home
 * Assistant Ingress), and the sign-in screen otherwise. The event stream runs
 * only while signed in, since the server refuses it without a principal.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const info = useServerInfo();
  const signedIn = info.isSuccess;

  useEffect(
    () =>
      onSignedOut(() => {
        void queryClient.invalidateQueries({ queryKey: SERVER_INFO_KEY });
      }),
    [queryClient],
  );

  useEffect(() => {
    if (!signedIn) return;
    eventStream.start();
    return () => {
      eventStream.stop();
    };
  }, [signedIn]);

  if (info.isPending) {
    return (
      <main className="auth-page" aria-busy="true">
        <Skeleton width={440} height={320} />
      </main>
    );
  }
  if (info.error instanceof ApiError && info.error.status === 401) return <SignInScreen />;
  if (info.isError) {
    return (
      <main className="auth-page">
        <ErrorBlock
          message={errorMessage(info.error)}
          onRetry={() => void info.refetch()}
          retrying={info.isFetching}
        />
      </main>
    );
  }
  return (
    <>
      {children}
      <StepUpDialog />
    </>
  );
}
