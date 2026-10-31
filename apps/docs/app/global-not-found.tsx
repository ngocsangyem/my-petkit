import type { Metadata } from 'next';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { DefaultNotFound } from 'fumadocs-ui/layouts/home/not-found';
import { RootDocument } from '@/components/root-document';
import { baseOptions } from '@/lib/layout.shared';
import { rootMetadata } from '@/lib/site-metadata';

// Each language tree has its own root layout, so an unmatched URL has no layout to render
// inside; this page carries its own `<html>` (English, the default language).
export const metadata: Metadata = { ...rootMetadata('en'), title: 'Page not found' };

export default function GlobalNotFound() {
  return (
    <RootDocument lang="en">
      <HomeLayout {...baseOptions('en')}>
        <DefaultNotFound />
      </HomeLayout>
    </RootDocument>
  );
}
