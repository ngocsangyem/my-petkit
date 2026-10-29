import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { ThemeModeProvider } from '@/shared/ui/theme-mode';
import { ToastProvider } from '@/shared/ui/toast';

/** Render inside a fresh query client (no retries), the theme and toast providers and a memory router. */
export function renderWithProviders(ui: ReactElement, { route = '/' } = {}): RenderResult {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeModeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </ToastProvider>
      </ThemeModeProvider>
    </QueryClientProvider>,
  );
}
