import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AuthGate } from '@/auth/auth-gate';
import { ToastProvider } from '@/shared/ui';
import { queryClient } from './app/query-client';
import { router } from './app/routes';

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthGate>
          <RouterProvider router={router} />
        </AuthGate>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
