import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { onSignedOut } from '@/shared/api/credential-prompt';
import { ApiError, errorMessage } from '@/shared/api/errors';
import { eventStream } from '@/shared/ws/event-stream';
import { ErrorBlock, Skeleton } from '@/shared/ui';
import { AuthPage } from './auth-page';
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

  // A 401 from any other route: forget what we knew and probe again. The probe
  // starts with no data, so its own 401 lands in the error state the gate reads.
  useEffect(
    () =>
      onSignedOut(() => {
        void queryClient.resetQueries({ queryKey: SERVER_INFO_KEY, exact: true });
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
      <AuthPage busy>
        <Skeleton width={440} height={320} />
      </AuthPage>
    );
  }
  if (info.error instanceof ApiError && info.error.status === 401) return <SignInScreen />;
  // Only with nothing to show: a failed background poll (an add-on restart, a
  // Wi-Fi blip) must not unmount the app and lose unsaved edits. The frame
  // shows that the server is unreachable instead.
  if (info.isError && info.data === undefined) {
    return (
      <AuthPage>
        <ErrorBlock
          message={errorMessage(info.error)}
          onRetry={() => void info.refetch()}
          retrying={info.isFetching}
        />
      </AuthPage>
    );
  }
  return (
    <>
      {children}
      <StepUpDialog />
    </>
  );
}
