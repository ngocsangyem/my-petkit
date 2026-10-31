import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import type { Metadata } from 'next';
import { Provider } from '@/components/provider';
import { appName } from '@/lib/shared';
import './global.css';

export const metadata: Metadata = {
  title: { template: `%s | ${appName}`, default: `${appName} docs` },
  description: 'Run your PetKit devices against a local server instead of the PetKit cloud.',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen font-sans">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
